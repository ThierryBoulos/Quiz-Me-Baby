"use client";
/* Don't Say the Same as Me's TV, one copy for every setup (24 Nov, the owner's answers 1 to 21): the question with its
   line under it, the clock and who has answered; at the reveal the 3-to-8 design, the question small, the game's secret
   answer on its tile, each team's call with its points, who takes it. Each setup hands in its clock and team pieces.
   dense: five teams or more. */
import type { CSSProperties, ReactNode } from "react";
import { SAY } from "@/lib/minis/say";

/* the answer's quick landing, as every reveal has it */
const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;

export function SayTv({ question, many, clock, sent }: { question?: string; many?: boolean; clock?: ReactNode; sent?: ReactNode }) {
  const n = (question || "").length;
  return (<>
    <div className="font-bold max-w-[1100px]" style={{ fontSize: n > 160 ? 34 : n > 100 ? 40 : 50, lineHeight: 1.15 }}>{question}</div>
    <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px]">{SAY.line(!!many)}</div>
    {clock}
    {sent}
  </>);
}

/* THE SECRET ANSWER AFTER THE TEAMS' (28 Nov, the owner's yes to the ideas from Fibbage, motion only): each team's answer
   comes in first; then the game's secret answer slams down; then the stamps land on who said it; then who gets it. The
   screen is unchanged; only the order. k: how many teams (their answers come in one after another first) */
export const sayCalls = (k: number) => { const step = k <= 2 ? 0.12 : 0.08, rows = 0.4 + Math.max(0, k - 1) * step + 0.5;
  return { board: rows, calls: rows + 0.25, head: rows + 0.9 + k * step }; };
export function SayRevealTv({ question, answer, dense, rows, head, headStyle, k = 2 }: {
  question?: string; answer: string; dense?: boolean; rows?: ReactNode; head?: { text: string; color: string }; headStyle?: CSSProperties; k?: number;
}) {
  const n = answer.length, at = sayCalls(k);
  return (<>
    {question && <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{question}</div>}
    <div className="eyebrow text-18 -mb-3 beat" style={{ ...QUICK, ["--d" as string]: at.board + "s" }}>{SAY.secret}</div>
    <div className="ans-board display beat slam leading-none max-w-[1160px]" style={{ ["--beat" as string]: 0.15 + at.board + "s", fontSize: n > 34 ? (dense ? 40 : 44) : n > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{answer}</div>
    {rows}
    {head && <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, ["--d" as string]: at.head + "s", color: head.color }}>{head.text}</div>}
  </>);
}

/* a team's call, in words: why its answer scores nothing (said: the secret answer; off: not on the list; same: another
   team's answer, 3 to 8 only; none of these, the host changed it: "Doesn't score") */
export const sayWord = (ok: boolean | null | undefined, typed: unknown, why?: string | null) =>
  ok ? SAY.dodged : !typed ? "No answer" : SAY.why[why || ""] || SAY.noScore;
