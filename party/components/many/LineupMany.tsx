"use client";
import { LevelNote } from "../LevelNote";
import type { FreshLeft } from "@/lib/freshLeft";
/* MANY TEAMS: the lobby's line-up (components/Lineup.tsx, for N teams), the phone's team buttons when there
   are more than two, and the host's setup (components/Setup.tsx: the same card, switches and chips, with the
   four games that work for any number of teams). */
import { useEffect, useMemo, useState } from "react";
import { adoptDraft, useDraft, useDraftHost } from "@/lib/setupDraft";
import type { TvShare } from "@/lib/game";
import { NO_PICKS, Picker, pickSummary, type Picks } from "../Picker";
import { TvSettings } from "../TvSettings";
import { useNoTv } from "../NoTv";
import type { Member, Room } from "@/lib/room";
import { HOST_ONLY_THEMES, QMB, loadBank, themeCounts, withCustom, type Bank } from "@/lib/engine";
import { cleanList, getCustom } from "@/lib/custom";
import { MANY_COLORS, MANY_LEGS, MANY_MINIS, MANY_ROUNDS, MANY_TITLES, PLACE_PTS, lineup, type ManyKey } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";
import { colsFor, Dot, place as ordinal } from "./PartsMany";
import { levelLine, SEE_KIND_OPTS } from "../Setup";

/* every team, every face, the captains marked. The TV (big) packs up to four in a row, then rows of three or four;
   the phones stack them. away: captains the TV hasn't heard from (the lobby). */
export function LineupMany({ room, members, k, big }: { room: Room; members: Member[]; k: number; big?: boolean }) {
  const names = manyNames(room, k), away = ((room.state?.away as string[] | undefined) || []);
  const cols = big ? colsFor(k) : 1, dense = big && k > 4, gap = dense ? 14 : 24;
  /* the name on a line of its own, the width of the card (the owner, 31 Oct: beside the count it shrank to "TE…") */
  const nameSize = !big ? 24 : k <= 3 ? 36 : k <= 4 ? 30 : k <= 6 ? 28 : 24;
  return (
    <div className={big ? "flex flex-wrap justify-center" : "grid grid-cols-1 gap-3"} style={big ? { gap } : undefined}>
      {names.map((name, t) => {
        const c = MANY_COLORS[t];
        const list = members.filter((m) => (m.team as number) === t).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0));
        return (
          <div key={t} className="card min-w-0" style={{ borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, ...(big ? { flex: `0 0 calc((100% - ${(cols - 1) * gap}px) / ${cols})`, padding: dense ? "12px 14px" : undefined } : {}) }}>
            <div className={dense ? "mb-2" : "mb-3"}>
              <div className="flex items-center gap-2 min-w-0"><Dot t={t} color={c} size={!big ? 20 : dense ? 22 : 26} />
                <div className="display truncate leading-tight" style={{ color: c, fontSize: name.length > 10 ? ({ 36: 30, 30: 26, 28: 24, 24: 20 } as Record<number, number>)[nameSize] : nameSize }}><bdi>{name}</bdi></div></div>
              <div className={"eyebrow mt-1 " + (dense ? "text-12" : "")}>{list.length} {list.length === 1 ? "player" : "players"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {list.length === 0 && <span className="text-[var(--color-ink-3)]" style={{ fontSize: big ? (dense ? 16 : 22) : 14 }}>Nobody yet</span>}
              {list.map((m) => (
                <span key={m.user_id} className="chip team pop-in" style={{ ["--c" as string]: c, ...(big ? { fontSize: dense ? 15 : 22, padding: dense ? "6px 12px 6px 6px" : "8px 18px 8px 8px" } : {}) }}>
                  <span className="face" style={big ? (dense ? { width: 30, height: 30, fontSize: 18 } : { width: 44, height: 44, fontSize: 28 }) : undefined}>{m.avatar || "🙂"}</span>
                  <bdi>{m.name}</bdi>
                  {m.role === "captain" && <span className="cap">Captain</span>}
                  {m.role === "captain" && room.status === "lobby" && away.includes(m.user_id) && <span className="cap" style={{ background: "var(--color-no)" }}>away</span>}
                </span>))}
            </div>
          </div>);
      })}
    </div>);
}

/* the phone's team buttons when there are more than two: the two-team "Team A" / "Team B" pills, two to a row */
/* (the marquee's tickets, 2 Nov: the team's colour lit round it, its name big, how many are on it so far) */
export function PickMany({ room, k, busy, pick, current, members }: { room: Room; k: number; busy: boolean; pick: (t: number | null) => void; current?: number | null; members?: Member[] }) {
  const names = manyNames(room, k);
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pick a team">
      {names.map((name, t) => { const c = MANY_COLORS[t], n = members?.filter((m) => (m.team as number) === t && m.role !== "host").length; return (
        <button key={t} className={"mq-pick sm min-w-0" + (current === t ? " on" : "")} disabled={busy || current === t} aria-pressed={current === t} aria-label={`${"ABCDEFGH"[t]} · ${name}`} onClick={() => pick(t)}
          style={{ ["--c" as string]: c }}>
          <span className="flex items-center gap-2 min-w-0 max-w-full"><Dot t={t} color={c} size={20} /><span className={"tn truncate" + (name.length > 10 ? " long" : "")}><bdi>{name}</bdi></span></span>
          {n != null && <small>{current === t ? "You\u2019re here" : n === 0 ? "Nobody yet" : `${n} ${n === 1 ? "player" : "players"}`}</small>}</button>); })}
    </div>);
}

/* ---- the host's setup when there are more than two teams: Setup's mini-games card, with the games that work for
   any number of teams, each with its levels; the Start button docked under it ---- */
const GAMES: [ManyKey, string][] = [
  ["quiz", "Rounds of 2 questions on one theme. Captains type; the fastest right answer scores most."],
  ["majority", "Everyone answers on their own phone. 15 questions, 4 answers each."],
  ["flag", "10 flags. Captains type the country; the fastest right answer scores most."],
  ["closest", "5 number questions. The closest guess scores most."],
  ["pin", "7 famous places. Captains drop a pin; the closest scores most."],
  ["airport", "6 departure boards. Captains type the airport; the fastest right answer scores most."],
  ["map", "6 maps with places marked. Captains type what they have in common."],
  ["say", "6 questions with many answers. No points for the app's secret answer, or another team's."],
  ["dish", "5 recipes, one ingredient at a time. One guess per team; the faster right, the more points."],
  ["see", "7 pictures: a face, a logo or a close-up, getting clearer. One guess per team; the faster right, the more points."],
  ["roulette", "3 spins of the barrel. Every team gets its own chamber and question; one chamber is the bullet."],
  /* (listed last, the night's last game: 11 Nov, the owner) */
  ["stakes", "The night's last game."]];
const LEVELS4 = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
const LEVELS3 = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;
const COCKTAILS = [["c-easy", "Easy"], ["c-medium", "Medium"], ["c-hard", "Hard"]] as const, DISHES = [["d-easy", "Easy"], ["d-medium", "Medium"], ["d-hard", "Hard"]] as const;
/* themes the 3-8 team night never offers: the host's own (a captain can't know their answers); and those off until the host
   picks them, as with two teams (11 Nov, the owner: the same game) */
const NO_THEMES = [...HOST_ONLY_THEMES];
const OFF_BY_DEFAULT = ["Sexy Time", "Lebanon"];
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
/* the 3-8 night's lengths, for the picker (each game's own) */
const CAPS = { closest: MANY_LEGS.closest, saysame: MANY_LEGS.say, map: MANY_LEGS.map, flag: MANY_LEGS.flag, dish: MANY_LEGS.dish, pin: MANY_LEGS.pin, airport: MANY_LEGS.airport, majority: MANY_LEGS.majority };
const FLAG_LEVELS = [["veasy", "Very easy"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
export type CfgMany = { minis: string[]; flagLevels: string[]; pinLevels: string[]; majorityLevels: string[]; rounds: number; quizLevels: string[]; themes: string[];
  airportLevels: string[]; mapLevels: string[]; dishLevels: string[]; seeLevels?: string[]; seeKinds?: string[]; custom?: unknown[] } & Partial<Picks>;

export function SetupMany({ busy, why, k, onStart, code, tv, left }: { busy: boolean; why: string; k: number; onStart: (cfg: CfgMany) => void; code: string; tv?: TvShare; left?: FreshLeft }) {
  const noTv = useNoTv();
  /* every choice is kept (lib/setupDraft.ts), as with two teams: the team count changing, a reload, another phone
     taking over as host (11 Nov, the owner) */
  useDraftHost(code, true);
  useEffect(() => { if (tv?.draft) adoptDraft(code, tv.draft); }, [code, tv?.draft]);
  /* on to start with: the standard rounds and the first four games; the rest are a tap away */
  const [minis, setMinis] = useDraft<string[]>(code, "many.minis", ["quiz", "majority", "flag", "closest", "pin"]);
  /* standard rounds: one theme each, 1 to 14, played two at a time (the default night is the same as before: six) */
  const [rounds, setRounds] = useDraft(code, "many.rounds", 6);
  const [quizLevels, setQuizLevels] = useDraft<string[]>(code, "many.quizLevels", ["easy", "medium", "hard"]);
  const [airportLevels, setAirportLevels] = useDraft<string[]>(code, "many.airportLevels", [...QMB.AIRPORT_ORDER as string[]]);
  const [mapLevels, setMapLevels] = useDraft<string[]>(code, "many.mapLevels", [...QMB.MAP_ORDER as string[]]);
  const [dishLevels, setDishLevels] = useDraft<string[]>(code, "many.dishLevels", ["c-medium", "d-medium"]);
  /* the rounds' themes, one per round: the bank's themes with questions at tonight's levels (the host's own too), as
     many picked at random to start as there are rounds */
  const [mine, setBank] = useState<Bank | null>(null);
  useEffect(() => {
    const pull = () => void loadBank().then(setBank).catch(() => {});
    pull(); window.addEventListener("qmb:custom", pull);
    return () => window.removeEventListener("qmb:custom", pull);
  }, []);
  /* the TV's own questions, shared with the host, join the list as with two teams */
  const tvQs = useMemo(() => cleanList(tv?.custom).map((q) => ({ ...q, onTv: true })), [tv?.custom]);
  const bank = useMemo(() => (mine && tvQs.length ? withCustom(mine, tvQs) : mine), [mine, tvQs]);
  const counts = useMemo(() => (bank ? themeCounts(bank, quizLevels.join("+")) : {}) as Record<string, number>, [bank, quizLevels]);
  const avail = useMemo(() => Object.keys(counts).filter((t) => counts[t] >= 2 && !NO_THEMES.includes(t)).sort(), [counts]);
  const [themes, setThemes] = useDraft<string[] | null>(code, "many.themes", null);
  /* exactly one theme per round: trimmed when the rounds go down, topped up at random when they go up */
  useEffect(() => {
    if (!avail.length) return;
    setThemes((cur) => {
      let t = (cur ?? shuffle(avail.filter((x) => !OFF_BY_DEFAULT.includes(x)))).filter((x) => avail.includes(x));
      if (t.length > rounds) t = t.slice(0, rounds);
      const spare = shuffle(avail.filter((x) => !t.includes(x) && !OFF_BY_DEFAULT.includes(x)));
      while (t.length < rounds && spare.length) t = [...t, spare.shift()!];
      return t;
    });
  }, [avail, rounds, setThemes]);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const picked = themes ?? [];
  const [flagLevels, setFlagLevels] = useDraft<string[]>(code, "many.flagLevels", ["veasy", "easy", "medium", "hard"]);
  const [pinLevels, setPinLevels] = useDraft<string[]>(code, "many.pinLevels", [...QMB.PIN_ORDER as string[]]);
  const [majorityLevels, setMajorityLevels] = useDraft<string[]>(code, "many.majorityLevels", [...QMB.MAJORITY_ORDER as string[]]);
  const [seeLevels, setSeeLevels] = useDraft<string[]>(code, "many.seeLevels", ["easy", "medium", "hard"]);
  const [seeKinds, setSeeKinds] = useDraft<string[]>(code, "many.seeKinds", ["face", "logo", "close"]);
  /* the host's Advanced, as with two teams: hand-picked questions, a difficulty per theme, the TV's settings */
  const [picks, setPicks] = useDraft<Picks>(code, "picks", NO_PICKS);
  const [full, setFull] = useState<Bank | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  useEffect(() => { if (choosing && !full) void loadBank(code).then(setFull).catch(() => setNote("Couldn't load the questions. Try again.")); }, [choosing, full, code]);
  useEffect(() => {
    const pull = () => { if (full) void loadBank(code).then(setFull).catch(() => {}); };
    window.addEventListener("qmb:custom", pull);
    return () => window.removeEventListener("qmb:custom", pull);
  }, [full, code]);
  const fullAll = useMemo(() => (full && tvQs.length ? withCustom(full, tvQs) : full), [full, tvQs]);
  const pickMinis = minis.map((x) => (x === "say" ? "saysame" : x));
  const toggleTheme = (t: string) => {
    setNote(null);
    if (picked.includes(t)) { setThemes(picked.filter((x) => x !== t)); return; }
    if (picked.length >= rounds) { setNote(`That's ${rounds} themes already, one per round. Drop one first, or add a round.`); return; }
    setThemes([...picked, t]);
  };
  const on = MANY_MINIS.filter((x) => minis.includes(x));
  /* the order they'll play in: the standard rounds spread through the night, two at a time */
  const night = lineup(on.includes("quiz") ? Math.ceil(rounds / 2) : 0, on.filter((x) => x !== "quiz"));
  const slot = (x: string) => { const at = night.map((y, i) => (y === x ? i + 1 : 0)).filter(Boolean); return at.length ? at.map((n) => ordinal(n)).join(", ") : ""; };
  const blocker = why || (!on.length ? "Switch on at least one game." : on.includes("quiz") && bank && picked.length !== rounds ? `Pick ${rounds} themes, one per round (${picked.length} so far).` : "");
  /* a level row: tap to add or drop a level; the last one can't be dropped */
  const LevelRow = ({ label, opts, value, set }: { label: string; opts: readonly (readonly [string, string])[]; value: string[]; set: (v: string[]) => void }) => (
    <div className="lvl-row" role="group" aria-label={label}>
      {opts.map(([key, l]) => { const lit = value.includes(key); return (
        <button key={key} type="button" className={"chip " + (lit ? "chip-on" : "")} aria-pressed={lit}
          onClick={() => { const next = lit ? value.filter((x) => x !== key) : [...value, key]; if (next.length) set(opts.map(([x]) => x).filter((x) => next.includes(x))); }}>{l}</button>); })}
    </div>);
  return (
    <section className="flex flex-col gap-3" aria-label="Tonight's game">
      <div className="eyebrow px-1" style={{ color: "var(--color-gold)" }}>Tonight&rsquo;s game</div>
      <div className="card flex flex-col gap-2" style={{ borderColor: "color-mix(in srgb, var(--color-a) 35%, transparent)" }}>
        <div className="mb-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="display text-24">Mini-games</div>
            <span className={"badge shrink-0 " + (night.length ? "gold" : "line")}>{night.length ? `${night.length} game${night.length === 1 ? "" : "s"}` : "None"}</span>
          </div>
          <div className="text-13 text-[var(--color-ink-2)]">Every team plays every game at the same time. At the end of each game, 1st place adds <b style={{ color: "var(--color-gold)" }}>{PLACE_PTS[0]}</b> to the night, 2nd <b style={{ color: "var(--color-gold)" }}>{PLACE_PTS[1]}</b>, 3rd <b style={{ color: "var(--color-gold)" }}>{PLACE_PTS[2]}</b>{k > 3 ? "…" : "."}</div>
        </div>
        {GAMES.map(([key, blurb]) => { const lit = minis.includes(key); return (
          <div key={key}>
            <button type="button" role="switch" aria-checked={lit} data-mini={key} className="flex items-center justify-between gap-3 w-full text-left min-h-[56px] py-1.5"
              onClick={() => setMinis(lit ? minis.filter((x) => x !== key) : [...minis, key])}>
              <span className="min-w-0"><span className="block font-bold text-15 leading-tight">{MANY_TITLES[key]}</span>
                <span className="block text-13 text-[var(--color-ink-2)] leading-snug mt-0.5">{blurb}{lit && <b style={{ color: "var(--color-gold)" }}> {slot(key)}</b>}</span></span>
              <span className="relative shrink-0 block w-[48px] h-[28px] rounded-full transition-colors" style={{ background: lit ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
                <span className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: lit ? 23 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
              </span>
            </button>
            {lit && key === "quiz" && (<div className="sub-panel">
              {/* how many rounds: a dropdown, not a row of six (the owner, 1 Nov) */}
              <label className="sp-row"><span className="sp-k">Rounds</span>
                <select className="select" aria-label="How many standard rounds" value={rounds} onChange={(e) => { setRounds(Number(e.target.value)); setNote(null); }}>
                  {Array.from({ length: MANY_ROUNDS }, (_, i) => i + 1).map((r) => <option key={r} value={r}>{r} round{r === 1 ? "" : "s"}</option>)}
                </select></label>
              <div className="flex flex-col gap-2"><span className="sp-k">Level</span><LevelRow label="Question round level" opts={LEVELS4} value={quizLevels} set={setQuizLevels} /><p className="text-12 text-[var(--color-ink-3)] px-1">{levelLine(quizLevels, quizLevels.length === 4)}</p></div>
              <LevelNote code={code} themes={picked} bank={bank} left={left} levels={() => quizLevels} onAdd={() => setChoosing(true)} />
              {/* the themes: a summary, and a tap to change them (one per round; the rounds play two at a time) */}
              <div className="flex flex-col gap-2">
                <button type="button" className="flex items-center justify-between gap-3 min-h-[44px] text-left" aria-expanded={picking} onClick={() => setPicking(!picking)}>
                  <span className="min-w-0"><span className="sp-k block">Themes · {picked.length} of {rounds}</span>
                    <span className="block text-14 font-bold leading-snug mt-1">{picked.length ? picked.join(", ") : bank ? "None yet" : "Loading…"}</span>
                    <span className="block text-12 text-[var(--color-ink-3)] mt-0.5">One per round. The rounds play two at a time.</span></span>
                  <span className="text-13 font-bold shrink-0" style={{ color: "var(--color-gold)" }}>{picking ? "Done" : "Change"}</span>
                </button>
                {picking && <div className="flex flex-wrap gap-2 enter" role="group" aria-label="Question round themes">
                  {avail.map((t) => { const lit = picked.includes(t); return (
                    <button key={t} type="button" className={"chip !min-h-[44px] !px-3 !text-13 " + (lit ? "chip-on" : "")} aria-pressed={lit}
                      onClick={() => toggleTheme(t)}>{t}</button>); })}
                </div>}
                {note && <p className="text-13 text-[var(--color-no)]" role="alert">{note}</p>}
              </div>
            </div>)}
            {lit && key === "flag" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="Guess the Flag level" opts={FLAG_LEVELS} value={flagLevels} set={setFlagLevels} /></div>}
            {lit && key === "pin" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="Drop the Pin level" opts={LEVELS3} value={pinLevels} set={setPinLevels} /></div>}
            {lit && key === "majority" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="Majority Rules level" opts={LEVELS3} value={majorityLevels} set={setMajorityLevels} /></div>}
            {lit && key === "airport" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="Guess the Airport level" opts={LEVELS3} value={airportLevels} set={setAirportLevels} /></div>}
            {lit && key === "map" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="Guess the Map level" opts={LEVELS3} value={mapLevels} set={setMapLevels} /></div>}
            {lit && key === "see" && <div className="sub-panel"><span className="sp-k">Level</span><LevelRow label="What Do You See? level" opts={LEVELS3} value={seeLevels} set={setSeeLevels} /></div>}
            {lit && key === "dish" && (<div className="sub-panel">
              <span className="sp-k">Cocktails</span>
              <LevelRow label="Cocktail levels" opts={COCKTAILS} value={dishLevels.filter((l) => l[0] === "c")} set={(v) => setDishLevels([...v, ...dishLevels.filter((l) => l[0] === "d")])} />
              <span className="sp-k">Dishes</span>
              <LevelRow label="Dish levels" opts={DISHES} value={dishLevels.filter((l) => l[0] === "d")} set={(v) => setDishLevels([...dishLevels.filter((l) => l[0] === "c"), ...v])} />
            </div>)}
          </div>); })}
      </div>
      {/* ---- ADVANCED: the host's (it shows the answers), as with two teams ---- */}
      <div className="card flex flex-col gap-3">
        <div>
          <div className="display text-24">Advanced</div>
          <div className="text-13 text-[var(--color-ink-2)]">Host only. {pickSummary(picks, on.includes("quiz") ? picked : [], pickMinis)}{tvQs.length > 0 && ` ${noTv ? "The game phone's" : "The TV's"} own ${tvQs.length} question${tvQs.length === 1 ? " is" : "s are"} in the picker too.`}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="btn btn-sm" onClick={() => setChoosing(true)}>Choose questions</button>
          <button type="button" className="btn btn-sm" disabled={!tv} onClick={() => setTvOpen(true)}>{tv ? "Settings" : noTv ? "Settings (waiting for the game…)" : "Settings (waiting for the TV…)"}</button>
          {(Object.keys(picks.picks).length > 0 || Object.keys(picks.themeDiff).length > 0) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPicks(NO_PICKS)}>Clear all picks</button>}
        </div>
        {/* What Do You See?: a kind of picture can be left out */}
        {on.includes("see") && <div className="sub-panel"><span className="sp-k">Pictures</span><LevelRow label="What Do You See? pictures" opts={SEE_KIND_OPTS} value={seeKinds} set={setSeeKinds} /></div>}
      </div>
      {tvOpen && tv && <TvSettings code={code} tv={tv} onClose={() => setTvOpen(false)} />}
      {choosing && fullAll && <Picker bank={fullAll} many caps={CAPS} themes={on.includes("quiz") ? picked : []} minis={pickMinis} difficulty={quizLevels.length === 4 ? "mixed" : quizLevels.join("+")}
        levels={{ map: mapLevels, flag: flagLevels, dish: dishLevels, pin: pinLevels, airport: airportLevels, majority: majorityLevels }} value={picks} onChange={setPicks} onClose={() => setChoosing(false)}
        onUseTheme={(t) => {
          if (!on.includes("quiz")) return "Switch on the standard rounds first.";
          if (picked.includes(t)) return null;
          if ((counts[t] || 0) < 2) return `Add one more question to ${t}: a round needs two.`;
          if (picked.length < rounds) { setThemes([...picked, t]); return `${t} plays tonight.`; }
          const out = picked[picked.length - 1]; setThemes([...picked.slice(0, -1), t]);
          return `${t} plays tonight, instead of ${out}.`;
        }} />}
      <div className="start-bar">
        {blocker && <p className="text-center text-13 text-[var(--color-ink-2)]" role="status">{blocker}</p>}
        <button className="btn btn-gold btn-block" disabled={!!blocker || busy} onClick={() => onStart({ minis: on, flagLevels, pinLevels, majorityLevels, rounds, quizLevels, themes: picked, airportLevels, mapLevels, dishLevels, seeLevels, seeKinds,
          custom: getCustom(), ...picks, picks: Object.fromEntries(Object.entries(picks.picks).filter(([t]) => picked.includes(t))) })}>Start the game</button>
      </div>
    </section>);
}
