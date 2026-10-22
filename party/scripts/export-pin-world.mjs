#!/usr/bin/env node
/* export-pin-world.mjs — the world map Drop the Pin is played on: party/public/pins/world-far.json and world-near.json.
   Natural Earth 1:10m countries (public domain, via world-atlas) and 1:50m lakes, kept as a topology:
   each border or coastline drawn once (an "arc"), the land made of arcs, every point in thousandths
   of a degree (about 110 m) and simplified to about 1 km, so a phone can zoom from the whole world
   to a single city. Two levels of detail: "far" for the whole world, "near" once zoomed in (each its own file).
   Usage: node scripts/export-pin-world.mjs   (needs the network; run once, the output is committed) */
import { writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const get = async (u) => { const r = await fetch(u, { headers: { "User-Agent": "QuizMeBabyParty/1.0 (private party quiz app)" } }); if (!r.ok) throw new Error(u + ": " + r.status); return r.json(); };
const topo = await get("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json");
const lakes = await get("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_lakes.geojson");

/* topojson arcs: quantized, delta-encoded -> [lon, lat] */
const { scale: [kx, ky], translate: [tx, ty] } = topo.transform;
const arcs = topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * kx + tx, y * ky + ty]; }); });

/* Douglas-Peucker, in degrees (longitude shrunk by the cosine of the latitude, so it's even on the ground) */
function simplify(pts, tol) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let best = -1, at = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], c = Math.cos(((ay + by) / 2) * Math.PI / 180);
    const dx = (bx - ax) * c, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const px = (pts[i][0] - ax) * c, py = pts[i][1] - ay;
      const d = len ? Math.abs(dx * py - dy * px) / len : Math.hypot(px, py);
      if (d > best) { best = d; at = i; }
    }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* thousandths of a degree, delta-encoded: [x0, y0, dx1, dy1, ...] */
const pack = (pts) => { const o = []; let px = 0, py = 0; for (const [x, y] of pts) { const X = Math.round(x * 1000), Y = Math.round(y * 1000); if (o.length && X === px && Y === py) continue; o.push(X - px, Y - py); px = X; py = Y; } return o; };

/* which arcs are borders (shared by two countries) rather than coastline */
const uses = new Map();
const walk = (g, f) => { const polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : []; for (const p of polys) for (const ring of p) for (const i of ring) f(i < 0 ? ~i : i); };
for (const g of topo.objects.countries.geometries) { const seen = new Set(); walk(g, (i) => { if (!seen.has(i)) { seen.add(i); uses.set(i, (uses.get(i) || 0) + 1); } }); }
const land = topo.objects.land.geometries.flatMap((g) => (g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : []));

const level = (tol) => ({
  arcs: arcs.map((a) => pack(simplify(a, tol))),
  land,                                                  // polygons: rings of arc indices (~i = reversed)
  borders: [...uses].filter(([, n]) => n > 1).map(([i]) => i),
});
const lakeRings = (tol) => lakes.features.filter((f) => f.properties.scalerank <= 4).flatMap((f) => {
  const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.map((p) => pack(simplify(p[0], tol))).filter((r) => r.length >= 8);
});

/* two files: the whole world loads first (small); the detail loads behind it, for zooming in */
const head = { v: 1, src: "Natural Earth 1:10m countries and 1:50m lakes (public domain), via world-atlas", unit: 1000 };
const pts = (L) => L.arcs.reduce((s, a) => s + a.length / 2, 0);
for (const [name, tol] of [["far", 0.12], ["near", 0.01]]) {
  const L = { ...head, ...level(tol), lakes: lakeRings(tol) };
  const file = join(root, `party/public/pins/world-${name}.json`);
  writeFileSync(file, JSON.stringify(L));
  console.log(`pins/world-${name}.json: ${(statSync(file).size / 1024).toFixed(0)} KB, ${pts(L)} points, ${L.borders.length} borders, ${L.lakes.length} lakes`);
}
