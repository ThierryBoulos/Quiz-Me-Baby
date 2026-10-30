"use client";
/* MANY TEAMS: the lobby's line-up (components/Lineup.tsx, for N teams), the phone's team buttons when there
   are more than two, and the host's setup (components/Setup.tsx: the same card, switches and chips, with the
   four games that work for any number of teams). */
import { useState } from "react";
import type { Member, Room } from "@/lib/room";
import { QMB } from "@/lib/engine";
import { MANY_COLORS, MANY_MINIS, MANY_TITLES, PLACE_PTS, lineup, type ManyKey } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";
import { colsFor, Dot, place as ordinal } from "./PartsMany";

/* every team, every face, the captains marked. The TV (big) packs up to four in a row, then rows of three or four;
   the phones stack them. away: captains the TV hasn't heard from (the lobby). */
export function LineupMany({ room, members, k, big }: { room: Room; members: Member[]; k: number; big?: boolean }) {
  const names = manyNames(room, k), away = ((room.state?.away as string[] | undefined) || []);
  const cols = big ? colsFor(k) : 1, dense = big && k > 4, gap = dense ? 14 : 24;
  const nameSize = !big ? 24 : k <= 4 ? 36 : k <= 6 ? 30 : 26;
  return (
    <div className={big ? "flex flex-wrap justify-center" : "grid grid-cols-1 gap-3"} style={big ? { gap } : undefined}>
      {names.map((name, t) => {
        const c = MANY_COLORS[t];
        const list = members.filter((m) => (m.team as number) === t).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0));
        return (
          <div key={t} className="card min-w-0" style={{ borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, ...(big ? { flex: `0 0 calc((100% - ${(cols - 1) * gap}px) / ${cols})`, padding: dense ? "12px 14px" : undefined } : {}) }}>
            <div className={"flex items-center justify-between gap-3 " + (dense ? "mb-2" : "mb-3")}>
              <div className="flex items-center gap-2 min-w-0"><Dot t={t} color={c} size={!big ? 20 : dense ? 22 : 28} /><div className="display truncate" style={{ color: c, fontSize: name.length > 10 ? ({ 36: 28, 30: 24, 26: 22, 24: 20 } as Record<number, number>)[nameSize] : nameSize }}><bdi>{name}</bdi></div></div>
              <div className={"eyebrow shrink-0 " + (dense ? "text-13" : "")}>{list.length} {list.length === 1 ? "player" : "players"}</div>
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
export function PickMany({ room, k, busy, pick, current }: { room: Room; k: number; busy: boolean; pick: (t: number | null) => void; current?: number | null }) {
  const names = manyNames(room, k);
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pick a team">
      {names.map((name, t) => { const c = MANY_COLORS[t]; return (
        <button key={t} className="btn btn-lg min-w-0 !px-4 !gap-2" disabled={busy || current === t} aria-pressed={current === t} aria-label={`${"ABCDEFGH"[t]} · ${name}`} onClick={() => pick(t)}
          style={{ borderColor: c, color: "var(--color-ink)", background: `color-mix(in srgb, ${c} ${current === t ? 28 : 14}%, transparent)` }}>
          <Dot t={t} color={c} size={22} /><span className="truncate"><bdi>{name}</bdi></span></button>); })}
    </div>);
}

/* ---- the host's setup when there are more than two teams: Setup's mini-games card, with the games that work for
   any number of teams, each with its levels; the Start button docked under it ---- */
const GAMES: [ManyKey, string][] = [
  ["quiz", "Six questions, any theme, every captain at once. The fastest right answer scores most. Spread through the night."],
  ["majority", "Everyone plays on their own phone: 15 questions, four answers. Teams ranked by their share of right answers."],
  ["flag", "Ten flags, every captain at once: whose is it? The fastest right answer scores most. The app checks, the host can overrule."],
  ["closest", "Five numbers. Every guess is ranked by how far off: the nearest scores most."],
  ["pin", "A landmark's photo: every captain drops a pin on the map. Ranked by the kilometre."],
  ["airport", "Six departure boards, every captain at once: which airport? The fastest right answer scores most."],
  ["map", "Six world maps with countries lit: what do they have in common? The fastest right answer scores most."],
  ["say", "Six prompts. One answer each from the list: not the app's secret one, and not the same as another team's."],
  ["dish", "Five recipes, an ingredient at a time. One guess a team; the first right answer wins it."]];
const LEVELS4 = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
const LEVELS3 = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;
const FLAG_LEVELS = [["veasy", "Very easy"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
export type CfgMany = { minis: string[]; flagLevels: string[]; pinLevels: string[]; majorityLevels: string[]; rounds: number; quizLevels: string[] };

export function SetupMany({ busy, why, k, onStart }: { busy: boolean; why: string; k: number; onStart: (cfg: CfgMany) => void }) {
  /* on to start with: a question round and the first four games; the rest are a tap away */
  const [minis, setMinis] = useState<string[]>(["quiz", "majority", "flag", "closest", "pin"]);
  const [rounds, setRounds] = useState(2);
  const [quizLevels, setQuizLevels] = useState<string[]>(["easy", "medium", "hard"]);
  const [flagLevels, setFlagLevels] = useState<string[]>(["veasy", "easy", "medium", "hard"]);
  const [pinLevels, setPinLevels] = useState<string[]>([...QMB.PIN_ORDER as string[]]);
  const [majorityLevels, setMajorityLevels] = useState<string[]>([...QMB.MAJORITY_ORDER as string[]]);
  const on = MANY_MINIS.filter((x) => minis.includes(x));
  /* the order they'll play in: the question rounds spread through the night */
  const night = lineup(on.includes("quiz") ? rounds : 0, on.filter((x) => x !== "quiz"));
  const slot = (x: string) => { const at = night.map((y, i) => (y === x ? i + 1 : 0)).filter(Boolean); return at.length ? at.map((n) => ordinal(n)).join(", ") : ""; };
  const blocker = why || (!on.length ? "Switch on at least one game." : "");
  /* a level row: tap to add or drop a level; the last one can't be dropped */
  const LevelRow = ({ label, opts, value, set }: { label: string; opts: readonly (readonly [string, string])[]; value: string[]; set: (v: string[]) => void }) => (
    <div className="flex flex-wrap items-center gap-2 pl-1 pb-2" role="group" aria-label={label}>
      {opts.map(([key, l]) => { const lit = value.includes(key); return (
        <button key={key} type="button" className={"chip !min-h-[44px] !px-3 !text-13 " + (lit ? "chip-on" : "")} aria-pressed={lit}
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
          <div className="text-13 text-[var(--color-ink-2)]">{k} teams: every game is played by every team at once, and the app checks the answers.
            Every team scores every game, by place: <b style={{ color: "var(--color-gold)" }}>{PLACE_PTS.slice(0, k).join(" · ")}</b>.</div>
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
            {lit && key === "quiz" && (<>
              <div className="flex flex-wrap items-center gap-2 pl-1 pb-1" role="group" aria-label="How many question rounds">
                <span className="text-13 text-[var(--color-ink-2)] mr-1">Rounds</span>
                {[1, 2, 3].map((r) => <button key={r} type="button" className={"chip !min-h-[44px] !px-4 !text-13 " + (rounds === r ? "chip-on" : "")} aria-pressed={rounds === r} onClick={() => setRounds(r)}>{r}</button>)}
              </div>
              <LevelRow label="Question round level" opts={LEVELS4} value={quizLevels} set={setQuizLevels} />
            </>)}
            {lit && key === "flag" && <LevelRow label="Guess the Flag level" opts={FLAG_LEVELS} value={flagLevels} set={setFlagLevels} />}
            {lit && key === "pin" && <LevelRow label="Drop the Pin level" opts={LEVELS3} value={pinLevels} set={setPinLevels} />}
            {lit && key === "majority" && <LevelRow label="Majority Rules level" opts={LEVELS3} value={majorityLevels} set={setMajorityLevels} />}
          </div>); })}
      </div>
      <button className="btn btn-gold btn-lg btn-block dock" disabled={!!blocker || busy} onClick={() => onStart({ minis: on, flagLevels, pinLevels, majorityLevels, rounds, quizLevels })}>Start the game</button>
      {blocker && <p className="text-center text-13 text-[var(--color-ink-2)]" role="status">{blocker}</p>}
    </section>);
}
