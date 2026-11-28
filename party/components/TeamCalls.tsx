"use client";
/* The TV's team pieces for every game where captains type, one copy for every setup (24 Nov, the merge):
   - SentLine: while a question is up, who has answered ("Lions: locked in", "Owls: thinking…"); five teams or more,
     a row of lettered dots; column: one under the other, beside a board, a map or a picture;
   - TeamCalls: at the reveal, each team's name, the app's call (RIGHT or WRONG), what it earned and what it typed.
   Each setup hands in its teams (only those in this question: sudden death's tied ones, the comeback's) and its words. */
import type { CSSProperties } from "react";
import { Verdict } from "./GameParts";
import { colsFor, Dot, place } from "./many/PartsMany";
import { Mascot, MascotAt, mascotOf, useMascotPicks } from "./Mascot";

export type CallTeam = { i: number; name: string; color: string };

/* mascots (28 Nov, the owner's pick): each team's mascot stands in its place in the row, thinking, and hops when its
   captain sends (the TV only; switched on game by game) */
export function SentLine({ teams: T, sent, column, on = "locked in", off = "thinking…", mascots }: { teams: CallTeam[]; sent: (i: number) => boolean; column?: boolean; on?: string; off?: string; mascots?: boolean }) {
  const dense = T.length > 4, picks = useMascotPicks();
  if (mascots && !column) return (
    <div className="flex flex-wrap justify-center items-end" style={{ gap: dense ? "4px 26px" : "4px 40px", maxWidth: 1168 }} role="status" aria-label={T.map((t) => `${t.name} ${sent(t.i) ? "in" : "not yet"}`).join(", ")}>
      {T.map(({ i, name, color }) => (
        <span key={i} className="flex flex-col items-center gap-1 font-bold" style={{ fontSize: dense ? 18 : 22 }}>
          <Mascot kind={mascotOf(picks, i)} color={color} mood={sent(i) ? "sent" : "think"} size={dense ? 64 : 80} delay={i * 0.37} key={sent(i) ? "in" : "out"} />
          {dense ? <Dot t={i} color={color} size={22} />
            : <span className="whitespace-nowrap"><bdi style={{ color }}>{name}</bdi>: <span style={{ color: sent(i) ? color : "var(--color-ink-3)" }}>{sent(i) ? on : off}</span></span>}
        </span>))}
    </div>);
  /* five teams or more: one row of lettered dots, lit with a tick when the team is in (two rows of names were too much) */
  if (dense && !column) return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1" role="status" aria-label={T.map((t) => `${t.name} ${sent(t.i) ? "in" : "not yet"}`).join(", ")}>
      {T.map(({ i, color }) => (
        <span key={i} className="flex items-center gap-1.5 font-bold text-20" style={{ color: sent(i) ? color : "var(--color-ink-3)" }}>
          {/* (28 Nov, the idea from Fibbage: a team's mark pops the moment its captain sends) */}
          <span key={sent(i) ? "in" : "out"} className={"flex items-center gap-1.5" + (sent(i) ? " sent-pop" : "")} style={sent(i) ? { ["--c" as string]: color } : undefined}><Dot t={i} color={color} size={22} />{sent(i) ? "✓" : "…"}</span></span>))}
    </div>);
  return (
    <div className={"flex " + (column ? "flex-col items-center gap-0.5" : "flex-wrap justify-center gap-y-0.5 " + (dense ? "gap-x-5" : "gap-x-10"))} role="status" style={{ maxWidth: 1168 }}>{T.map(({ i, ...t }) => (
      /* (the team's name always in its colour; only "thinking…" grey: 24 Nov, the owner, "why is it in grey?") */
      <span key={i} className="font-bold whitespace-nowrap" style={{ fontSize: column && dense ? 20 : 22 }}>
        <bdi style={{ color: t.color }}>{t.name}</bdi>: <span key={sent(i) ? "in" : "out"} className={sent(i) ? "sent-pop" : undefined} style={{ color: sent(i) ? t.color : "var(--color-ink-3)", ["--c" as string]: t.color }}>{sent(i) ? on : off}</span></span>))}
    </div>);
}

/* ok: the app's call (null: no call yet); typed: what the team sent; pts and places: what a right answer earned and in
   which order it came (3 to 8 teams; none with 2); word: the call's word where it isn't RIGHT or WRONG ("No answer",
   Don't Say the Same's); column: one team under the other, in a side column beside a board or a picture */
/* THE ANSWER AFTER THE TEAMS' (28 Nov, the owner's yes to the ideas from Fibbage, motion only: Don't Say the Same, Guess
   the Flag, Guess the Map): each team's answer comes in first, one after another; then the answer slams down; then the
   stamps land; then who takes it. The screens are unchanged; only the order. k: how many teams are shown */
export const answerLast = (k: number) => { const step = k <= 2 ? 0.12 : 0.08, rows = 0.4 + Math.max(0, k - 1) * step + 0.5;
  return { board: rows, calls: rows + 0.25, head: rows + 0.9 + k * step }; };

/* callsAt (seconds, the TV): the teams' answers come in first and the calls (the stamps, the points) only that much later,
   once the answer has been shown (Don't Say the Same, 28 Nov: the answers, then the secret answer, then who said it) */
export function TeamCalls({ teams: T, ok, typed, pts, places, word, size = "tv", delay, column, empty = "No answer", callsAt, mascots }: {
  teams: CallTeam[]; ok: (i: number) => boolean | null | undefined; typed: (i: number) => string | null | undefined;
  pts?: (i: number) => number | undefined; places?: (i: number) => number | null | undefined; word?: (i: number) => string | undefined;
  size?: "tv" | "phone"; delay?: (n: number) => CSSProperties; column?: boolean; empty?: string; callsAt?: number; mascots?: boolean;
}) {
  const picks = useMascotPicks();
  const k = T.length, tv = size === "tv", n = column ? 1 : tv ? colsFor(k) : k > 4 ? 2 : 1, dense = k > 4;
  const long = T.some((t) => t.name.length > 10);
  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: tv ? "12px 24px" : "12px 10px", maxWidth: tv ? Math.min(1168, n * (dense ? 300 : 390)) : undefined, ["--beat" as string]: ".4s", ...(tv && callsAt != null ? { ["--calls" as string]: callsAt + "s" } : null) }}>
      {T.map((t) => { const v = ok(t.i), x = typed(t.i), p = pts?.(t.i) ?? 0, pl = places?.(t.i); return (
        <div key={t.i} className={"flex flex-col items-center gap-1 min-w-0 " + (tv ? "beat" : "")} style={delay?.(t.i)}>
          {/* (the TV: RIGHT or WRONG, "+3" and "1st right" on one middle line, the word in the middle of its box: 24 Nov,
              the owner) */}
          {/* (the TV: the name on a line of its own, whole, over two lines if it must: the 4 Nov audit, 3.6; a phone with
              five teams or more: the name on a line of its own too, so it's never "THE …") */}
          <div className={"flex justify-center gap-2 whitespace-nowrap min-w-0 max-w-full" + (tv ? " items-center flex-wrap gap-y-1.5" : dense ? " items-baseline flex-wrap gap-y-0" : " items-baseline")} style={{ fontSize: tv ? (dense ? 20 : long ? 26 : 30) : 14 }}>
            <span className={tv ? "display basis-full text-center whitespace-normal leading-tight clamp2" : "eyebrow truncate" + (dense ? " basis-full text-center" : "")} style={{ color: t.color, ...(!tv && dense ? { letterSpacing: ".1em", fontSize: 12 } : {}) }}><bdi>{t.name}</bdi></span>
            {/* (the team's mascot, by its stamp: it takes its mood as the stamp lands, 28 Nov) */}
            {tv && mascots && <MascotAt kind={mascotOf(picks, t.i)} color={t.color} size={dense ? 40 : 52} delay={t.i * 0.37}
              mood={v == null ? "think" : v ? "right" : !x ? "none" : "wrong"} at={(callsAt ?? 0.4 + t.i * 0.08) + 0.35} />}
            {v != null && <Verdict v={v} stamp={tv} size={tv ? undefined : 14} word={word?.(t.i) ?? (v ? undefined : !x ? "No answer" : undefined)} />}
            {v && p > 0 && <b className={"display" + (tv && callsAt != null ? " calls-late" : "")} style={{ color: "var(--color-ok)", fontSize: tv ? (dense ? 20 : 26) : 14 }}>+{p}</b>}
            {/* why that many: the order the right answers came in (the 4 Nov audit, 3.8: +4, +3, +2 said nothing) */}
            {v && p > 0 && pl && <span className={"shrink-0" + (tv && callsAt != null ? " calls-late" : "")} style={{ color: "var(--color-ink-3)", fontSize: tv ? (dense ? 18 : 20) : 12 }}>{place(pl)} right</span>}
          </div>
          {/* (beside a map or a picture the column is narrow: a long answer gets a third line, and a size down, so it's
              never cut: "McDonald's — gold has one today, red had one and lost it") */}
          {(x || v == null) && <div className={"font-bold max-w-full text-center leading-tight " + (tv && dense ? "truncate" : column ? "clamp3" : "clamp2")} style={{ fontSize: tv ? (dense ? 18 : column ? 20 : 24) : 16, color: x ? undefined : "var(--color-ink-3)" }}><bdi>{x ?? empty}</bdi></div>}
        </div>); })}
    </div>);
}
