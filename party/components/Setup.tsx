"use client";
import { useEffect, useMemo, useState } from "react";
import { loadBank, themeCounts, type Bank } from "@/lib/engine";

export type Cfg = { rounds: number; themes: string[]; difficulty: string; minis: string[] };
const MINIS = [["closest", "Closest To Wins"], ["flag", "Guess the Flag"], ["dish", "Cocktail or Dish"]] as const;
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] as const;
const OFF_BY_DEFAULT = ["Know the Host", "Sexy Time"];

/* The starter's phone, before kick-off: how long, how hard, which themes.
   Three choices, sensible defaults — tap Start and go. */
export function Setup({ onStart, busy, ready, why }: { onStart: (c: Cfg) => void; busy: boolean; ready: boolean; why: string }) {
  const [bank, setBank] = useState<Bank | null>(null);
  const [rounds, setRounds] = useState(6);
  const [difficulty, setDiff] = useState("mixed");
  const [themes, setThemes] = useState<string[] | null>(null);
  const [minis, setMinis] = useState<string[]>(["closest", "flag", "dish"]);
  useEffect(() => { void loadBank().then(setBank); }, []);
  const counts = useMemo(() => (bank ? themeCounts(bank, difficulty) : {}), [bank, difficulty]);
  const avail = useMemo(() => Object.keys(counts).filter((t) => counts[t] >= 2).sort(), [counts]);
  const picked = (themes ?? avail.filter((t) => !OFF_BY_DEFAULT.includes(t))).filter((t) => avail.includes(t));
  const toggle = (t: string) => setThemes(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

  return (
    <section className="card flex flex-col gap-3">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Tonight&rsquo;s game</div>
      <div className="flex gap-2">
        {[4, 6, 8].map((n) => <button key={n} className={"btn btn-sm flex-1 " + (rounds === n ? "btn-gold" : "")} onClick={() => setRounds(n)}>{n} rounds</button>)}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LEVELS.map(([k, l]) => <button key={k} className={"btn btn-sm " + (difficulty === k ? "btn-gold" : "")} onClick={() => setDiff(k)}>{l}</button>)}
      </div>
      <div className="field-label !mb-0">Themes · {picked.length} picked</div>
      <div className="flex flex-wrap gap-2">
        {avail.map((t) => (
          <button key={t} className={"chip " + (picked.includes(t) ? "chip-on" : "")} aria-pressed={picked.includes(t)} onClick={() => toggle(t)}>{t}</button>))}
        {!bank && <span className="text-[13px] text-[var(--color-ink-3)]">Loading the questions…</span>}
      </div>
      <div className="field-label !mb-0">Mini-games</div>
      <div className="flex flex-wrap gap-2">
        {MINIS.map(([k, l]) => (
          <button key={k} className={"chip " + (minis.includes(k) ? "chip-on" : "")} aria-pressed={minis.includes(k)}
            onClick={() => setMinis(minis.includes(k) ? minis.filter((x) => x !== k) : [...minis, k])}>{l}</button>))}
      </div>
      <button className="btn btn-gold btn-lg btn-block mt-1" disabled={!ready || busy || !picked.length}
        onClick={() => onStart({ rounds, difficulty, themes: picked, minis })}>Start the game</button>
      {!ready && <p className="text-center text-[13px] text-[var(--color-ink-3)]">{why}</p>}
    </section>
  );
}
