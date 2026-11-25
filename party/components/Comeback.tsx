"use client";
/* THE COMEBACK's screens (the owner, 17 Nov), the same pieces on the TV and every phone, 2 teams or 8: the announcement
   (the owner's words), who is still in it while the three questions play, and the result. The rules are in
   lib/comeback.ts and the engine. */
import { Fragment, type ReactNode } from "react";
import { Dot } from "./many/PartsMany";
import { CB_SAYS1, CB_SAYS2, cbTakes, type ComebackPub } from "@/lib/comeback";
import { QMB } from "@/lib/engine";
import { wholeSentences } from "@/lib/sentences";

export type CbTeam = { name: string; color: string };
/* teams by name, each in its colour: "Team B", "Team B and Team E", "Team B, Team E and Team F" */
const named = (ts: number[], T: CbTeam[]): ReactNode => ts.map((t, j) => (
  <Fragment key={t}>{j ? (j === ts.length - 1 ? " and " : ", ") : ""}<bdi style={{ color: T[t]?.color }}>{T[t]?.name}</bdi></Fragment>));
const Arrow = () => <span aria-hidden="true" style={{ color: "var(--color-ink-3)" }}>→</span>;

/* the announcement: the owner's words, then what it takes and what each team can win */
export function ComebackIntro({ teams, c, tv }: { teams: CbTeam[]; c: ComebackPub; tv?: boolean }) {
  return (
    <div className="flex flex-col items-center w-full mx-auto" style={{ gap: tv ? 22 : 12, maxWidth: tv ? 1060 : undefined }}>
      <p className="text-center font-bold leading-snug" style={{ fontSize: tv ? 30 : 16, textWrap: "balance" }}>
        {CB_SAYS1}
      </p>
      <p className="text-center font-bold leading-snug" style={{ fontSize: tv ? 30 : 16, textWrap: "balance" }}>
        {CB_SAYS2[0]} {named(c.teams, teams)} {CB_SAYS2[1]}
      </p>
      <p className="text-center leading-snug" style={{ fontSize: tv ? 24 : 14, color: "var(--color-gold)", fontWeight: 700 }}>
        {cbTakes(c.of, QMB.COMEBACK_SECS as number)}
      </p>
      <div className="flex flex-wrap justify-center" style={{ gap: tv ? 14 : 8 }} role="list" aria-label="What each team can win">
        {c.teams.map((t) => (
          <span key={t} role="listitem" className="inline-flex items-center font-bold" style={{ gap: tv ? 12 : 8, fontSize: tv ? 26 : 15, padding: tv ? "8px 18px" : "6px 12px", borderRadius: 999, border: `2px solid ${teams[t]?.color}`, background: "rgba(255,255,255,.04)" }}>
            <Dot t={t} color={teams[t]?.color ?? "#888"} size={tv ? 24 : 16} /><bdi style={{ color: teams[t]?.color }}>{teams[t]?.name}</bdi>
            <span className="display" style={{ fontSize: tv ? 28 : 16 }}>{c.before[t]}</span><Arrow /><span className="display" style={{ fontSize: tv ? 28 : 16, color: "var(--color-ok)" }}>{c.target[t]}</span>
          </span>))}
      </div>
    </div>);
}

/* while the questions play: each team in it, still in or out */
export function ComebackStatus({ teams, c, tv }: { teams: CbTeam[]; c: ComebackPub; tv?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center" style={{ gap: tv ? 12 : 6 }} role="list" aria-label="Who is still in it">
      {c.teams.map((t) => { const out = !!c.out[t]; return (
        <span key={t} role="listitem" className="inline-flex items-center font-bold" style={{ gap: tv ? 8 : 6, fontSize: tv ? 20 : 12, padding: tv ? "4px 12px" : "3px 8px", borderRadius: 999, border: `1.5px solid ${out ? "rgba(185,192,222,.25)" : teams[t]?.color}`, opacity: out ? 0.6 : 1 }}>
          <Dot t={t} color={teams[t]?.color ?? "#888"} size={tv ? 20 : 14} /><bdi style={{ color: out ? "var(--color-ink-3)" : teams[t]?.color }}>{teams[t]?.name}</bdi>
          <span style={{ color: out ? "var(--color-no)" : "var(--color-ok)" }}>{out ? "out" : `${Math.min(c.i, c.of)} of ${c.of}`}</span>
        </span>); })}
    </div>);
}

/* the TV, a question: who is still in it, the question, the clock, who has locked in (one screen for every setup, the
   3-8 team one: 25 Nov, the owner); each setup hands in its clock and its "locked in" line */
export function ComebackQTv({ teams, c, question, clock, sent }: { teams: CbTeam[]; c: ComebackPub; question?: string | null; clock: ReactNode; sent: ReactNode }) {
  const q = question || "";
  return (<>
    <ComebackStatus teams={teams} c={c} tv />
    <div className="font-bold max-w-[1100px]" style={{ fontSize: q.length > 160 ? 34 : q.length > 100 ? 40 : 50, lineHeight: 1.15 }}>{q}</div>
    {clock}
    {sent}
  </>);
}

/* the TV, a reveal: the question, the answer, its note, each team's call, and the headline ("Lions make the comeback!",
   "Lions still in it", "No comeback"): one screen for every setup (25 Nov, the owner) */
const QUICK = { ["--beat" as string]: ".15s" };
const at = (x: number) => ({ ["--d" as string]: x + "s" });
export function ComebackRevealTv({ question, answer, notes, rows, head, dense }: { question?: string | null; answer: string; notes?: string | null; rows: ReactNode; head: { text: string; color: string }; dense?: boolean }) {
  const n = answer.length;
  return (<>
    {question ? <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{question}</div> : null}
    <div className="ans-board display beat slam leading-none max-w-[1160px]" style={{ ...QUICK, fontSize: n > 34 ? (dense ? 40 : 44) : n > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{answer}</div>
    {notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug">{wholeSentences(notes)}</div>}
    {rows}
    <div className="display text-44 beat" style={{ ...QUICK, ...at(0.5), color: head.color }}>{head.text}</div>
  </>);
}

/* the result: each team in it, made it (its score moving up) or missed it */
export function ComebackResult({ teams, c, tv }: { teams: CbTeam[]; c: ComebackPub; tv?: boolean }) {
  const made = c.made || [], after = c.after || c.before, missed = c.teams.filter((t) => !made[t]);
  return (
    <div className="flex flex-col items-center w-full mx-auto" style={{ gap: tv ? 16 : 10, maxWidth: tv ? 1000 : undefined }}>
      <div className="flex flex-col w-full" style={{ gap: tv ? 12 : 8 }} role="list" aria-label="The comeback's result">
        {c.teams.map((t, j) => { const ok = !!made[t], up = after[t] - c.before[t]; return (
          <div key={t} role="listitem" className="rv flex items-center justify-between font-bold" style={{ animationDelay: `${0.3 + j * 0.5}s`, gap: tv ? 18 : 10, fontSize: tv ? 30 : 15, padding: tv ? "14px 24px" : "10px 12px", borderRadius: tv ? 18 : 12,
            border: `2px solid ${ok ? teams[t]?.color : "rgba(185,192,222,.2)"}`, background: ok ? `color-mix(in srgb, ${teams[t]?.color} 12%, transparent)` : "rgba(255,255,255,.03)" }}>
            <span className="inline-flex items-center min-w-0" style={{ gap: tv ? 12 : 8 }}>
              <Dot t={t} color={teams[t]?.color ?? "#888"} size={tv ? 24 : 16} /><bdi className="truncate" style={{ color: teams[t]?.color }}>{teams[t]?.name}</bdi></span>
            {ok
              ? <span className="inline-flex items-center shrink-0" style={{ gap: tv ? 12 : 8 }}>
                  {up > 0
                    ? <><span className="display" style={{ fontSize: tv ? 30 : 16 }}>{c.before[t]}</span><Arrow /><span className="display" style={{ fontSize: tv ? 30 : 16, color: "var(--color-ok)" }}>{after[t]}</span></>
                    : <span style={{ fontSize: tv ? 22 : 13, color: "var(--color-ink-2)" }}>All {c.of} right, but no room to move up</span>}
                </span>
              : <span className="shrink-0" style={{ fontSize: tv ? 24 : 13, color: "var(--color-ink-3)" }}>missed it</span>}
          </div>); })}
      </div>
      {missed.length > 0 && <p className="rv text-center" style={{ animationDelay: `${0.3 + c.teams.length * 0.5}s`, fontSize: tv ? 24 : 14, color: "var(--color-ink-2)" }}>
        {named(missed, teams)}: well, you deserve that last place.</p>}
    </div>);
}

/* the Setup's switch (on by default), the same in the two-team Setup and the 3-8 team one */
export function ComebackSwitch({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} data-switch="comeback" className="flex items-center justify-between gap-3 w-full text-left min-h-[56px] py-1.5" onClick={() => set(!on)}>
      <span className="min-w-0"><span className="block font-bold text-15 leading-tight">The Comeback</span>
        <span className="block text-13 text-[var(--color-ink-2)] leading-snug mt-0.5">A massacre halfway through? 3 easy questions to get back in the game.</span></span>
      <span className="relative shrink-0 block w-[48px] h-[28px] rounded-full transition-colors" style={{ background: on ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
        <span className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition-all" style={{ left: on ? 23 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
      </span>
    </button>);
}
