"use client";
/* Guess the Airport's answer, one piece for every setup (23 Nov, the owner): the airport's name on split-flap letters
   (the TV) and its code and city; on the phones, the code, city and note under the answer's tile. */
import { answerLast } from "./TeamCalls";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Board } from "./GameParts";
import { motionOff } from "./Marquee";
import { AIRPORT } from "@/lib/minis/airport";
import { wholeSentences } from "@/lib/sentences";
import type { Pub } from "@/lib/game";

type Air = { code?: string; city?: string } | null | undefined;

/* A split-flap board (the old airport kind): every letter cycles through the alphabet, then lands, one after
   another left to right; words wrap whole. start: ms before it begins. With motion off in Settings, just the text. */
const FLAPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export function SplitFlap({ text, size, start = 0 }: { text: string; size: number; start?: number }) {
  const final = text.toUpperCase();
  const still = motionOff();
  const [shown, setShown] = useState(() => (still ? final : final.replace(/\S/g, " ")));
  useEffect(() => {
    if (still) { setShown(final); return; }
    const t0 = Date.now() + start;
    const tick = () => {
      const el = Date.now() - t0;
      let done = true;
      setShown([...final].map((ch, i) => {
        if (ch === " ") return " ";
        if (el >= 380 + i * 55) return ch;
        done = false;
        return el < i * 55 ? " " : FLAPS[(Math.floor(el / 50) * 7 + i * 13) % FLAPS.length];
      }).join(""));
      if (done) clearInterval(iv);
    };
    const iv = setInterval(tick, 50);
    return () => clearInterval(iv);
  }, [final, start, still]);
  let k = 0;
  return (
    <div className="flap" style={{ fontSize: size }} aria-label={text}>
      {final.split(" ").map((w, wi) => { const at = k; k += w.length + 1; return (
        <span key={wi} className="flap-word" aria-hidden>{[...w].map((_, ci) => <span key={ci} className="flap-t"><span>{shown[at + ci] ?? ""}</span></span>)}</span>); })}
    </div>);
}

/* the TV's reveal: the name on the flaps (a long one on smaller flaps), then "AUH · Abu Dhabi" */
export function AirportAnswerTv({ answer, air, dense, at = 0 }: { answer: string; air: Air; dense?: boolean; at?: number }) {
  const n = answer.length, size = n > 34 ? (dense ? 26 : 30) : n > 24 ? (dense ? 30 : 36) : dense ? 38 : 46;
  return (
    <div className="flex flex-col items-center gap-2 max-w-[1160px]">
      <SplitFlap text={answer} size={size} start={at * 1000} />
      {air?.code && <div className="text-24 flex items-center gap-3 beat" style={{ ["--beat" as string]: at + "s" }}><SplitFlap text={air.code} size={26} start={at * 1000 + 300} /> · {air.city}</div>}
    </div>);
}

/* the phones' reveal: the code and city, the note (a board with no code still shows its note) */
export function AirportFact({ air, notes }: { air: Air; notes?: string | null }) {
  return (<>
    {air?.code && <span className="block"><b className="text-[var(--color-ink)]">{air.code}</b> · {air.city}</span>}
    {notes && <span className="block mt-1">{notes}</span>}
  </>);
}

/* the TV, every setup (24 Nov, the merge): the board up, "Which airport?", the clock and who has answered beside it;
   then the reveal: the board's first rows, the name on the flaps, its code and city, the note, each team's call, who
   takes it. Each setup hands in its clock, its line, its rows. dense: five teams or more */
const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;
export function AirportTv({ air, dense, clock, sent }: { air: Pub["airport"]; dense?: boolean; clock: ReactNode; sent: ReactNode }) {
  return (
    <div className="flex gap-10 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex justify-center"><Board air={air} size="tv" flip /></div>
      <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
        {/* (the 2-team sizes up to four teams: 23 Nov, the owner) */}
        <div className={"display leading-tight " + (dense ? "text-40" : "text-44")} style={{ color: "var(--color-gold)" }}>{AIRPORT.ask}</div>
        {clock}
        {sent}
      </div>
    </div>);
}
/* (28 Nov, the owner's yes to the ideas from Fibbage, motion only: each team's answer first, then the flaps turn to the
   airport's name, then the stamps and who takes it: components/TeamCalls answerLast; k: how many teams) */
export function AirportRevealTv({ air, answer, notes, dense, rows, head, headStyle, k = 2 }: { air: Pub["airport"]; answer: string; notes?: string | null; dense?: boolean; rows: ReactNode; head: { text: string; color: string }; headStyle?: CSSProperties; k?: number }) {
  const at = answerLast(k);
  return (<>
    <div className="w-full max-w-[860px] board-tight"><Board air={air} size="reveal" /></div>
    <AirportAnswerTv answer={answer} air={air} dense={dense} at={at.board} />
    {/* (the note stays on the phones with five teams or more: the board and the answers fill the TV) */}
    {notes && !dense && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug beat" style={{ ...QUICK, ["--d" as string]: at.board + 0.6 + "s" }}>{wholeSentences(notes)}</div>}
    {rows}
    <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, ["--d" as string]: at.head + 0.6 + "s", color: head.color }}>{head.text}</div>
  </>);
}
