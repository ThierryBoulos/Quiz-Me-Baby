"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* A map exactly as Classic draws it — pre-drawn by scripts/export-maps.js
   into public/maps/<id>.json (the drawing for play, the one for the reveal,
   and their legends). Our own files, so the markup is trusted. */
type MapFile = { q: string; r: string; lq: string; lr: string; topic: string };
const cache: Record<string, Promise<MapFile>> = {};
/* the ones already here: drawn straight away, with no "Loading" frame in between */
const ready: Record<string, MapFile> = {};
/* a download that failed (one bad request on party Wi-Fi) is forgotten, so the next ask tries again */
const load = (id: string) => (cache[id] ||= fetch(`/maps/${id}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  .then((m: MapFile) => (ready[id] = m)).catch((e) => { delete cache[id]; throw e; }));
/* fetched ahead (usePreload), so the map is there the moment it's asked */
export const preloadMap = (id: string) => { void load(id).catch(() => { /* tried again when the map is shown */ }); };

/* wipe: the TV, where the answer's drawing is laid ready under the question's and, on the reveal, simply
   shows over it (no reloading, no flash in between) */
export function MapView({ id, reveal, hint, maxH = 420, legend = true, title, wipe }: { id: string; reveal: boolean; hint?: boolean; maxH?: number; legend?: boolean; title?: string; wipe?: boolean }) {
  const [m, setM] = useState<MapFile | null>(() => ready[id] || null);
  const [big, setBig] = useState(false);
  /* not here yet: fetched, and fetched again every few seconds until it comes (29 Oct: one failed download
     left "Loading the map…" up for the whole leg) */
  useEffect(() => {
    if (ready[id]) { setM(ready[id]); return; }
    setM(null);
    let on = true, t: ReturnType<typeof setTimeout> | undefined;
    const go = () => { void load(id).then((m) => { if (on) setM(m); }).catch(() => { if (on) t = setTimeout(go, 3000); }); };
    go();
    return () => { on = false; clearTimeout(t); };
  }, [id]);
  /* a new map, or the reveal: the enlarged one closes (the phone's answer box is underneath) */
  useEffect(() => { setBig(false); }, [id, reveal]);
  if (!m) return <div className="flex flex-col items-center gap-3 py-10 text-[var(--color-ink-3)]" aria-busy="true"><div className="spinner" />Loading the map…</div>;
  const html = reveal ? m.r : m.q;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <button type="button" className="map-frame" onClick={() => setBig(true)} aria-label="Enlarge the map">
        {wipe ? (
          <div className="relative w-full">
            <div className="map-box w-full" style={{ maxHeight: maxH }} dangerouslySetInnerHTML={{ __html: m.q }} />
            <div className={"map-box map-wipe w-full absolute inset-0" + (reveal ? " on" : "")} style={{ maxHeight: maxH }} aria-hidden={!reveal} dangerouslySetInnerHTML={{ __html: m.r }} />
          </div>
        ) : <div className="map-box w-full" style={{ maxHeight: maxH }} dangerouslySetInnerHTML={{ __html: html }} />}
        <span className="map-enlarge">Enlarge</span>
      </button>
      {legend && <div dangerouslySetInnerHTML={{ __html: reveal ? m.lr : m.lq }} />}
      {hint && !reveal && m.topic && <div className="text-[0.9em] text-[var(--color-ink-2)]">Hint: <b style={{ color: "var(--color-gold)" }}>{m.topic}</b></div>}
      {big && <MapZoom html={html} legend={reveal ? m.lr : m.lq} title={reveal && title ? title : "What does this map show?"} onClose={() => setBig(false)} />}
    </div>);
}

/* Classic's enlarged map (index.html, openMapZoom): it fills the screen.
   Tap a spot to zoom in there, drag to look around, tap again to zoom out.
   Pinch (two fingers) and the mouse wheel zoom too. The page itself can't
   be pinched (NoZoom), so the map does it on its own. */
const Z_TAP = 2.6, Z_MAX = 6;
function MapZoom({ html, legend, title, onClose }: { html: string; legend: string; title: string; onClose: () => void }) {
  const stage = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const v = useRef({ z: 1, tx: 0, ty: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<null | { x: number; y: number; tx: number; ty: number; moved: boolean }>(null);
  const pinch = useRef<null | { d: number; z: number; cx: number; cy: number }>(null);
  const pinched = useRef(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const local = (x: number, y: number) => { const r = stage.current!.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
  const apply = (anim = false) => {
    const el = inner.current, s = stage.current; if (!el || !s) return;
    const V = v.current, w = s.clientWidth, h = s.clientHeight;
    V.z = Math.min(Z_MAX, Math.max(1, V.z));
    V.tx = Math.min(0, Math.max(w - w * V.z, V.tx)); V.ty = Math.min(0, Math.max(h - h * V.z, V.ty));
    el.style.transition = anim ? "transform .25s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = V.z === 1 ? "" : `translate(${V.tx}px,${V.ty}px) scale(${V.z})`;
  };
  /* zoom to z, keeping the content under (px, py) where it is */
  const zoomAt = (z: number, px: number, py: number, anim = false) => {
    const V = v.current, cx = (px - V.tx) / V.z, cy = (py - V.ty) / V.z;
    V.z = Math.min(Z_MAX, Math.max(1, z)); V.tx = px - cx * V.z; V.ty = py - cy * V.z; apply(anim);
  };
  const two = () => { const [a, b] = [...ptrs.current.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

  const down = (e: React.PointerEvent) => {
    try { stage.current?.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows */ }
    const p = local(e.clientX, e.clientY);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) { pinched.current = false; drag.current = { x: p.x, y: p.y, tx: v.current.tx, ty: v.current.ty, moved: false }; }
    if (ptrs.current.size === 2) {
      const t = two(), V = v.current;
      pinch.current = { d: t.d || 1, z: V.z, cx: (t.x - V.tx) / V.z, cy: (t.y - V.ty) / V.z };
      pinched.current = true; drag.current = null;
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = local(e.clientX, e.clientY);
    ptrs.current.set(e.pointerId, p);
    const P = pinch.current;
    if (P && ptrs.current.size >= 2) {
      const t = two(), V = v.current;
      V.z = Math.min(Z_MAX, Math.max(1, P.z * (t.d / P.d))); V.tx = t.x - P.cx * V.z; V.ty = t.y - P.cy * V.z; apply();
      return;
    }
    const D = drag.current;
    if (!D) return;
    const dx = p.x - D.x, dy = p.y - D.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) D.moved = true;
    if (v.current.z > 1) { v.current.tx = D.tx + dx; v.current.ty = D.ty + dy; apply(); }
  };
  const up = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId) || local(e.clientX, e.clientY);
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 1) {
      /* one finger left after a pinch: it drags on from where it is, no jump */
      pinch.current = null;
      const [q] = [...ptrs.current.values()];
      drag.current = { x: q.x, y: q.y, tx: v.current.tx, ty: v.current.ty, moved: true };
      return;
    }
    if (ptrs.current.size > 0) return;
    pinch.current = null;
    const D = drag.current; drag.current = null;
    if (pinched.current || !D || D.moved) return;
    /* a tap: zoom in there, or back out */
    if (v.current.z > 1) { v.current = { z: 1, tx: 0, ty: 0 }; apply(true); }
    else zoomAt(Z_TAP, p.x, p.y, true);
  };
  const wheel = (e: React.WheelEvent) => { const p = local(e.clientX, e.clientY); zoomAt(v.current.z * Math.exp(-e.deltaY * 0.0025), p.x, p.y); };

  return createPortal(
    <div className="mapzoom enter" role="dialog" aria-modal="true" aria-label="The map, enlarged">
      <div className="mz-top">
        <span className="eyebrow">{title}</span>
        <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close the enlarged map">Close</button>
      </div>
      <div className="mz-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        <div className="mz-inner" ref={inner} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: legend }} />
      <p className="mz-help">Tap to zoom in &middot; pinch &middot; drag to look around &middot; tap again to zoom out</p>
    </div>, document.body);
}
