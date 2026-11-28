"use client";
/* Closest To Wins' TV screens, one copy for every setup (24 Nov, the merge): the question up (the question, the clock,
   who has answered) and the reveal (the question small, the answer as people write it, the fact, the line, who takes
   it). Each setup hands in its clock, its "who has answered" line and its line's teams. dense: five teams or more. */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AnswerLine } from "./ResultTable";
import { motionOff } from "./Marquee";
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

/* THE ANSWER LAST (28 Nov, the owner's yes to the idea from Fibbage: "the guesses first, then the answer"): the guesses'
   cards drop onto the line while the answer's board still shows "???"; then it counts up like a counter and stops on
   the answer; then the gold mark, the bands, how far off, and who takes it. The screen itself is
   unchanged: only when each part comes in. Motion off in Settings: everything at once, as before. */
const ROLL = 1.1;
export const closestHold = (n: number) => 0.12 + Math.max(0, n - 1) * (n <= 2 ? 0.14 : 0.1) + 0.7;   // the last card is down
function RollNum({ answer, at, style }: { answer: number; at: number; style: CSSProperties }) {
  const [v, setV] = useState<number | null>(null), [done, setDone] = useState(false);
  useEffect(() => {
    if (motionOff()) { setDone(true); return; }
    const ts: number[] = [];
    /* it counts up, fast then slowing, and stops on the answer: never past it and back (28 Nov, the owner) */
    const dec = Number.isInteger(answer) ? 0 : 1, f = 10 ** dec, N = 22;
    for (let j = 1; j < N; j++) { const k = 1 - Math.pow(1 - j / N, 3);
      ts.push(window.setTimeout(() => setV(Math.floor(answer * k * f) / f), at * 1000 + (j / N) * ROLL * 1000)); }
    ts.push(window.setTimeout(() => setDone(true), at * 1000 + ROLL * 1000));
    return () => ts.forEach(clearTimeout);
  }, [answer, at]);
  const text = showNum(answer);
  /* (the board keeps the answer's width the whole time: the line under it never moves) */
  return (
    <div key={done ? "a" : "r"} className={"ans-board display leading-none relative " + (done ? "slam" : "beat slam")} style={{ ...style, ...(done ? { ["--d" as string]: "0s" } : null) }}>
      <span style={done ? undefined : { visibility: "hidden" }}>{text}</span>
      {!done && <span className="absolute inset-0 grid place-items-center" style={{ opacity: v == null ? 0.35 : 1 }}>{v == null ? "?".repeat(Math.min(4, text.length)) : showNum(v)}</span>}
    </div>);
}

export function ClosestRevealTv({ question, answer, notes, dense, ruler, head, headStyle }: {
  question?: string | null; answer: number; notes?: string | null; dense?: boolean;
  ruler: Parameters<typeof Ruler>[0]["teams"]; head: { text: string; color: string }; headStyle?: CSSProperties;
}) {
  const hold = closestHold(ruler.length), land = hold + ROLL;
  return (<>
    {question && <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{question}</div>}
    <RollNum answer={answer} at={hold} style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }} />
    {notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug beat" style={{ ...QUICK, ["--d" as string]: land + "s" }}>{wholeSentences(notes)}</div>}
    <Ruler ans={answer} teams={ruler} after={land} />
    <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, ["--d" as string]: land + 0.9 + "s", color: head.color }}>{head.text}</div>
  </>);
}

/* the phones' reveal, every setup: the question, the answer as people write it, the fact */
export function ClosestAnswer({ question, answer, notes }: { question?: string | null; answer: number; notes?: string | null }) {
  return <AnswerLine question={question} answer={showNum(answer)} fact={notes} />;
}
