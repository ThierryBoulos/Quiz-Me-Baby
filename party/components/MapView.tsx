"use client";
import { useEffect, useState } from "react";

/* A map exactly as Classic draws it — pre-drawn by scripts/export-maps.js
   into public/maps/<id>.json (the drawing for play, the one for the reveal,
   and their legends). Our own files, so the markup is trusted. */
type MapFile = { q: string; r: string; lq: string; lr: string; topic: string };
const cache: Record<string, Promise<MapFile>> = {};
const load = (id: string) => (cache[id] ||= fetch(`/maps/${id}.json`).then((r) => r.json()));

export function MapView({ id, reveal, hint, maxH = 420, legend = true }: { id: string; reveal: boolean; hint?: boolean; maxH?: number; legend?: boolean }) {
  const [m, setM] = useState<MapFile | null>(null);
  useEffect(() => { setM(null); void load(id).then(setM); }, [id]);
  if (!m) return <div className="text-center text-[var(--color-ink-3)] py-10">Loading the map…</div>;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="map-box w-full" style={{ maxHeight: maxH }} dangerouslySetInnerHTML={{ __html: reveal ? m.r : m.q }} />
      {legend && <div dangerouslySetInnerHTML={{ __html: reveal ? m.lr : m.lq }} />}
      {hint && !reveal && m.topic && <div className="text-[0.9em] text-[var(--color-ink-2)]">Hint: <b style={{ color: "var(--color-gold)" }}>{m.topic}</b></div>}
    </div>);
}
