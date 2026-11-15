"use client";
import { useState } from "react";
import { roundsIn, timesOf } from "@/lib/repeat";

/* REPEAT A THEME (the owner, 15 Nov): a theme can play more than one round, say Geography three times. Every theme
   with a − and a + ; the total is the number of rounds, as with the chips. The deal never repeats a question and
   keeps a theme's rounds apart. The host's (Advanced), and with no host the starting captain's (beside Timers);
   2 teams and 3 to 8, with a TV or none. */
export function RepeatSheet({ themes, counts, picked, rounds, onChange, onClose, eyebrow }: {
  themes: string[]; counts: Record<string, number>; picked: string[]; rounds: number; onChange: (list: string[]) => void; onClose: () => void; eyebrow: string }) {
  const [note, setNote] = useState<string | null>(null);
  const add = (t: string) => {
    if (picked.length >= rounds) { setNote(`That's ${rounds} themes already, one per round. Drop one first, or add a round.`); return; }
    if (timesOf(picked, t) + 1 > roundsIn(counts[t] || 0)) { setNote(`Not enough questions at this level for another ${t} round.`); return; }
    setNote(null); onChange([...picked, t]);
  };
  const drop = (t: string) => { const i = picked.lastIndexOf(t); if (i < 0) return; setNote(null); onChange([...picked.slice(0, i), ...picked.slice(i + 1)]); };
  return (
    <div className="picker fixed inset-0 z-40 flex flex-col" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Repeat a theme">
      <header className="pk-gutter shrink-0 flex items-start justify-between gap-3 pb-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid var(--line)" }}>
        <div className="min-w-0"><div className="eyebrow" style={{ color: "var(--color-gold)" }}>{eyebrow}</div><h2 className="display text-26">Repeat a theme</h2>
          <div className="text-13 mt-0.5" style={{ color: note ? "var(--color-no)" : "var(--color-ink-2)" }} role="status">
            {note || `${picked.length} of ${rounds} picked. A theme can play more than one round, never the same question twice.`}</div></div>
        <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={onClose}>Done</button>
      </header>
      <div className="pk-body pk-gutter flex-1 min-h-0 overflow-y-auto flex flex-col pt-1 pb-6">
        {themes.map((t) => { const n = timesOf(picked, t); return (
          <div key={t} className="flex items-center justify-between gap-3 min-h-[56px] py-1" style={{ borderBottom: "1px solid var(--line)" }} data-theme-row={t}>
            <span className={"min-w-0 text-15 leading-tight " + (n ? "font-bold" : "text-[var(--color-ink-2)]")}>{t}</span>
            <span className="flex items-center gap-2 shrink-0">
              <button type="button" className="btn btn-sm !w-[44px] !min-w-[44px] !px-0" aria-label={`One ${t} round less`} disabled={!n} onClick={() => drop(t)}>−</button>
              <span className="w-[30px] text-center display text-20" style={{ color: n ? "var(--color-gold)" : "var(--color-ink-3)" }} aria-label={`${t}: ${n} round${n === 1 ? "" : "s"}`}>{n ? `×${n}` : "0"}</span>
              <button type="button" className="btn btn-sm !w-[44px] !min-w-[44px] !px-0" aria-label={`One ${t} round more`} onClick={() => add(t)}>+</button>
            </span>
          </div>); })}
      </div>
    </div>);
}
