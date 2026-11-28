"use client";
/* Drop the Pin's TV screens, one copy for every setup (24 Nov, the merge): the photo up (the photo, "Where is this?",
   the clock, who has dropped a pin) and the reveal (the map flying in, the landmark on its tile, its place, each team's
   row closest first, who takes it). Each setup hands in its clock, its line, its marks and its rows. */
import type { ReactNode } from "react";
import { PinPhoto } from "./GameParts";
import { PinMap } from "./PinMap";
import { AnswerLine } from "./ResultTable";

type Photo = Parameters<typeof PinPhoto>[0]["pin"];
type Marks = Parameters<typeof PinMap>[0]["marks"];

export function PinTv({ pin, dense, clock, sent }: { pin: Photo; dense?: boolean; clock: ReactNode; sent: ReactNode }) {
  return (
    <div className="flex gap-12 items-center w-full justify-center">
      {/* (the 2-team sizes up to four teams; names up to four, dots from five: 23 Nov, the owner) */}
      <div className="flex-1 min-w-0 flex justify-center"><PinPhoto pin={pin} h={dense ? 430 : 460} credit /></div>
      <div className="w-[360px] shrink-0 flex flex-col items-center gap-5">
        <div className="display text-44" style={{ color: "var(--color-gold)" }}>Where is this?</div>
        {clock}
        {sent}
      </div>
    </div>);
}

/* the map's flight in (components/PinMap: a beat, then 2.2 seconds) */
const PIN_LAND = 2.4;
export function PinRevealTv({ marks, name, place, dense, rows, head }: { marks: Marks; name?: string; place?: string; dense?: boolean; rows: ReactNode; head: { text: string; color: string } }) {
  return (
    <div className="flex gap-10 items-center w-full">
      <div className="flex-1 min-w-0"><PinMap marks={marks} fly height={dense ? 430 : 490} size={1.6} interactive={false} label={`Where it is: ${place}`} /></div>
      {/* (28 Nov, the owner's yes to the ideas from Fibbage, motion only: the map flies in from the whole world first, and
          only when it lands does the name slam down, then the place, the distances and who takes it) */}
      <div className="w-[400px] shrink-0 flex flex-col items-center gap-3">
        <div className="eyebrow text-18 beat" style={{ ["--beat" as string]: PIN_LAND + "s" }}>It&rsquo;s here</div>
        <div className="ans-board display text-36 leading-tight beat slam" style={{ ["--beat" as string]: PIN_LAND + "s", color: "var(--color-gold)" }}>{name}</div>
        <div className="text-22 text-[var(--color-ink-2)] -mt-1 beat" style={{ ["--beat" as string]: PIN_LAND + 0.3 + "s" }}>{place}</div>
        <div className="w-full mt-2 beat" style={{ ["--beat" as string]: PIN_LAND + 0.6 + "s" }}>{rows}</div>
        <div className="display text-36 mt-3 beat slam" style={{ ["--beat" as string]: PIN_LAND + 1.2 + "s", color: head.color }}>{head.text}</div>
      </div>
    </div>);
}

/* the phones' reveal, every setup: the map, the landmark on its tile, its place. height: the host's phone has a
   shorter map, so who takes it shows above Next on a 360 by 780 phone */
export function PinAnswer({ marks, name, place, height = 220 }: { marks: Marks; name?: string; place?: string; height?: number }) {
  return <AnswerLine media={<div className="w-full"><PinMap marks={marks} fly height={height} label={`Where it is: ${place}`} /></div>} answer={name} fact={place} />;
}
