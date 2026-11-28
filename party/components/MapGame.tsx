"use client";
/* Guess the Map's screens, one copy for every setup (24 Nov, the owner's answers 1 to 19): the TV's map up and its
   reveal, and the answer line the phones show at the reveal. Each setup hands in its own clock and team pieces (who
   has answered, each team's call), which are the same for all its typed games. The colour key goes with the map
   everywhere, TV and phones (item 11): without it the colours mean nothing. dense: five teams or more. */
import { answerLast } from "./TeamCalls";
import type { CSSProperties, ReactNode } from "react";
import { MapView } from "./MapView";
import { AnswerLine } from "./ResultTable";
import { wholeSentences } from "@/lib/sentences";
import { MAP } from "@/lib/minis/map";

/* the answer's quick landing, as every reveal has it */
const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;
type MapPub = { id: string; rev?: string; hint?: string };

/* the TV, a map up: the map with its key, and beside it the question, the clock and who has answered */
export function MapTv({ map, clock, sent }: { map?: MapPub; clock?: ReactNode; sent?: ReactNode }) {
  return (
    <div className="flex gap-10 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex justify-center">{map && <MapView id={map.id} rev={map.rev} reveal={false} hint={!!map.hint} maxH={460} still />}</div>
      <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
        <div className="display leading-tight text-40 text-center" style={{ color: "var(--color-gold)" }}>{MAP.ask}</div>
        {clock}
        {sent}
      </div>
    </div>);
}

/* the TV's reveal (the 3-to-8 design in every setup, item 12): the map redrawn with its key (bigger up to four teams),
   the title on its tile, the fact, each team's call, who takes it */
export function MapRevealTv({ map, answer, notes, dense, rows, head, headStyle, k = 2 }: {
  map?: MapPub; answer: string; notes?: string | null; dense?: boolean; rows?: ReactNode; head?: { text: string; color: string }; headStyle?: CSSProperties;
  k?: number;   // how many teams: their answers come in first, then the map's title (components/TeamCalls answerLast, 28 Nov)
}) {
  const n = answer.length, at = answerLast(k);
  return (<>
    {map && <MapView id={map.id} rev={map.rev} reveal maxH={dense ? 120 : 240} still />}
    <div className="ans-board display beat slam leading-none max-w-[1160px] text-center" style={{ ["--beat" as string]: 0.15 + at.board + "s", fontSize: n > 34 ? (dense ? 40 : 44) : n > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{answer}</div>
    {notes && <div className={(dense ? "text-18" : "text-20") + " text-[var(--color-ink-2)] max-w-[1000px] leading-snug text-center beat"} style={{ ...QUICK, ["--d" as string]: at.board + 0.2 + "s" }}>{wholeSentences(notes, 120)}</div>}
    {rows}
    {head && <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, ["--d" as string]: at.head + "s", color: head.color }}>{head.text}</div>}
  </>);
}

/* the phones' reveal: the map with its key (enlarged, headed by its title: item 16), the title on its tile, the fact
   (its first whole sentences, as on the TV: the whole note ran under Next) */
export function MapAnswer({ map, answer, notes, h = 180 }: { map?: MapPub; answer?: string; notes?: string | null; h?: number }) {
  return <AnswerLine media={map ? <MapView id={map.id} rev={map.rev} reveal maxH={h} title={answer} /> : null} answer={answer} fact={notes ? wholeSentences(notes, 120) : notes} />;
}
