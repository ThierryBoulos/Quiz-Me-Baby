"use client";
/* THE MARQUEE (the owner, 1 Nov: option 3, "a million dollar game"): the front door's look. A lit sign with
   bulbs round its rounded corners, the name in neon, the slogan on an ivory letter board; a stage behind it
   (searchlights, a glossy floor, drifting dust, a little film grain). Home, Join and the TV lobby use it. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const SLOGAN = "Quiz night done right";
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* MOTION (the owner, 2 Nov): saved per device. "auto" (the default): everything, except on a phone set to Reduce
   Motion, where the lights still chase and sparkle (light changing, nothing moving) but the spotlights, the dust and
   the grain hold still. "on": everything, whatever the phone says. "off": a still, lit sign. */
export type MotionPref = "auto" | "on" | "off";
export type Motion = "full" | "lights" | "off";
const MOTION_KEY = "qmb.motion";
export const getMotionPref = (): MotionPref => { try { const v = localStorage.getItem(MOTION_KEY); return v === "on" || v === "off" ? v : "auto"; } catch { return "auto"; } };
export const setMotionPref = (v: MotionPref) => { try { localStorage.setItem(MOTION_KEY, v); } catch { /* private mode */ } window.dispatchEvent(new Event("qmb:motion")); };
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export function useMotion(): Motion {
  const [m, setM] = useState<Motion>("full");
  useEffect(() => {
    const calc = () => { const p = getMotionPref(); setM(p === "off" ? "off" : p === "on" ? "full" : reduced() ? "lights" : "full"); };
    calc();
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    window.addEventListener("qmb:motion", calc); mq?.addEventListener?.("change", calc);
    return () => { window.removeEventListener("qmb:motion", calc); mq?.removeEventListener?.("change", calc); };
  }, []);
  return m;
}

/* the opening: the bulbs light round the sign, the name flickers on; then the bulbs chase round it, every third
   one lit, stepping like a cinema's; every 10 s the whole sign sparkles, then the chase goes on. The classes go on
   the stage ("m-full" / "m-lights" / "m-off", "lit", "chase", "sparkle") and everything in it follows */
export function useLights(delay = 200) {
  const motion = useMotion();
  const [s, setS] = useState({ lit: false, chase: false, sparkle: false });
  useEffect(() => {
    if (motion === "off") { setS({ lit: true, chase: false, sparkle: false }); return; }
    let off: ReturnType<typeof setTimeout> | undefined;
    const a = setTimeout(() => setS((x) => ({ ...x, lit: true })), delay);
    const b = setTimeout(() => setS((x) => ({ ...x, chase: true })), delay + 2600);
    const sp = setInterval(() => { setS((x) => ({ ...x, sparkle: true })); off = setTimeout(() => setS((x) => ({ ...x, sparkle: false })), 1300); }, 10000);
    return () => { clearTimeout(a); clearTimeout(b); clearInterval(sp); if (off) clearTimeout(off); };
  }, [delay, motion]);
  return " m-" + motion + (s.lit ? " lit" : "") + (s.chase && !s.sparkle ? " chase" : "") + (s.sparkle ? " sparkle" : "");
}

/* the Settings switch for this device */
export function MotionSetting() {
  const [p, setP] = useState<MotionPref>("auto");
  useEffect(() => { setP(getMotionPref()); }, []);
  const pick = (v: MotionPref) => { setP(v); setMotionPref(v); };
  return (
    <div className="flex flex-col gap-2">
      <span><span className="block font-bold text-16">Background motion</span>
        <span className="block text-13 text-[var(--color-ink-2)] mt-0.5">The chasing bulbs, the sparkle and the moving spotlights on the home, join and lobby screens. Auto: all of it, except on a phone set to Reduce Motion, where the bulbs still chase but the spotlights hold still. Saved on this device.</span></span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Background motion">
        {(["auto", "on", "off"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={p === v} className={"btn btn-sm " + (p === v ? "btn-gold" : "btn-ghost")} onClick={() => pick(v)}>
            {v === "auto" ? "Auto" : v === "on" ? "On" : "Off"}</button>))}
      </div>
    </div>);
}

/* bulbs, evenly spaced along a rounded rectangle that follows the sign's own corners */
function Bulbs() {
  const box = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<[number, number][]>([]);
  useIso(() => {
    const el = box.current; if (!el) return;
    const draw = () => {
      const sign = el.parentElement!, fs = parseFloat(getComputedStyle(sign).fontSize) || 100;
      const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
      const gap = Math.max(9, fs * 0.15), r = Math.min(fs * 0.22, w / 2, h / 2), sw = w - 2 * r, sh = h - 2 * r, arc = (Math.PI * r) / 2;
      const L = 2 * sw + 2 * sh + 4 * arc, n = Math.max(8, Math.round(L / gap)), out: [number, number][] = [];
      const segs: [(t: number) => [number, number], number][] = [
        [(t) => [r + t, 0], sw],
        [(t) => { const a = -Math.PI / 2 + t / r; return [w - r + r * Math.cos(a), r + r * Math.sin(a)]; }, arc],
        [(t) => [w, r + t], sh],
        [(t) => { const a = t / r; return [w - r + r * Math.cos(a), h - r + r * Math.sin(a)]; }, arc],
        [(t) => [w - r - t, h], sw],
        [(t) => { const a = Math.PI / 2 + t / r; return [r + r * Math.cos(a), h - r + r * Math.sin(a)]; }, arc],
        [(t) => [0, h - r - t], sh],
        [(t) => { const a = Math.PI + t / r; return [r + r * Math.cos(a), r + r * Math.sin(a)]; }, arc]];
      for (let q = 0; q < n; q++) {
        let d = (q * L) / n;
        for (let z = 0; z < segs.length; z++) { if (d <= segs[z][1] || z === segs.length - 1) { out.push(segs[z][0](Math.min(d, segs[z][1]))); break; } d -= segs[z][1]; }
      }
      setPts(out);
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(el);
    void document.fonts?.ready.then(draw);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="mq-bulbs" ref={box} aria-hidden>
      {pts.map(([x, y], i) => <i key={i} style={{ left: x, top: y, ["--i" as string]: i, ["--g" as string]: i % 3 }} />)}
    </div>);
}

/* the slogan (or a room code) as letter-board tiles */
export function Board({ text }: { text: string }) {
  return (
    <div className="mq-board" aria-label={text}>
      {text.toUpperCase().split(" ").map((w, i) => <span key={i} className="w" aria-hidden>{w.split("").map((c, j) => <span key={j} className="t">{c}</span>)}</span>)}
    </div>);
}

/* the sign: neon: the name flickers on (the home screen's opening); size: its font size (it scales everything) */
export function Sign({ children, slogan, size, neon, className = "" }: { children: ReactNode; slogan?: string; size?: string | number; neon?: boolean; className?: string }) {
  return (
    <div className={"mq-sign " + (neon ? "neon " : "") + className} style={size != null ? { fontSize: size } : undefined}>
      <Bulbs />
      <div className="mq-name">{children}</div>
      {slogan && <Board text={slogan} />}
    </div>);
}

/* the room code (or the code being typed) in lit tiles; cur: the tile the next letter goes in */
export function CodeTiles({ code, cur, className = "" }: { code: string; cur?: number | null; className?: string }) {
  return (
    <div className={"mq-tiles " + className} aria-hidden>
      {[0, 1, 2, 3].map((i) => <span key={i} className={"mq-tile" + (code[i] ? "" : " empty") + (cur === i ? " cur" : "")}>{code[i] || ""}</span>)}
    </div>);
}

/* specks of dust drifting up through the light (paused when the page is hidden; still when asked for less motion) */
function Dust() {
  const ref = useRef<HTMLCanvasElement>(null);
  const motion = useMotion(), still = () => motion !== "full";
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let W = 0, H = 0, raf = 0;
    type P = { x: number; y: number; r: number; v: number; a: number };
    let P: P[] = [];
    const size = () => {
      W = c.width = c.offsetWidth; H = c.height = c.offsetHeight;
      const n = Math.min(70, Math.round((W * H) / 26000));
      P = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, v: Math.random() * 0.25 + 0.05, a: Math.random() * 0.45 + 0.1 }));
    };
    const draw = () => { ctx.clearRect(0, 0, W, H); for (const p of P) { ctx.fillStyle = `rgba(255,230,170,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); } };
    const tick = () => {
      for (const p of P) { p.y -= p.v; p.x += Math.sin(p.y / 60) * 0.15; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } }
      draw(); raf = requestAnimationFrame(tick);
    };
    size();
    if (still()) draw(); else raf = requestAnimationFrame(tick);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !still()) raf = requestAnimationFrame(tick); };
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => { size(); if (still()) draw(); }); ro.observe(c);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); ro.disconnect(); };
  }, [motion]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="mq-dust" aria-hidden />;
}

/* the stage behind everything: searchlights, a glossy floor (big screens), dust, grain and a vignette */
export function MqStage({ floor, beams = true }: { floor?: boolean; beams?: boolean }) {
  return (
    <div className="mq-world" aria-hidden>
      {floor && <div className="mq-floor" />}
      {beams && <><div className="mq-beam l" /><div className="mq-beam r" /></>}
      <Dust />
    </div>);
}
