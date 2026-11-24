"use client";
/* Guess the Flag's screens, one copy for every setup (24 Nov, the merge): the TV's flag up and its reveal, and the
   answer line the phones show at the reveal. Each setup hands in its own team pieces (who has answered, each team's
   call), which are the same for all its typed games; the flag, the clock, the answer, the fact and who takes it are
   drawn here. dense: five teams or more, where the rows need the room (the 2-team sizes up to four: 23 Nov). */
import type { CSSProperties, ReactNode } from "react";
import { FlagImg } from "./GameParts";
import { AnswerLine } from "./ResultTable";
import { wholeSentences } from "@/lib/sentences";

/* the answer's quick landing, as every reveal has it */
const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;

export function FlagTv({ flag, reveal, dense, clock, sent, answer, notes, rows, head, headStyle }: {
  flag?: string; reveal?: boolean; dense?: boolean;
  /* the flag up: the clock (each setup's, with its own seconds) and who has answered */
  clock?: ReactNode; sent?: ReactNode;
  /* the reveal: the answer, its fact, each team's call, who takes it */
  answer?: string; notes?: string | null; rows?: ReactNode; head?: { text: string; color: string }; headStyle?: CSSProperties;
}) {
  if (!reveal) return (<>
    <FlagImg name={flag} h={dense ? 240 : 300} maxW={520} />
    {clock}
    {sent}
  </>);
  return (<>
    <FlagImg name={flag} h={dense ? 120 : 220} maxW={dense ? 400 : 520} />
    <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 90, color: "var(--color-gold)" }}>{answer}</div>
    {/* (the fact behind the flag, when it has one: every setup, 23 Nov, the owner) */}
    {notes && <div className={(dense ? "text-18" : "text-22") + " text-[var(--color-ink-2)] text-center"}>{wholeSentences(notes, 120)}</div>}
    {rows}
    {head && <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, color: head.color }}>{head.text}</div>}
  </>);
}

/* the phones' reveal: the flag small, the answer on its tile, the fact under it (every setup, 23 Nov) */
export function FlagAnswer({ flag, answer, notes }: { flag?: string; answer?: string; notes?: string | null }) {
  return <AnswerLine media={<FlagImg name={flag} h={96} />} answer={answer} fact={notes} />;
}
