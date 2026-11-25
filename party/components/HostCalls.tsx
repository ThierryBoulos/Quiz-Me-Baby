"use client";
/* The host's calls at a reveal, one copy for every setup and every typed game (25 Nov, the merge): a line saying whose
   calls they are, then each team: its name by its lettered dot, what it typed (or "No answer"), "You changed it: …" when
   the call isn't the game's any more, what else the game adds under it (Russian Roulette's theme and level), and the
   RIGHT / WRONG pair the host can tap (nothing typed: nothing to rule on). Each setup hands in its teams and its moves. */
import type { ReactNode } from "react";
import { RulingPicker, verdictWord } from "./GameParts";
import { Dot } from "./many/PartsMany";
import { poss } from "@/lib/game";

export type HostCall = {
  t: number; name: string; color: string; typed?: string | null;
  /* the call that stands (as this phone last tapped it), and the game's own */
  value: boolean | null | undefined; app?: boolean | null;
  sub?: ReactNode; neg?: string; onPick: (v: boolean) => void;
};

export function HostCalls({ calls, say, busy, intro = "The game made these calls. Tap one to change it." }: { calls: HostCall[]; say?: boolean; busy?: boolean; intro?: string }) {
  return (<>
    <p className="text-center text-13 text-[var(--color-ink-2)]">{intro}</p>
    <div className="flex flex-col gap-3">{calls.map((c) => (
      <div key={c.t} className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="eyebrow flex items-center gap-2" style={{ color: c.color, letterSpacing: ".1em" }}><Dot t={c.t} color={c.color} size={14} /><span className="truncate"><bdi>{c.name}</bdi></span></div>
          {c.typed ? <div className="font-bold text-18 leading-snug break-words"><bdi>{c.typed}</bdi></div> : <div className="text-14 text-[var(--color-ink-3)]">No answer</div>}
          {/* (a call the host has changed says so: 22 Nov, the owner) */}
          {c.typed && c.value != null && c.app != null && c.value !== c.app && <div className="text-12 font-bold" style={{ color: c.value ? "var(--color-ok)" : "var(--color-no)" }}>You changed it: {verdictWord(c.value, say)}</div>}
          {c.sub}
        </div>
        {c.typed && <div className="w-[188px] shrink-0"><RulingPicker compact sticky value={c.value} app={c.app} say={say} neg={c.neg} label={`Rule on ${poss(c.name)} answer`} busy={busy} onPick={c.onPick} /></div>}
      </div>))}</div>
  </>);
}
