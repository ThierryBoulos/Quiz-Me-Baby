"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadBank, themeCounts, type Bank } from "@/lib/engine";

export type Cfg = { standard: boolean; rounds: number; themes: string[]; difficulty: string; minis: string[]; miniLevel: string };
const MINIS = [["closest", "Closest To Wins"], ["auction", "The Auction"], ["saysame", "Don't Say the Same"], ["map", "Guess the Map"],
  ["flag", "Guess the Flag"], ["dish", "Cocktail or Dish"], ["battle", "Battle of the Captains"]] as const;
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] as const;
const ROUND_CHOICES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const OFF_BY_DEFAULT = ["Know the Host", "Sexy Time"];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* The starter's phone, before kick-off — Classic's rules: standard trivia
   rounds can be switched off (a mini-games-only night); one theme per round,
   so the number of themes always matches the number of rounds; mini-games
   are their own section. Sensible defaults, so Start works straight away. */
export function Setup({ onStart, busy, ready, why }: { onStart: (c: Cfg) => void; busy: boolean; ready: boolean; why: string }) {
  const [bank, setBank] = useState<Bank | null>(null);
  const [standard, setStandard] = useState(true);
  const [rounds, setRounds] = useState(8);
  const [difficulty, setDiff] = useState("mixed");
  const [themes, setThemes] = useState<string[] | null>(null);
  const [minis, setMinis] = useState<string[]>(["closest", "auction", "saysame", "map", "flag", "dish", "battle"]);
  const [miniLevel, setMiniLevel] = useState("mixed");
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<"themes" | "minis" | null>(null);
  useEffect(() => { void loadBank().then(setBank); }, []);

  /* themes that can field a question for each team at this difficulty */
  const counts = useMemo(() => (bank ? themeCounts(bank, difficulty) : {}), [bank, difficulty]);
  const avail = useMemo(() => Object.keys(counts).filter((t) => counts[t] >= 2).sort(), [counts]);
  /* keep exactly one theme per round: trim when rounds go down, add random ones when they go up */
  useEffect(() => {
    if (!avail.length) return;
    setThemes((cur) => {
      let t = (cur ?? shuffle(avail.filter((x) => !OFF_BY_DEFAULT.includes(x)))).filter((x) => avail.includes(x));
      if (t.length > rounds) t = t.slice(0, rounds);
      const spare = shuffle(avail.filter((x) => !t.includes(x) && !OFF_BY_DEFAULT.includes(x)));
      while (t.length < rounds && spare.length) t = [...t, spare.shift()!];
      return t;
    });
  }, [avail, rounds]);
  const picked = themes ?? [];
  const toggleTheme = (t: string) => {
    setNote(null);
    if (picked.includes(t)) { setThemes(picked.filter((x) => x !== t)); return; }
    if (picked.length >= rounds) { setNote(`That's ${rounds} themes already, one per round. Drop one first, or add a round.`); return; }
    setThemes([...picked, t]);
  };
  const flagsOrDishes = minis.includes("flag") || minis.includes("dish");

  /* what stops the start, in plain words */
  const blocker = !ready ? why
    : standard && picked.length !== rounds ? `Pick ${rounds} themes, one per round (${picked.length} so far).`
    : !standard && !minis.length ? "With no standard rounds, switch on at least one mini-game."
    : "";

  const Fold = ({ id, label, summary, children }: { id: "themes" | "minis"; label: string; summary: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2">
      <button type="button" className="flex items-center justify-between gap-3 min-h-[44px] -mx-1 px-1 rounded-[12px] text-left" aria-expanded={open === id}
        onClick={() => setOpen(open === id ? null : id)}>
        <span><span className="field-label !mb-0">{label}</span><span className="block text-[14px] text-[var(--color-ink-2)] mt-0.5">{summary}</span></span>
        <span className="text-[13px] font-bold shrink-0" style={{ color: "var(--color-gold)" }}>{open === id ? "Done" : "Change"}</span>
      </button>
      {open === id && <div className="flex flex-wrap gap-2 enter">{children}</div>}
    </div>);
  const Levels = ({ value, set, label }: { value: string; set: (v: string) => void; label: string }) => (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <div className="field-label !mb-0">{label}</div>
      <div className="grid grid-cols-4 gap-2">
        {LEVELS.map(([k, l]) => <button key={k} type="button" className={"btn btn-sm !px-2 " + (value === k ? "btn-gold" : "")} aria-pressed={value === k} onClick={() => set(k)}>{l}</button>)}
      </div>
    </div>);

  return (
    <section className="flex flex-col gap-3" aria-label="Tonight's game">
      <div className="eyebrow px-1" style={{ color: "var(--color-gold)" }}>Tonight&rsquo;s game</div>

      {/* ---- STANDARD TRIVIA ROUNDS ---- */}
      <div className="card flex flex-col gap-4" style={{ borderColor: standard ? "color-mix(in srgb, var(--color-gold) 40%, transparent)" : undefined }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="display text-[24px]">Standard rounds</div>
            <div className="text-[13px] text-[var(--color-ink-2)]">Trivia by theme, a question per team, with steals and lifelines.</div>
          </div>
          {/* the switch is 60×34 to look at, with a 64×48 area to tap */}
          <button type="button" role="switch" aria-checked={standard} aria-label="Standard rounds"
            className="shrink-0 w-[64px] h-[48px] grid place-items-center -mr-1 rounded-full" onClick={() => { setStandard(!standard); setNote(null); }}>
            <span className="relative block w-[60px] h-[34px] rounded-full transition-colors" style={{ background: standard ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
              <span className="absolute top-[3px] w-[28px] h-[28px] rounded-full bg-white transition-all" style={{ left: standard ? 29 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
            </span>
          </button>
        </div>
        {standard ? (<>
          <div className="flex flex-col gap-2">
            <label className="field-label !mb-0" htmlFor="rounds">How many rounds?</label>
            <div className="relative">
              <select id="rounds" className="input appearance-none pr-12 cursor-pointer" value={rounds} onChange={(e) => { setRounds(Number(e.target.value)); setNote(null); }}>
                {ROUND_CHOICES.map((n) => <option key={n} value={n}>{n} rounds</option>)}
              </select>
              <svg className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </div>
          <Levels value={difficulty} set={setDiff} label="Difficulty" />
          <Fold id="themes" label="Themes · one per round" summary={!bank ? "Loading the questions…" : `${picked.length} of ${rounds} picked`}>
            {avail.map((t) => (
              <button key={t} type="button" className={"chip " + (picked.includes(t) ? "chip-on" : "")} aria-pressed={picked.includes(t)} onClick={() => toggleTheme(t)}>{t}</button>))}
          </Fold>
          {note && <p className="text-[13px] text-[var(--color-no)]" role="alert">{note}</p>}
        </>) : <p className="text-[14px] text-[var(--color-ink-2)]">Off: tonight is mini-games only, back to back.</p>}
      </div>

      {/* ---- MINI-GAMES ---- */}
      <div className="card flex flex-col gap-4" style={{ borderColor: "color-mix(in srgb, var(--color-a) 35%, transparent)" }}>
        <div>
          <div className="display text-[24px]">Mini-games</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">{standard ? "Spread between the rounds; the Battle closes the night." : "Played one after another."}</div>
        </div>
        <Fold id="minis" label="Which ones" summary={minis.length ? `${minis.length} of ${MINIS.length} on` : "None"}>
          {MINIS.map(([k, l]) => (
            <button key={k} type="button" className={"chip " + (minis.includes(k) ? "chip-on" : "")} aria-pressed={minis.includes(k)}
              onClick={() => setMinis(minis.includes(k) ? minis.filter((x) => x !== k) : [...minis, k])}>{l}</button>))}
        </Fold>
        {flagsOrDishes && <Levels value={miniLevel} set={setMiniLevel} label="Flags & dishes level" />}
      </div>

      <button className="btn btn-gold btn-lg btn-block" disabled={!!blocker || busy}
        onClick={() => onStart({ standard, rounds, difficulty, themes: picked, minis, miniLevel })}>Start the game</button>
      {blocker && <p className="text-center text-[13px] text-[var(--color-ink-2)]" role="status">{blocker}</p>}
    </section>
  );
}
