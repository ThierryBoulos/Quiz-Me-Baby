"use client";
/* Guess the Airport's answer, one piece for every setup (23 Nov, the owner): the airport's name on split-flap letters
   (the TV) and its code and city; on the phones, the code, city and note under the answer's tile. */
import { useEffect, useState } from "react";
import { motionOff } from "./Marquee";

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
export function AirportAnswerTv({ answer, air, dense }: { answer: string; air: Air; dense?: boolean }) {
  const n = answer.length, size = n > 34 ? (dense ? 26 : 30) : n > 24 ? (dense ? 30 : 36) : dense ? 38 : 46;
  return (
    <div className="flex flex-col items-center gap-2 max-w-[1160px]">
      <SplitFlap text={answer} size={size} />
      {air?.code && <div className="text-24 flex items-center gap-3"><SplitFlap text={air.code} size={26} start={300} /> · {air.city}</div>}
    </div>);
}

/* the phones' reveal: the code and city, the note (a board with no code still shows its note) */
export function AirportFact({ air, notes }: { air: Air; notes?: string | null }) {
  return (<>
    {air?.code && <span className="block"><b className="text-[var(--color-ink)]">{air.code}</b> · {air.city}</span>}
    {notes && <span className="block mt-1">{notes}</span>}
  </>);
}
