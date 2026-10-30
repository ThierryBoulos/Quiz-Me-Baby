"use client";
/* MANY TEAMS: the lobby's line-up (components/Lineup.tsx, for N teams), the phone's team buttons when there
   are more than two, and the host's setup (components/Setup.tsx: the same card, switches and chips, with the
   four games that work for any number of teams). */
import { useState } from "react";
import type { Member, Room } from "@/lib/room";
import { QMB } from "@/lib/engine";
import { MANY_COLORS, MANY_MINIS, MANY_PTS, MANY_TITLES, type ManyKey } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";
import { colsFor, Dot } from "./PartsMany";

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

/* ---- the host's setup when there are more than two teams: Setup's mini-games card, with the four games that
   work for any number of teams, each with its levels; the Start button docked under it ---- */
const GAMES: [ManyKey, string][] = [
  ["majority", "Everyone plays on their own phone: 15 questions, four answers. The highest share of right answers wins."],
  ["flag", "Ten flags, every captain at once: whose is it? The app checks, the host can overrule."],
  ["closest", "Five numbers. The nearest guess takes the leg."],
  ["pin", "A landmark's photo: every captain drops a pin on the map. Nearest pin takes the leg."]];
const LEVELS3 = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] as const;
const FLAG_LEVELS = [["veasy", "Very easy"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]] as const;
export type CfgMany = { minis: string[]; flagLevels: string[]; pinLevels: string[]; majorityLevels: string[] };

export function SetupMany({ busy, why, k, onStart }: { busy: boolean; why: string; k: number; onStart: (cfg: CfgMany) => void }) {
  const [minis, setMinis] = useState<string[]>([...MANY_MINIS]);
  const [flagLevels, setFlagLevels] = useState<string[]>(["veasy", "easy", "medium", "hard"]);
  const [pinLevels, setPinLevels] = useState<string[]>([...QMB.PIN_ORDER as string[]]);
  const [majorityLevels, setMajorityLevels] = useState<string[]>([...QMB.MAJORITY_ORDER as string[]]);
  const on = MANY_MINIS.filter((x) => minis.includes(x));
  const slot = (x: string) => ["1st", "2nd", "3rd", "4th"][on.indexOf(x as ManyKey)] || "";
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
            <span className={"badge shrink-0 " + (on.length ? "gold" : "line")}>{on.length ? `${on.length * MANY_PTS} pts on the table` : "None"}</span>
          </div>
          <div className="text-13 text-[var(--color-ink-2)]">{k} teams, so mini-games only, played one after another: every team at once, and the app checks the answers.</div>
        </div>
        {GAMES.map(([key, blurb]) => { const lit = minis.includes(key); return (
          <div key={key}>
            <button type="button" role="switch" aria-checked={lit} data-mini={key} className="flex items-center justify-between gap-3 w-full text-left min-h-[56px] py-1.5"
              onClick={() => setMinis(lit ? minis.filter((x) => x !== key) : [...minis, key])}>
              <span className="min-w-0"><span className="block font-bold text-15 leading-tight">{MANY_TITLES[key]}</span>
                <span className="block text-13 text-[var(--color-ink-2)] leading-snug mt-0.5">{blurb}{lit && <b style={{ color: "var(--color-gold)" }}> {MANY_PTS} pts · {slot(key)}</b>}</span></span>
              <span className="relative shrink-0 block w-[48px] h-[28px] rounded-full transition-colors" style={{ background: lit ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
                <span className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: lit ? 23 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
              </span>
            </button>
            {lit && key === "flag" && <LevelRow label="Guess the Flag level" opts={FLAG_LEVELS} value={flagLevels} set={setFlagLevels} />}
            {lit && key === "pin" && <LevelRow label="Drop the Pin level" opts={LEVELS3} value={pinLevels} set={setPinLevels} />}
            {lit && key === "majority" && <LevelRow label="Majority Rules level" opts={LEVELS3} value={majorityLevels} set={setMajorityLevels} />}
          </div>); })}
      </div>
      <button className="btn btn-gold btn-lg btn-block dock" disabled={!!blocker || busy} onClick={() => onStart({ minis: on, flagLevels, pinLevels, majorityLevels })}>Start the game</button>
      {blocker && <p className="text-center text-13 text-[var(--color-ink-2)]" role="status">{blocker}</p>}
    </section>);
}
