"use client";
/* The host's answer card while a question is up, one copy for every setup and every game (24 Nov, the merge): the
   answer, and what else counts. Never the fact: the TV has it (25 Nov, the owner: it cluttered). notes: a line that is
   part of the answer (the map's colours, Don't Say the Same's rule); eyebrow: its line on top. */
import type { ReactNode } from "react";

export function HostAnswerCard({ answer, notes, accept, eyebrow = "The answer. Only you see this" }: { answer: ReactNode; notes?: ReactNode; accept?: string[]; eyebrow?: string }) {
  return (
    <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow text-balance" style={{ color: "var(--color-gold)" }}>{eyebrow}</div>
      <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{answer}</div>
      {notes && <div className="text-13 text-[var(--color-ink-2)] mt-1">{notes}</div>}
      {(accept?.length ?? 0) > 0 && <div className="text-13 text-[var(--color-ink-2)] mt-1"><b className="text-[var(--color-ink)]">Also accepted:</b> {accept!.join(", ")}</div>}
    </div>);
}
