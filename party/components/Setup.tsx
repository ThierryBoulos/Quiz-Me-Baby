"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QMB, loadBank, themeCounts, withoutHostOnly, type Bank, type Q } from "@/lib/engine";
import { NO_PICKS, Picker, inLevels, pickSummary, type Picks } from "./Picker";
import { getCustom } from "@/lib/custom";

export type Cfg = { standard: boolean; rounds: number; themes: string[]; difficulty: string; minis: string[];
  mapLevels: string[]; flagLevels: string[]; dishLevels: string[]; custom?: Q[] } & Partial<Picks>;
/* Classic's MINI_GAMES (index.html), name and one line each */
const MINIS = [
  ["closest", "Closest To Wins", "Seven numbers. Closest guess wins the leg."],
  ["auction", "The Auction", "Bid how many you can name, then deliver it."],
  ["saysame", "Don't Say the Same as Me", "Answer without matching the app's hidden word."],
  ["map", "Guess the Map", "A map, sixty seconds: what does it show?"],
  ["flag", "Guess the Flag", "Ten flags, fifteen seconds each: whose is it?"],
  ["dish", "Guess the Cocktail or Dish", "The ingredients, one at a time: first captain to call it wins."],
  ["battle", "Battle of the Captains", "Ten each, captains only. Closes the night."]] as const;
/* each picture game has its own levels, as in Classic; more than one can be on */
const MAP_LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;
const FLAG_LEVELS = [["veasy", "Very easy"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
const DISH_LEVELS = { c: [["c-easy", "Easy"], ["c-medium", "Medium"], ["c-hard", "Hard"]], d: [["d-easy", "Easy"], ["d-medium", "Medium"], ["d-hard", "Hard"]] } as const;
const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] as const;
const ROUND_CHOICES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const OFF_BY_DEFAULT = ["Know the Host", "Sexy Time"];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* The starter's phone, before kick-off — Classic's rules: standard trivia
   rounds can be switched off (a mini-games-only night); one theme per round,
   so the number of themes always matches the number of rounds; mini-games
   are their own section. Sensible defaults, so Start works straight away. */
export function Setup({ onStart, busy, ready, why, isHost = false, code }: { onStart: (c: Cfg) => void; busy: boolean; ready: boolean; why: string; isHost?: boolean; code: string }) {
  const [bank, setBank] = useState<Bank | null>(null);
  /* the host's question picker shows the answers: the full bank, which only the host's phone gets */
  const [full, setFull] = useState<Bank | null>(null);
  const [standard, setStandard] = useState(true);
  const [rounds, setRounds] = useState(6);
  const [difficulty, setDiff] = useState("mixed");
  const [themes, setThemes] = useState<string[] | null>(null);
  const [minis, setMinis] = useState<string[]>(["flag", "closest", "auction", "battle"]);
  const [mapLevels, setMapLevels] = useState<string[]>(["easy", "medium", "hard"]);
  const [flagLevels, setFlagLevels] = useState<string[]>(["easy", "medium"]);
  const [dishLevels, setDishLevels] = useState<string[]>(["c-medium", "d-medium"]);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<"themes" | null>(null);
  /* the host's advanced options: hand-picked questions, a difficulty per theme */
  const [picks, setPicks] = useState<Picks>(NO_PICKS);
  const [picking, setPicking] = useState(false);
  useEffect(() => { if (isHost && picking && !full) void loadBank(code).then(setFull).catch(() => setNote("Couldn't load the questions. Try again.")); }, [isHost, picking, full, code]);
  useEffect(() => { void loadBank().then(setBank); }, []);
  /* a level switched off in Setup takes its hand-picked flags, maps and dishes with it */
  useEffect(() => {
    if (!bank) return;
    const lv = { map: mapLevels, flag: flagLevels, dish: dishLevels }, byId = new Map(bank.bank.map((q) => [q.id, q]));
    const keep = (ids: string[]) => ids.filter((id) => { const q = byId.get(id); return !q || inLevels(q, lv); });
    setPicks((p) => {
      const n = { ...p, pickMap: keep(p.pickMap), pickFlag: keep(p.pickFlag), pickDish: keep(p.pickDish) };
      return n.pickMap.length === p.pickMap.length && n.pickFlag.length === p.pickFlag.length && n.pickDish.length === p.pickDish.length ? p : n;
    });
  }, [bank, mapLevels, flagLevels, dishLevels]);

  /* themes that can field a question for each team at this difficulty */
  /* with no host, the questions only a person can judge (and "Know the Host") are left out */
  const counts = useMemo(() => (bank ? themeCounts(isHost ? bank : withoutHostOnly(bank), difficulty) : {}), [bank, difficulty, isHost]);
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
  /* what each mini-game is worth, and where it falls in the night (Classic's setup) */
  const miniKeys = MINIS.map(([k]) => k as string).filter((k) => minis.includes(k));
  const battle = miniKeys.includes("battle");
  const each = QMB.miniPointValue(standard ? rounds : 0, miniKeys.length, battle) || 2;
  const worth = (k: string) => (k === "battle" ? 2 * each : each);   // the Battle pays double
  const plan: { key: string; after: number }[] = QMB.planMinis(standard ? rounds : 0, (QMB.INTERLEAVED as string[]).filter((k) => miniKeys.includes(k)));
  const slot = (k: string) => k === "battle" ? "last" : standard ? (plan.find((p) => p.key === k) ? `after R${plan.find((p) => p.key === k)!.after + 1}` : "")
    : ["1st", "2nd", "3rd", "4th", "5th", "6th"][miniKeys.filter((x) => x !== "battle").indexOf(k)] || "";
  /* a level row: tap to add or drop a level; the last one can't be dropped */
  const LevelRow = ({ label, opts, value, set, tag }: { label: string; opts: readonly (readonly [string, string])[]; value: string[]; set: (v: string[]) => void; tag?: string }) => (
    <div className="flex flex-wrap items-center gap-2 pl-1 pb-2" role="group" aria-label={label}>
      {tag && <span className="eyebrow !text-[11px] basis-full">{tag}</span>}
      {opts.map(([k, l]) => { const on = value.includes(k); return (
        <button key={k} type="button" className={"chip !min-h-[44px] !px-3 !text-[13px] " + (on ? "chip-on" : "")} aria-pressed={on}
          onClick={() => { const next = on ? value.filter((x) => x !== k) : [...value, k]; if (next.length) set(opts.map(([x]) => x).filter((x) => next.includes(x))); }}>{l}</button>); })}
    </div>);
  const half = picked.filter((t) => (picks.picks[t] || []).length === 1);

  /* what stops the start, in plain words */
  const blocker = !ready ? why
    : standard && picked.length !== rounds ? `Pick ${rounds} themes, one per round (${picked.length} so far).`
    : !standard && !minis.length ? "With no standard rounds, switch on at least one mini-game."
    : "";

  const Fold = ({ id, label, summary, children }: { id: "themes"; label: string; summary: string; children: ReactNode }) => (
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

      {/* ---- MINI-GAMES: Classic's list, every game on show with its own levels ---- */}
      <div className="card flex flex-col gap-2" style={{ borderColor: "color-mix(in srgb, var(--color-a) 35%, transparent)" }}>
        <div className="mb-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="display text-[24px]">Mini-games</div>
            <span className={"badge shrink-0 " + (miniKeys.length ? "gold" : "line")}>{miniKeys.length ? `${miniKeys.reduce((n, k) => n + worth(k), 0)} pts on the table` : "None"}</span>
          </div>
          <div className="text-[13px] text-[var(--color-ink-2)]">{standard ? "Spread between the rounds; the Battle closes the night." : "Played one after another."}</div>
        </div>
        {MINIS.map(([k, name, blurb]) => { const on = minis.includes(k); return (
          <div key={k}>
            <button type="button" role="switch" aria-checked={on} data-mini={k} className="flex items-center justify-between gap-3 w-full text-left min-h-[56px] py-1.5"
              onClick={() => setMinis(on ? minis.filter((x) => x !== k) : [...minis, k])}>
              <span className="min-w-0"><span className="block font-bold text-[15px] leading-tight">{name}</span>
                <span className="block text-[12.5px] text-[var(--color-ink-2)] leading-snug mt-0.5">{blurb}{on && <b style={{ color: "var(--color-gold)" }}> {worth(k)} pts{slot(k) ? ` · ${slot(k)}` : ""}</b>}</span></span>
              <span className="relative shrink-0 block w-[48px] h-[28px] rounded-full transition-colors" style={{ background: on ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
                <span className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: on ? 23 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
              </span>
            </button>
            {on && k === "map" && <LevelRow label="Guess the Map level" opts={MAP_LEVELS} value={mapLevels} set={setMapLevels} />}
            {on && k === "flag" && <LevelRow label="Guess the Flag level" opts={FLAG_LEVELS} value={flagLevels} set={setFlagLevels} />}
            {on && k === "dish" && (<>
              <LevelRow label="Cocktail levels" tag="Cocktails" opts={DISH_LEVELS.c} value={dishLevels.filter((l) => l[0] === "c")}
                set={(v) => setDishLevels([...v, ...dishLevels.filter((l) => l[0] === "d")])} />
              <LevelRow label="Dish levels" tag="Dishes" opts={DISH_LEVELS.d} value={dishLevels.filter((l) => l[0] === "d")}
                set={(v) => setDishLevels([...dishLevels.filter((l) => l[0] === "c"), ...v])} />
            </>)}
          </div>); })}
      </div>

      {/* ---- ADVANCED: the host only (it shows the answers) ---- */}
      {isHost && bank && (
        <div className="card flex flex-col gap-3">
          <div>
            <div className="display text-[24px]">Advanced</div>
            <div className="text-[13px] text-[var(--color-ink-2)]">Host only. {pickSummary(picks, standard ? picked : [], minis)}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-sm" onClick={() => setPicking(true)}>Choose questions</button>
            {(Object.keys(picks.picks).length > 0 || Object.keys(picks.themeDiff).length > 0) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicks(NO_PICKS)}>Clear all picks</button>}
          </div>
        </div>)}
      {picking && full && <Picker bank={full} themes={standard ? picked : []} minis={minis} difficulty={difficulty} levels={{ map: mapLevels, flag: flagLevels, dish: dishLevels }} value={picks} onChange={setPicks} onClose={() => setPicking(false)} />}

      <button className="btn btn-gold btn-lg btn-block dock" disabled={!!blocker || busy}
        onClick={() => onStart({ standard, rounds, difficulty, themes: picked, minis, mapLevels, flagLevels, dishLevels, custom: getCustom(),
          ...(isHost ? { ...picks, picks: Object.fromEntries(Object.entries(picks.picks).filter(([t]) => picked.includes(t))) } : {}) })}>Start the game</button>
      {blocker && <p className="text-center text-[13px] text-[var(--color-ink-2)]" role="status">{blocker}</p>}
      {isHost && half.length > 0 && <p className="text-center text-[13px] text-[var(--color-no)]" role="status">{half.join(", ")} {half.length > 1 ? "have" : "has"} only one question ticked; {half.length > 1 ? "they fall" : "it falls"} back to a random pair.</p>}
    </section>
  );
}
