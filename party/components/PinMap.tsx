"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLon } from "@/lib/game";

/* DROP THE PIN's world map: Natural Earth's coastlines, borders, lakes and big rivers
   (scripts/export-pin-world.mjs), and no names: the names would do the work for you.
   Drawn on a canvas in Web Mercator, so a phone can go from the whole world to a single
   town (4096x: a street in Paris is a few pixels), the detail loading behind the world view.
   Tap to drop your pin, drag it to move it, pinch (or +/−) to zoom. On the reveal it flies
   from the whole world to where the landmark is, with both pins and how far off they were. */

/* ---- Web Mercator: the world as a unit square, x east from the date line, y south from the top ---- */
const LAT_MAX = 85.0511;
export const mx = (lon: number) => (lon + 180) / 360;
export const my = (lat: number) => { const r = (Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)) * Math.PI) / 180; return 0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI); };
export const lonOf = (x: number) => x * 360 - 180;
export const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const EARTH_KM = 40075.017;                          // round the equator
/* the playing field: the world from the Arctic to the Southern Ocean (Antarctica stays off the board) */
const Y0 = my(84), Y1 = my(-62);
const MAX_ZOOM = 4096;                               // the world's width, this many times over

/* ---- the map files: arcs drawn once, the land made of arcs ---- */
type Raw = { unit: number; arcs: number[][]; land: number[][][]; borders: number[]; lakes: number[][]; rivers?: number[][] };
type Box = [number, number, number, number];         // x0, y0, x1, y1 (world units)
type Lvl = { arcs: Float64Array[]; abox: Box[]; land: number[][][]; pbox: Box[]; pwrap: number[][]; borders: number[]; awrap: number[][]; lakes: Float64Array[]; kbox: Box[]; rivers: Float64Array[]; rbox: Box[] };
function unpack(p: number[], unit: number) {
  const out = new Float64Array(p.length);
  let x = 0, y = 0;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; out[i] = mx(x / unit); out[i + 1] = my(y / unit); }
  return out;
}
function boxOf(a: Float64Array): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
/* The date line: a ring or a line that crosses it (Chukotka, Fiji) jumps from one edge of the
   map to the other. Drawn, it stays in one piece (see trace), running off one edge; a second
   copy, a world-width over, brings the rest in at the other. Which copies each one needs: */
function wraps(runs: Float64Array[][]): number[] {
  let lo = 0, hi = 1, off = 0, rx = NaN;
  for (const run of runs) for (const a of run) for (let j = 0; j < a.length; j += 2) {
    const x = a[j];
    if (rx === rx) { const d = x - rx; if (d > 0.5) off -= 1; else if (d < -0.5) off += 1; }
    rx = x; lo = Math.min(lo, x + off); hi = Math.max(hi, x + off);
  }
  return [...(hi > 1 + 1e-9 ? [-1] : []), ...(lo < -1e-9 ? [1] : [])];
}
const rev = (a: Float64Array) => { const o = new Float64Array(a.length); for (let j = 0; j < a.length; j += 2) { o[a.length - 2 - j] = a[j]; o[a.length - 1 - j] = a[j + 1]; } return o; };
function decode(r: Raw): Lvl {
  const arcs = r.arcs.map((a) => unpack(a, r.unit)), abox = arcs.map(boxOf);
  const pwrap = r.land.map((poly) => wraps([poly[0].map((i) => (i < 0 ? rev(arcs[~i]) : arcs[i]))]));
  const awrap = arcs.map((a) => (r.borders.length ? wraps([[a]]) : []));
  /* a polygon's box: its outer ring's arcs */
  const pbox = r.land.map((poly) => poly[0].reduce<Box>((b, i) => { const a = abox[i < 0 ? ~i : i]; return [Math.min(b[0], a[0]), Math.min(b[1], a[1]), Math.max(b[2], a[2]), Math.max(b[3], a[3])]; }, [Infinity, Infinity, -Infinity, -Infinity]));
  const lakes = r.lakes.map((l) => unpack(l, r.unit)), rivers = (r.rivers || []).map((l) => unpack(l, r.unit));
  return { arcs, abox, land: r.land, pbox, pwrap, borders: r.borders, awrap, lakes, kbox: lakes.map(boxOf), rivers, rbox: rivers.map(boxOf) };
}
const files: Partial<Record<"far" | "near", Promise<Lvl>>> = {};
const load = (n: "far" | "near") => (files[n] ||= fetch(`/pins/world-${n}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  .then(decode).catch((e) => { delete files[n]; throw e; }));
/* fetched ahead (usePreload): the world first, then its detail */
export const preloadWorld = () => { void load("far").then(() => load("near")).catch(() => { /* tried again when the map opens */ }); };

/* ---- drawing ---- */
type View = { cx: number; cy: number; s: number };   // the world point at the centre, and pixels per world unit
export type Mark = { at: LatLon; kind: "pin" | "truth"; color: string; label?: string };
const SEA = "#0B1030", LAND = "#2B3152", COAST = "rgba(170,182,255,.30)", BORDER = "#0B1030", RIVER = "rgba(96,132,255,.55)";

/* A path through a run of points, only as much of it as the screen needs. A stretch that stays
   beyond one edge of the screen goes as a straight line (it stays beyond that edge, so what's on
   screen is drawn exactly the same, filled or not); points closer than a pixel are one. A jump
   across the date line is undone (the run carries on past the edge), and `base` shifts the whole
   run a world-width over, for the copy at the other edge. */
function trace(ctx: CanvasRenderingContext2D, V: View, W: number, H: number) {
  const m = 6, hw = W / 2, hh = H / 2;
  let started = false, mask = 0, held = false, hx = 0, hy = 0, lx = 0, ly = 0, off = 0, rx = NaN;
  const code = (x: number, y: number) => (x < -m ? 1 : x > W + m ? 2 : 0) | (y < -m ? 4 : y > H + m ? 8 : 0);
  return {
    base: 0,
    point(wx: number, wy: number) {
      if (rx === rx) { const d = wx - rx; if (d > 0.5) off -= 1; else if (d < -0.5) off += 1; }
      rx = wx;
      const x = (wx + off + this.base - V.cx) * V.s + hw, y = (wy - V.cy) * V.s + hh, c = code(x, y);
      if (!started) { ctx.moveTo(x, y); started = true; mask = c; lx = x; ly = y; return; }
      const both = mask & c;
      if (both) { mask = both; held = true; hx = x; hy = y; return; }
      if (held) { ctx.lineTo(hx, hy); held = false; lx = hx; ly = hy; }
      if (!c && Math.abs(x - lx) < 0.6 && Math.abs(y - ly) < 0.6) return;
      ctx.lineTo(x, y); lx = x; ly = y; mask = c;
    },
    end(close: boolean) { if (held) ctx.lineTo(hx, hy); if (close && started) ctx.closePath(); started = false; held = false; mask = 0; off = 0; rx = NaN; },
  };
}
const seen = (b: Box, v: Box) => b[2] >= v[0] && b[0] <= v[2] && b[3] >= v[1] && b[1] <= v[3];

function drawWorld(ctx: CanvasRenderingContext2D, L: Lvl, V: View, W: number, H: number, k: number) {
  const pad = 8 / V.s, vb: Box = [V.cx - W / 2 / V.s - pad, V.cy - H / 2 / V.s - pad, V.cx + W / 2 / V.s + pad, V.cy + H / 2 / V.s + pad];
  const T = trace(ctx, V, W, H);
  const arc = (i: number, skipFirst: boolean) => {
    const a = L.arcs[i < 0 ? ~i : i], n = a.length / 2;
    if (i < 0) for (let j = n - 1 - (skipFirst ? 1 : 0); j >= 0; j--) T.point(a[2 * j], a[2 * j + 1]);
    else for (let j = skipFirst ? 1 : 0; j < n; j++) T.point(a[2 * j], a[2 * j + 1]);
  };
  /* the land, its coast */
  ctx.beginPath();
  L.land.forEach((poly, p) => {
    if (!seen(L.pbox[p], vb)) return;
    for (const b of [0, ...L.pwrap[p]]) { T.base = b; for (const ring of poly) { ring.forEach((i, j) => arc(i, j > 0)); T.end(true); } }
    T.base = 0;
  });
  ctx.fillStyle = LAND; ctx.fill("evenodd");
  ctx.strokeStyle = COAST; ctx.lineWidth = 1 * k; ctx.lineJoin = "round"; ctx.stroke();
  /* lakes, then rivers on top */
  ctx.beginPath();
  L.lakes.forEach((a, i) => { if (!seen(L.kbox[i], vb)) return; for (let j = 0; j < a.length; j += 2) T.point(a[j], a[j + 1]); T.end(true); });
  ctx.fillStyle = SEA; ctx.fill(); ctx.strokeStyle = COAST; ctx.stroke();
  ctx.beginPath();
  L.rivers.forEach((a, i) => { if (!seen(L.rbox[i], vb)) return; for (let j = 0; j < a.length; j += 2) T.point(a[j], a[j + 1]); T.end(false); });
  ctx.strokeStyle = RIVER; ctx.lineWidth = (V.s > 40000 ? 1.6 : 1) * k; ctx.lineCap = "round"; ctx.stroke();
  /* the borders between countries */
  ctx.beginPath();
  for (const i of L.borders) { if (!seen(L.abox[i], vb)) continue; for (const b of [0, ...L.awrap[i]]) { T.base = b; arc(i, false); T.end(false); } T.base = 0; }
  ctx.strokeStyle = BORDER; ctx.lineWidth = 1.3 * k; ctx.stroke();
}

/* a pin: a drop in its team's colour, its tip exactly on the spot */
function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, k: number) {
  const r = 11 * k, cy = y - 2.3 * r;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - r * 0.35, y - r * 0.9, x - r, cy + r * 0.55, x - r, cy);
  ctx.arc(x, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(x + r, cy + r * 0.55, x + r * 0.35, y - r * 0.9, x, y);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 2 * k; ctx.strokeStyle = "#fff"; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, cy, r * 0.38, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 2.2 * k, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
}
/* where it really is: a gold star in a ring */
function drawTruth(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.beginPath(); ctx.arc(x, y, 13 * k, 0, Math.PI * 2); ctx.fillStyle = "rgba(245,197,24,.22)"; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = (i % 2 ? 4.2 : 10) * k; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = "#F5C518"; ctx.fill(); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = "#fff"; ctx.stroke();
}
type Rect = [number, number, number, number];
const hits = (a: Rect, b: Rect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
/* a name on the map, dark-edged so it reads on land and sea; where it goes is where it bumps into nothing
   already there (the spot's name, the other pin and its name): above the pin, then right, left, below */
function label(ctx: CanvasRenderingContext2D, text: string, spots: [number, number, CanvasTextAlign][], taken: Rect[], k: number, font: string, color: string, W: number, H: number) {
  ctx.font = `800 ${14 * k}px ${font}`; ctx.textBaseline = "bottom";
  const w = ctx.measureText(text).width, h = 17 * k;
  const box = ([x, y, a]: [number, number, CanvasTextAlign]): Rect => { const x0 = a === "center" ? x - w / 2 : a === "left" ? x : x - w; return [x0 - 3, y - h, x0 + w + 3, y + 2]; };
  const inside = (b: Rect) => b[0] >= 2 && b[1] >= 2 && b[2] <= W - 2 && b[3] <= H - 2;
  const at = spots.find((s) => inside(box(s)) && !taken.some((t) => hits(box(s), t))) || spots.find((s) => inside(box(s))) || spots[0];
  ctx.textAlign = at[2];
  ctx.lineWidth = 4 * k; ctx.strokeStyle = SEA; ctx.lineJoin = "round"; ctx.strokeText(text, at[0], at[1]);
  ctx.fillStyle = color; ctx.fillText(text, at[0], at[1]);
  taken.push(box(at));
}
/* a bar of a round distance, top left (the buttons are on the right, a phone's Lock in under it): how far is far at this zoom */
function scaleBar(ctx: CanvasRenderingContext2D, V: View, k: number, font: string) {
  const kmPx = (EARTH_KM * Math.cos((latOf(V.cy) * Math.PI) / 180)) / V.s, want = 90 * k * kmPx;
  const e = Math.pow(10, Math.floor(Math.log10(want))), km = [5, 2, 1].map((f) => f * e).find((d) => d <= want) || e, px = km / kmPx;
  const x = 12 * k, y = 30 * k;
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2 * k; ctx.lineCap = "butt";
  ctx.beginPath(); ctx.moveTo(x, y - 5 * k); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5 * k); ctx.stroke();
  ctx.font = `700 ${11 * k}px ${font}`; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(km >= 1 ? `${km.toLocaleString("en-GB")} km` : `${Math.round(km * 1000)} m`, x + 4 * k, y - 4 * k);
}

/* the view that shows these points, with room round them (and not closer in than `minKm` across) */
function fitView(pts: LatLon[], W: number, H: number, minKm: number): View {
  const xs = pts.map((p) => mx(p.lon)), ys = pts.map((p) => my(p.lat));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const min = minKm / (EARTH_KM * Math.cos((latOf(cy) * Math.PI) / 180));
  const s = Math.min((W * 0.62) / Math.max(x1 - x0, min), (H * 0.5) / Math.max(y1 - y0, min * (H / W)));
  return { cx, cy: cy - (H * 0.06) / s, s };              // a little low: the pins stand up from their spots
}

/* value: my pin; onChange: a pin dropped or moved (pick: this map takes pins). marks: what to show
   (the reveal); fly: fly in to them from the whole world. size: 1 on a phone, bigger on the TV */
export function PinMap({ value, onChange, color = "#31c9f7", marks, fly, height, size = 1, interactive = true, tools = !!onChange, label: aria }:
  { value?: LatLon | null; onChange?: (p: LatLon) => void; color?: string; marks?: Mark[]; fly?: boolean; height: number | string; size?: number; interactive?: boolean; tools?: boolean; label?: string }) {
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const [lv, setLv] = useState<{ far?: Lvl; near?: Lvl }>({});
  const [failed, setFailed] = useState(false);
  const V = useRef<View | null>(null), dim = useRef({ W: 0, H: 0 });
  const pin = useRef<LatLon | null>(value ?? null);
  const raf = useRef(0), anim = useRef(0);
  const pick = !!onChange;
  useEffect(() => { pin.current = value ?? null; redraw(); }, [value?.lat, value?.lon]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let on = true;
    load("far").then((far) => { if (on) setLv((c) => ({ ...c, far })); return load("near"); }).then((near) => { if (on) setLv((c) => ({ ...c, near })); })
      .catch(() => { if (on) setFailed(true); });
    return () => { on = false; };
  }, []);

  /* the zoom limits for this size of screen: the whole world, down to MAX_ZOOM times it */
  const minS = () => Math.min(dim.current.W, dim.current.H / (Y1 - Y0));
  const maxS = () => Math.max(dim.current.W, 320) * MAX_ZOOM;
  const clampV = (v: View): View => {
    const { W, H } = dim.current, s = Math.max(minS(), Math.min(maxS(), v.s));
    const half = (n: number) => n / 2 / s;
    const cx = W / s >= 1 ? 0.5 : Math.max(half(W), Math.min(1 - half(W), v.cx));
    const cy = H / s >= Y1 - Y0 ? (Y0 + Y1) / 2 : Math.max(Y0 + half(H), Math.min(Y1 - half(H), v.cy));
    return { cx, cy, s };
  };
  const world = (): View => clampV({ cx: 0.5, cy: (Y0 + Y1) / 2, s: minS() });

  const draw = useCallback(() => {
    raf.current = 0;
    const c = cv.current, v = V.current, { W, H } = dim.current;
    if (!c || !v || !W) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = c.width / W, k = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA; ctx.fillRect(0, 0, W, H);
    /* the detail once a degree is more than a few pixels (and once it's here) */
    const L = v.s / 360 > 6 && lv.near ? lv.near : lv.far || lv.near;
    if (L) drawWorld(ctx, L, v, W, H, Math.max(1, k * 0.8));
    const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const at = (p: LatLon) => [(mx(p.lon) - v.cx) * v.s + W / 2, (my(p.lat) - v.cy) * v.s + H / 2];
    if (marks?.length) {
      const truth = marks.find((m) => m.kind === "truth");
      /* the lines first: from where it is to each pin */
      if (truth) for (const m of marks) if (m.kind === "pin") {
        const [a, b] = at(truth.at), [x, y] = at(m.at);
        ctx.setLineDash([7 * k, 6 * k]); ctx.lineWidth = 2.4 * k; ctx.strokeStyle = m.color; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const m of marks) { if (m.kind === "pin") { const [x, y] = at(m.at); drawPin(ctx, x, y, m.color, k); } }
      /* the pins' heads are taken; then the names, each where it fits */
      const r = 11 * k, taken: Rect[] = marks.filter((m) => m.kind === "pin").map((m) => { const [x, y] = at(m.at); return [x - r - 2, y - 3.4 * r, x + r + 2, y + 2]; });
      if (truth) {
        const [x, y] = at(truth.at); drawTruth(ctx, x, y, k);
        if (truth.label) label(ctx, truth.label, [[x, y - 16 * k, "center"], [x, y + 31 * k, "center"], [x + 16 * k, y + 7 * k, "left"], [x - 16 * k, y + 7 * k, "right"]], taken, k, font, "#F5C518", W, H);
      }
      for (const m of marks) if (m.kind === "pin" && m.label) {
        const [x, y] = at(m.at), hy = y - 2.3 * r;
        label(ctx, m.label, [[x, hy - r - 4 * k, "center"], [x + r + 6 * k, hy + 6 * k, "left"], [x - r - 6 * k, hy + 6 * k, "right"], [x, y + 20 * k, "center"]], taken, k, font, m.color, W, H);
      }
    }
    if (pin.current) { const [x, y] = at(pin.current); drawPin(ctx, x, y, color, k); }
    scaleBar(ctx, v, k, font);
    /* where the map is looking, and how close (for the browser tests, and a curious eye) */
    c.dataset.view = `${latOf(v.cy).toFixed(6)},${lonOf(v.cx).toFixed(6)},${(v.s / minS()).toFixed(3)},${L === lv.near ? "near" : L ? "far" : "none"}`;
    c.dataset.pin = pin.current ? `${pin.current.lat.toFixed(6)},${pin.current.lon.toFixed(6)}` : "";
  }, [lv, marks, color, size]);
  /* (animations and the reveal's fly-in started before the map arrived call the latest drawing) */
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const redraw = () => { if (!raf.current) raf.current = requestAnimationFrame(() => drawRef.current()); };
  useEffect(() => { redraw(); }, [draw]);

  /* fly from one view to another: the zoom eases on a log scale, so it doesn't rush the last stretch */
  const flyTo = (to: View, ms: number) => {
    cancelAnimationFrame(anim.current);
    const from = V.current || to, t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e);
      /* the centre moves in step with the zoom (in screen terms), not ahead of it */
      const f = from.s === to.s ? e : (1 / from.s - 1 / s) / (1 / from.s - 1 / to.s);
      V.current = { cx: from.cx + (to.cx - from.cx) * f, cy: from.cy + (to.cy - from.cy) * f, s };
      drawRef.current();
      if (u < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const markKey = JSON.stringify(marks?.map((m) => [m.at.lat, m.at.lon]) || null);
  const target = () => (marks?.length ? clampV(fitView(marks.map((m) => m.at), dim.current.W, dim.current.H, 40)) : null);

  /* the canvas follows its box (and the screen's pixels) */
  useEffect(() => {
    const el = box.current, c = cv.current;
    if (!el || !c) return;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(3, window.devicePixelRatio || 1);
      if (!W || !H) return;
      const was = dim.current.W;
      dim.current = { W, H };
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      V.current = V.current && was ? clampV(V.current) : target() && !fly ? target()! : world();
      draw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el); fit();
    return () => ro.disconnect();
  }, [draw]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* the reveal: from the whole world down to the spot and the pins */
  useEffect(() => {
    const t = target();
    if (!t || !dim.current.W) return;
    if (fly) { V.current = world(); drawRef.current(); const d = setTimeout(() => flyTo(t, 2200), 350); return () => clearTimeout(d); }
    V.current = t; drawRef.current();
  }, [markKey, fly]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(raf.current); cancelAnimationFrame(anim.current); }, []);

  /* ---- touch: drag to look around, pinch to zoom, tap to drop the pin, drag the pin to move it ---- */
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<null | { mode: "pan" | "pin" | "pinch"; x: number; y: number; t: number; v: View; moved: boolean; ox?: number; oy?: number; d?: number; wx?: number; wy?: number }>(null);
  const local = (e: { clientX: number; clientY: number }) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const toWorld = (x: number, y: number) => { const v = V.current!, { W, H } = dim.current; return { wx: v.cx + (x - W / 2) / v.s, wy: v.cy + (y - H / 2) / v.s }; };
  const toLatLon = (x: number, y: number): LatLon => { const { wx, wy } = toWorld(x, y); return { lat: latOf(Math.max(0, Math.min(1, wy))), lon: lonOf(Math.max(0, Math.min(1, wx))) }; };
  const pinXY = () => { const v = V.current, p = pin.current, { W, H } = dim.current; return v && p ? { x: (mx(p.lon) - v.cx) * v.s + W / 2, y: (my(p.lat) - v.cy) * v.s + H / 2 } : null; };
  /* on the pin: its head (above the finger) or its tip */
  const onPin = (x: number, y: number) => { const p = pinXY(), r = 11 * size; return !!p && (Math.hypot(x - p.x, y - (p.y - 2.3 * r)) < r * 1.9 || Math.hypot(x - p.x, y - p.y) < r * 1.2); };
  const commit = () => { if (pin.current && onChange) onChange({ lat: Math.round(pin.current.lat * 1e5) / 1e5, lon: Math.round(pin.current.lon * 1e5) / 1e5 }); };
  const two = () => { const [a, b] = [...ptrs.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

  const down = (e: React.PointerEvent) => {
    if (!interactive || !V.current) return;
    cancelAnimationFrame(anim.current);
    try { cv.current?.setPointerCapture(e.pointerId); } catch { /* */ }
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      const P = pinXY();
      g.current = pick && onPin(p.x, p.y) && P ? { mode: "pin", x: p.x, y: p.y, t: Date.now(), v: V.current, moved: false, ox: P.x - p.x, oy: P.y - p.y }
        : { mode: "pan", x: p.x, y: p.y, t: Date.now(), v: V.current, moved: false };
    } else if (ptrs.current.size === 2) {
      const t = two(), w = toWorld(t.x, t.y);
      if (g.current?.mode === "pin") commit();
      g.current = { mode: "pinch", x: t.x, y: t.y, t: Date.now(), v: V.current, moved: true, d: t.d, wx: w.wx, wy: w.wy };
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !g.current) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    const G = g.current, { W, H } = dim.current;
    if (G.mode === "pinch" && ptrs.current.size >= 2) {
      const t = two(), s = Math.max(minS(), Math.min(maxS(), G.v.s * (t.d / G.d!)));
      V.current = clampV({ cx: G.wx! - (t.x - W / 2) / s, cy: G.wy! - (t.y - H / 2) / s, s });
      redraw(); return;
    }
    const dx = p.x - G.x, dy = p.y - G.y;
    if (Math.abs(dx) + Math.abs(dy) > 7) G.moved = true;
    if (G.mode === "pin") { pin.current = toLatLon(p.x + G.ox!, p.y + G.oy!); redraw(); return; }
    if (G.mode === "pan" && G.moved) { V.current = clampV({ cx: G.v.cx - dx / G.v.s, cy: G.v.cy - dy / G.v.s, s: G.v.s }); redraw(); }
  };
  const up = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = ptrs.current.get(e.pointerId)!;
    ptrs.current.delete(e.pointerId);
    const G = g.current;
    if (ptrs.current.size === 1 && G?.mode === "pinch") {
      /* one finger left after a pinch: it pans on from where it is */
      const [q] = [...ptrs.current.values()];
      g.current = { mode: "pan", x: q.x, y: q.y, t: 0, v: V.current!, moved: true };
      return;
    }
    if (ptrs.current.size > 0) return;
    g.current = null;
    if (!G) return;
    if (G.mode === "pin") { if (G.moved) commit(); return; }
    /* a tap: the pin goes there */
    if (G.mode === "pan" && !G.moved && pick && Date.now() - G.t < 700) { pin.current = toLatLon(p.x, p.y); redraw(); commit(); }
  };
  /* +/−: in on your pin when it's on screen, else on the middle */
  const zoomBy = (f: number) => {
    const v = V.current;
    if (!v) return;
    const { W, H } = dim.current, P = pinXY(), on = P && P.x >= 0 && P.x <= W && P.y >= 0 && P.y <= H;
    const ax = on ? P!.x : W / 2, ay = on ? P!.y : H / 2, w = toWorld(ax, ay);
    const s = Math.max(minS(), Math.min(maxS(), v.s * f));
    flyTo(clampV({ cx: w.wx - (ax - W / 2) / s, cy: w.wy - (ay - H / 2) / s, s }), 260);
  };
  const wheel = (e: React.WheelEvent) => {
    if (!interactive || !V.current) return;
    const p = local(e), w = toWorld(p.x, p.y), { W, H } = dim.current;
    const s = Math.max(minS(), Math.min(maxS(), V.current.s * Math.exp(-e.deltaY * 0.0022)));
    V.current = clampV({ cx: w.wx - (p.x - W / 2) / s, cy: w.wy - (p.y - H / 2) / s, s }); redraw();
  };
  /* the keyboard: arrows look around, + and − zoom, Enter drops the pin in the middle */
  const key = (e: React.KeyboardEvent) => {
    const v = V.current;
    if (!v || !interactive) return;
    const step = 60 / v.s, mv = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (mv) { e.preventDefault(); V.current = clampV({ ...v, cx: v.cx + mv[0], cy: v.cy + mv[1] }); redraw(); }
    else if (e.key === "+" || e.key === "=") zoomBy(2);
    else if (e.key === "-") zoomBy(0.5);
    else if (e.key === "Enter" && pick) { const { W, H } = dim.current; pin.current = toLatLon(W / 2, H / 2); redraw(); commit(); }
  };

  return (
    <div className="pinmap" style={{ height }}>
      <div ref={box} className="pm-stage">
        <canvas ref={cv} role="img" tabIndex={interactive ? 0 : -1} aria-label={aria || (pick ? "World map: tap to drop your pin, pinch to zoom" : "World map")}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} onKeyDown={key} />
        {!lv.far && !lv.near && <div className="pm-wait" aria-busy={!failed}>{failed ? "The map didn't load. Check the Wi-Fi." : <><div className="spinner" />Loading the map…</>}</div>}
      </div>
      {interactive && tools && (
        <div className="pm-tools">
          <button type="button" className="btn btn-sm" aria-label="Zoom in" onClick={() => zoomBy(2.5)}>+</button>
          <button type="button" className="btn btn-sm" aria-label="Zoom out" onClick={() => zoomBy(0.4)}>−</button>
          <button type="button" className="btn btn-sm" aria-label="The whole world" onClick={() => flyTo(world(), 420)}>World</button>
        </div>)}
    </div>);
}
