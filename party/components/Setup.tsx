"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadBank, themeCounts, type Bank } from "@/lib/engine";

export type Cfg = { rounds: number; themes: string[]; difficulty: string; minis: string[] };
const MINIS = [["closest", "Closest To Wins"], ["auction", "The Auction"], ["saysame", "Don't Say the Same"], ["map", "Guess the Map"], ["flag", "Guess the Flag"], ["dish", "Cocktail or Dish"], ["battle", "Battle of the Captains"]] as const;
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] as const;
const OFF_BY_DEFAULT = ["Know the Host", "Sexy Time"];

/* The starter's phone, before kick-off: how long, how hard, which themes.
   Three choices, sensible defaults — tap Start and go. */
export function Setup({ onStart, busy, ready, why }: { onStart: (c: Cfg) => void; busy: boolean; ready: boolean; why: string }) {
  const [bank, setBank] = useState<Bank | null>(null);
  const [rounds, setRounds] = useState(6);
  const [difficulty, setDiff] = useState("mixed");
  const [themes, setThemes] = useState<string[] | null>(null);
  const [minis, setMinis] = useState<string[]>(["closest", "auction", "saysame", "map", "flag", "dish", "battle"]);
  useEffect(() => { void loadBank().then(setBank); }, []);
  const counts = useMemo(() => (bank ? themeCounts(bank, difficulty) : {}), [bank, difficulty]);
  const avail = useMemo(() => Object.keys(counts).filter((t) => counts[t] >= 2).sort(), [counts]);
  const picked = (themes ?? avail.filter((t) => !OFF_BY_DEFAULT.includes(t))).filter((t) => avail.includes(t));
  const toggle = (t: string) => setThemes(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

  /* themes and mini-games start folded to one line each: sensible defaults
     are already picked, so "Start the game" is on screen straight away */
  const [open, setOpen] = useState<"themes" | "minis" | null>(null);
  const Fold = ({ id, label, summary, children }: { id: "themes" | "minis"; label: string; summary: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2">
      <button type="button" className="flex items-center justify-between min-h-[44px] -mx-1 px-1 rounded-[12px] text-left" aria-expanded={open === id}
        onClick={() => setOpen(open === id ? null : id)}>
        <span><span className="field-label !mb-0 inline">{label}</span><span className="block text-[14px] text-[var(--color-ink-2)] mt-0.5">{summary}</span></span>
        <span className="text-[13px] font-bold" style={{ color: "var(--color-gold)" }}>{open === id ? "Done" : "Change"}</span>
      </button>
      {open === id && <div className="flex flex-wrap gap-2 enter">{children}</div>}
    </div>);

  return (
    <section className="card flex flex-col gap-4">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Tonight&rsquo;s game</div>
      <div className="flex flex-col gap-2">
        <div className="field-label !mb-0">Rounds</div>
        <div className="grid grid-cols-3 gap-2">
          {[4, 6, 8].map((n) => <button key={n} className={"btn btn-sm " + (rounds === n ? "btn-gold" : "")} aria-pressed={rounds === n} onClick={() => setRounds(n)}>{n}</button>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="field-label !mb-0">Difficulty</div>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map(([k, l]) => <button key={k} className={"btn btn-sm !px-2 " + (difficulty === k ? "btn-gold" : "")} aria-pressed={difficulty === k} onClick={() => setDiff(k)}>{l}</button>)}
        </div>
      </div>
      <Fold id="themes" label="Themes" summary={!bank ? "Loading the questions…" : `${picked.length} of ${avail.length} picked`}>
        {avail.map((t) => (
          <button key={t} className={"chip " + (picked.includes(t) ? "chip-on" : "")} aria-pressed={picked.includes(t)} onClick={() => toggle(t)}>{t}</button>))}
      </Fold>
      <Fold id="minis" label="Mini-games" summary={minis.length ? `${minis.length} of ${MINIS.length} on` : "None: just the rounds"}>
        {MINIS.map(([k, l]) => (
          <button key={k} className={"chip " + (minis.includes(k) ? "chip-on" : "")} aria-pressed={minis.includes(k)}
            onClick={() => setMinis(minis.includes(k) ? minis.filter((x) => x !== k) : [...minis, k])}>{l}</button>))}
      </Fold>
      <button className="btn btn-gold btn-lg btn-block" disabled={!ready || busy || !picked.length}
        onClick={() => onStart({ rounds, difficulty, themes: picked, minis })}>Start the game</button>
      {!ready && <p className="text-center text-[13px] text-[var(--color-ink-2)]" role="status">{why}</p>}
      {ready && !picked.length && <p className="text-center text-[13px] text-[var(--color-no)]" role="alert">Pick at least one theme.</p>}
    </section>
  );
}
