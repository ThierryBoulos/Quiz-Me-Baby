"use client";
/* The phones' result after a question, every game, two teams to eight (the owner, 1 Nov, option 1 of three): how
   your team did in one pill, then one table, a row a team: its place, its name, what it said (or how far off, or how
   many right), and what it scored. Your row is lit. It replaces the stacked headline, "THE ANSWER" and the blocks. */
import type { ReactNode } from "react";

export type Tone = "ok" | "no" | "mid";
export type RRow = { team: number; name: string; color: string; letter: string; place?: number | null; val: ReactNode; sub?: ReactNode;
  ok?: boolean | null; end?: ReactNode; me?: boolean };

/* "✓ Your team: 1st · +3", "✗ Your team: wrong", "Your team: 310 km off" */
export function YouPill({ text, tone }: { text: string; tone: Tone }) {
  return <div className="flex justify-center"><span className={"you-pill " + tone} role="status" aria-live="polite">{tone === "ok" ? "✓ " : tone === "no" ? "✗ " : ""}{text}</span></div>;
}

/* the question (small), the answer (big, gold), the fact under it; label only where the gold word isn't the answer
   (Don't Say the Same: the app's secret word) */
export function AnswerLine({ question, answer, fact, label, media }: { question?: string | null; answer?: ReactNode; fact?: ReactNode; label?: string; media?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {question && <p className="text-15 text-[var(--color-ink-2)] leading-snug">{question}</p>}
      {media}
      {label && <div className="eyebrow">{label}</div>}
      {answer != null && answer !== "" && <div className="display leading-none" style={{ color: "var(--color-gold)", fontSize: typeof answer === "string" && answer.length > 22 ? 28 : 40 }}>{answer}</div>}
      {fact && <p className="text-13 text-[var(--color-ink-3)] leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fact}</p>}
    </div>);
}

/* a row a team; head: the value column's and the last column's names ("Said", "Pts") */
export function ResultTable({ rows, head, places }: { rows: RRow[]; head: [string, string?]; places?: boolean }) {
  const cols = `${places ? "20px " : ""}minmax(0, 1.5fr) minmax(0, 1fr)${head[1] != null ? " 40px" : ""}`;
  return (
    <div className="rtable" role="table" aria-label="This question, team by team">
      <div className="rt-row rt-head" role="row" style={{ gridTemplateColumns: cols }}>
        {places && <span role="columnheader">#</span>}<span role="columnheader">Team</span><span role="columnheader">{head[0]}</span>
        {head[1] != null && <span role="columnheader" className="text-right">{head[1]}</span>}
      </div>
      {rows.map((r) => (
        <div key={r.team} role="row" className={"rt-row" + (r.me ? " me" : "") + (r.ok === false ? " out" : "")} style={{ gridTemplateColumns: cols, ["--tc" as string]: r.color }}>
          {places && <span className="rt-pl" role="cell">{r.place ?? "–"}</span>}
          <span className="rt-nm" role="cell"><span className="dot ltr" aria-hidden style={{ background: r.color, width: 18, height: 18, fontSize: 10 }}>{r.letter}</span><b style={{ color: r.color }}><bdi>{r.name}</bdi></b></span>
          <span className="rt-val" role="cell"><span className="rt-v"><bdi>{r.val}</bdi>{r.ok === true && <span className="rt-ok" aria-label="right"> ✓</span>}</span>{r.sub && <span className="rt-sub">{r.sub}</span>}</span>
          {head[1] != null && <span className="rt-end" role="cell">{r.end}</span>}
        </div>))}
    </div>);
}

/* what a row scored: "+3" in green, a plain 0 */
export const Pts = ({ n }: { n?: number | null }) => (n != null && n > 0 ? <span style={{ color: "var(--color-ok)" }}>+{n}</span> : <span style={{ color: "var(--color-ink-3)" }}>0</span>);
