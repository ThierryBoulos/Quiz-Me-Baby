/* Usage (5 Nov 2026): in an empty folder, `npm i d3-geo@3 topojson-client@3 world-atlas@2 i18n-iso-countries@7`, copy
   this file there and run `node geo-view.mjs <path to maps-geo.js> asia`; it writes asia.json, which goes into
   maps-geo.js as views.asia. Change the rotation and the frame's countries for another view.
   An Asia view for maps-geo.js, cut the way the others were: Natural Earth 1:10m (world-atlas), d3's
   azimuthalEqualArea, paths in tenths of a pixel, relative moves, one shape per ISO3 code. */
import { readFileSync, writeFileSync } from "node:fs";
import * as d3 from "d3-geo";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";
const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-10m.json", "utf8"));
const fc = feature(topo, topo.objects.countries);
/* a tiny island wound the wrong way covers the whole globe but itself (the Maldives in 10m): turn it round */
for (const f of fc.features) {
  const g = f.geometry; if (!g) continue;
  const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
  for (const c of polys) if (d3.geoArea({ type: "Polygon", coordinates: c }) > 2 * Math.PI) c.forEach((r) => r.reverse());
}
global.window = {}; await import(process.argv[2]);
const G = window.MAPGEO, known = new Set(Object.keys(G.views.world.shapes).concat(Object.keys(G.views.world.tiny || {})));
const SPECIAL = { Kosovo: "XKX", "N. Cyprus": "CYP", Somaliland: "SOM" };
const iso = (f) => SPECIAL[f.properties.name] || (f.id && countries.numericToAlpha3(String(f.id).padStart(3, "0"))) || null;
export function makeView({ rotate, frame, w = 1000, pad = 12 }) {
  const proj = d3.geoAzimuthalEqualArea().rotate(rotate).precision(0.05);
  /* fit the frame's countries into w wide */
  const want = { type: "FeatureCollection", features: fc.features.filter((f) => frame.includes(iso(f))) };
  proj.fitWidth(w - 2 * pad, want);
  const b = d3.geoPath(proj).bounds(want);
  const h = Math.round(b[1][1] - b[0][1] + 2 * pad);
  const [tx0, ty0] = proj.translate(); proj.translate([tx0 - b[0][0] + pad, ty0 - b[0][1] + pad]);
  proj.clipExtent([[0, 0], [w, h]]);
  const shapes = {};
  for (const f of fc.features) {
    const code = iso(f); if (!code || !known.has(code)) continue;
    let d = "", rings = 0; const pts = [];
    const ctx = { moveTo(x, y) { pts.length = 0; pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); },
      closePath() { const r = []; for (const [x, y] of pts) { const p = [Math.round(x * 10), Math.round(y * 10)]; const l = r[r.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) r.push(p); }
        if (r.length >= 3) { rings++; d += "M" + r[0][0] + " " + r[0][1] + "l" + r.slice(1).map((p, i) => (p[0] - r[i][0]) + " " + (p[1] - r[i][1])).join(" ").replace(/ -/g, "-") + "z"; } },
      arc() {}, rect() {} };
    d3.geoPath(proj, ctx)(f);
    if (!rings) continue;
    const path = d3.geoPath(proj), area = path.area(f);
    /* label point: the centroid of its biggest piece */
    let best = null, bestA = -1;
    const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const c of polys) { const g = { type: "Polygon", coordinates: c }, a = path.area(g); if (a > bestA) { bestA = a; best = g; } }
    const l = path.centroid(best).map((v) => Math.round(v * 10) / 10);

    if (shapes[code]) { shapes[code].d += d; shapes[code].a += Math.round(area); continue; }
    shapes[code] = { d, l, a: Math.round(area) };
  }
  const s = proj.scale(), t = proj.translate();
  return { w, h, shapes, tiny: {}, proj: { t: "laea", k: +s.toFixed(5), tx: +t[0].toFixed(4), ty: +t[1].toFixed(4), r: rotate } };
}
const mode = process.argv[3];
if (mode === "europe-check") {
  const v = makeView({ rotate: [-14, -53], frame: ["PRT", "ISL", "NOR", "FIN", "RUS", "TUR", "CYP", "ESP", "GRC"] });
  console.log(v.w, v.h, JSON.stringify(v.proj), Object.keys(v.shapes).length, v.shapes.FRA && { a: v.shapes.FRA.a, l: v.shapes.FRA.l });
} else {
  const frame = ["AFG", "JPN", "MNG", "IDN", "TLS", "PHL", "IND", "PAK", "CHN", "LKA", "KAZ"];
  const v = makeView({ rotate: [-100, -25], frame });
  writeFileSync("asia.json", JSON.stringify(v));
  console.log(v.w, v.h, JSON.stringify(v.proj), Object.keys(v.shapes).length, Object.keys(v.shapes).join(" "), (JSON.stringify(v).length / 1024).toFixed(0) + " KB");
}
