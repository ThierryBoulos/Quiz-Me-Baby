"use client";
/* Closest To Wins' TV screens, one copy for every setup (24 Nov, the merge): the question up (the question, the clock,
   who has answered) and the reveal (the question small, the answer as people write it, the fact, the line, who takes
   it). Each setup hands in its clock, its "who has answered" line and its line's teams. dense: five teams or more. */
import type { CSSProperties, ReactNode } from "react";
import { AnswerLine } from "./ResultTable";
import { Ruler } from "./Ruler";
import { showNum } from "@/lib/game";
import { wholeSentences } from "@/lib/sentences";

const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;

export function ClosestTv({ question, dense, clock, sent }: { question?: string | null; dense?: boolean; clock: ReactNode; sent: ReactNode }) {
  return (<>
    {/* (the 2-team sizes up to four teams, smaller only from five: 23 Nov, the owner) */}
    <div className="font-bold max-w-[1000px]" style={{ fontSize: dense && (question || "").length > 110 ? 40 : 50, lineHeight: 1.15 }}>{question}</div>
    {clock}
    {sent}
  </>);
}

export function ClosestRevealTv({ question, answer, notes, dense, ruler, head, headStyle }: {
  question?: string | null; answer: number; notes?: string | null; dense?: boolean;
  ruler: Parameters<typeof Ruler>[0]["teams"]; head: { text: string; color: string }; headStyle?: CSSProperties;
}) {
  return (<>
    {question && <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{question}</div>}
    <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }}>{showNum(answer)}</div>
    {notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug">{wholeSentences(notes)}</div>}
    <Ruler ans={answer} teams={ruler} />
    <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, color: head.color }}>{head.text}</div>
  </>);
}

/* the phones' reveal, every setup: the question, the answer as people write it, the fact */
export function ClosestAnswer({ question, answer, notes }: { question?: string | null; answer: number; notes?: string | null }) {
  return <AnswerLine question={question} answer={showNum(answer)} fact={notes} />;
}
