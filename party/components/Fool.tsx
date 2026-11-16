"use client";
/* FOOL ME TWICE's screens (the owner, 16 Nov), the same pieces on the TV and every phone, 2 teams or 8: the fact with
   its blank, who has written and picked, the answers to pick from, and the reveal (each lie, whose it was and who fell
   for it, the truth last). The rules are in lib/fool.ts. */
import type { ReactNode } from "react";
import type { FoolOpt, FoolPub, FoolRev } from "@/lib/fool";
import { Dot } from "./many/PartsMany";
import { QMB } from "@/lib/engine";

export type FoolTeam = { name: string; color: string };
const LETTERS = "ABCDEFGHI";

/* "Fact 2 of 6", and "A hard one" on the night's last two */
export function FoolHead({ fool, tv }: { fool: FoolPub; tv?: boolean }) {
  return (
    <div className="eyebrow text-center" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : 11 }}>
      Fact {fool.n} of {fool.of}{fool.hard ? <span style={{ color: "#ff8f80" }}> · A hard one</span> : null}</div>);
}

/* the truth as it reads in the sentence: "in a race", "the Mona Lisa", "'little mouse'". A name or a title keeps its
   capital ("Tasmania"), and so does a word starting a quote, or in a quoted title ('Cosmic Latte') */
export function inSentence(fact: string, truth: string, name?: boolean) {
  const before = fact.split("____")[0];
  if (name || !before.trim() || /[.!?]\s*$/.test(before) || /^[A-Z]{2,}\b/.test(truth)) return truth;
  const open = Math.max(-1, ...[...before.matchAll(/(^|[\s(])'/g)].map((m) => (m.index ?? 0) + m[1].length));
  const close = Math.max(-1, ...[...before.matchAll(/[^\s(]'(?=[\s.,;:!?)]|$)/g)].map((m) => (m.index ?? 0) + 1));
  if (open > close) { const q = before.slice(open + 1); if (!q.trim() || /^[A-Z]/.test(q)) return truth; }
  return truth.charAt(0).toLowerCase() + truth.slice(1);
}
/* the fact, its blank a line; at the reveal, the truth in it, in gold */
export function FoolFact({ fool, size, truth }: { fool: FoolPub; size: number; truth?: string }) {
  const [a, b] = fool.fact.split("____");
  return (
    <p className="font-bold text-center leading-tight text-balance" style={{ fontSize: size }}>
      {a}{truth ? <span style={{ color: "var(--color-gold)" }}>{inSentence(fool.fact, truth, fool.name)}</span> : <span className="fool-blank" aria-label="blank" />}{b ?? ""}</p>);
}

/* who has written their lie, or picked */
export function FoolStatus({ teams, done, doing, finished, tv }: { teams: FoolTeam[]; done: boolean[]; doing: string; finished: string; tv?: boolean }) {
  /* (five teams or more: their lettered dots only, as the other games' rows) */
  const many = teams.length > 2, dense = teams.length > 4;
  return (
    <div className={"flex flex-wrap justify-center " + (many ? "gap-x-5 gap-y-1.5" : "gap-x-10 gap-y-1.5")} role="status" aria-label={teams.map((t, i) => `${t.name} ${done[i] ? "in" : "not yet"}`).join(", ")}>
      {teams.map((t, i) => (
        <span key={i} className="flex items-center gap-2 font-bold" style={{ fontSize: tv ? (many ? 20 : 24) : 14, color: done[i] ? t.color : "var(--color-ink-3)" }}>
          <Dot t={i} color={t.color} size={tv ? 22 : 16} />{!dense && <bdi>{t.name}</bdi>}{done[i] ? finished : doing}</span>))}
    </div>);
}

/* the answers to pick from: on the TV, all of them; on a captain's phone, buttons (its own lie left out) */
/* (locked: the pick is sent, no other tap; by default once one is picked: with 3 to 8 teams the captain can change it
   until Lock in) */
export function FoolOptions({ opts, tv, onPick, hide, mine, busy, locked }: { opts: string[]; tv?: boolean; onPick?: (k: number) => void; hide?: number[]; mine?: number | null; busy?: boolean; locked?: boolean }) {
  const shown = opts.map((o, k) => ({ o, k })).filter((x) => !hide?.includes(x.k));
  const two = tv && shown.length > 4;
  return (
    <div className={"grid w-full gap-2 " + (two ? "grid-cols-2" : "grid-cols-1")} style={tv ? { gap: shown.length > 6 ? 10 : 14 } : undefined} role={onPick ? "group" : "list"} aria-label="The answers">
      {shown.map(({ o, k }, i) => {
        const on = mine === k, body = <><span className="fool-letter">{LETTERS[i]}</span><span className="min-w-0 text-left leading-snug"><bdi>{o}</bdi></span></>;
        return onPick
          ? <button key={k} type="button" className={"fool-opt" + (on ? " on" : "")} disabled={busy || (locked ?? mine != null)} aria-pressed={on} onClick={() => onPick(k)}>{body}</button>
          : <div key={k} className={"fool-opt" + (tv ? " tv" : "") + (on ? " on" : "")} role="listitem" style={tv ? { fontSize: shown.length > 6 ? 24 : 30 } : undefined}>{body}</div>;
      })}
    </div>);
}

/* the reveal: each answer that fooled someone or was a team's, whose it was and who fell for it; ours nobody fell for
   go quietly; the truth last, in gold, with who found it. Then each team's points for this fact */
export function FoolReveal({ rev, teams, tv }: { rev: FoolRev; teams: FoolTeam[]; tv?: boolean }) {
  const names = (ts: number[]) => ts.map((t) => teams[t]?.name ?? "").join(" & ");
  const rows = rev.opts.map((o, k) => ({ o, k, fell: rev.fooled[k] || [] }))
    .filter((x) => x.o.truth || x.o.by.length || x.fell.length)
    .sort((a, b) => (a.o.truth ? 1 : 0) - (b.o.truth ? 1 : 0) || b.fell.length - a.fell.length);
  /* (on the TV, more than five rows go in two columns, the truth across the bottom: one column of nine shrank the
     whole screen to fit, 16 Nov screen check) */
  const step = tv ? (rows.length > 5 ? 0.6 : 0.9) : 0.6, big = rows.length > 6, cols = !!tv && rows.length > 5;   // (many rows: a quicker beat, the truth in under 6 s)
  const who = (ts: number[]): ReactNode => ts.length ? <span className="flex items-center gap-1 flex-wrap">{ts.map((t) => <Dot key={t} t={t} color={teams[t]?.color ?? "#888"} size={tv ? (big ? 20 : 24) : 15} />)}</span> : null;
  return (
    <div className={cols ? "grid grid-cols-2 w-full" : "flex flex-col w-full"} style={{ gap: tv ? (cols ? 10 : big ? 6 : 10) : 6 }}>
      {rows.map((x, i) => {
        /* (a name ending in s takes the apostrophe alone: "Owls' lie") */
        const by = names(x.o.by), t = x.o.truth, tag = t ? "The truth" : x.o.ours ? "One of ours" : `${by}${/s$/i.test(by) ? "'" : "'s"} lie`;
        const pred = !t && x.fell.filter((f) => rev.hits.some((h) => h.on === f && x.o.by.includes(h.by)));
        return (
          <div key={x.k} className={"fool-rev rv" + (t ? " truth" : "") + (tv ? " tv" : "") + (cols && t ? " col-span-2" : "")} style={{ animationDelay: `${i * step}s`, ...(tv ? { fontSize: cols ? 24 : big ? 22 : 28, padding: big && !cols ? "6px 14px" : undefined } : {}) }}>
            <div className="min-w-0 flex-1 text-left">
              <div className="font-bold leading-snug"><bdi>{x.o.text}</bdi></div>
              <div className="eyebrow" style={{ fontSize: tv ? (big ? 12 : 14) : 10, color: t ? "var(--color-gold)" : x.o.ours ? "var(--color-ink-3)" : undefined }}>{tag}</div>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
              {who(x.fell)}
              <span className="text-[var(--color-ink-3)]" style={{ fontSize: tv ? (big ? 13 : 16) : 11 }}>
                {t ? (x.fell.length ? "found it" : "nobody found it") : x.fell.length ? (pred && pred.length ? "fell for it, as predicted" : "fell for it") : "nobody fell for it"}</span>
            </div>
          </div>);
      })}
      <div className={"rv flex flex-wrap justify-center gap-x-6 gap-y-1 font-bold" + (cols ? " col-span-2" : "")} style={{ animationDelay: `${rows.length * step}s`, fontSize: tv ? 26 : 15 }}>
        {teams.map((tm, i) => <span key={i} style={{ color: tm.color }}><bdi>{tm.name}</bdi> {rev.pts[i] > 0 ? `+${rev.pts[i]}` : rev.pts[i] < 0 ? `−${-rev.pts[i]}` : "0"}</span>)}
      </div>
      {rev.notes && <p className={"rv text-center text-[var(--color-ink-2)] leading-snug" + (cols ? " col-span-2" : "")} style={{ animationDelay: `${rows.length * step + 0.3}s`, fontSize: tv ? 20 : 13 }}>{rev.notes}</p>}
    </div>);
}

/* the opts index of this team's own lie (a captain's phone leaves it out of the picks): matched by what it sent, as the
   TV matches two lies that are the same (a typo, a plural: shown once) */
export const ownIndex = (opts: string[] | undefined, lie: string | null | undefined) => {
  if (!opts || !lie) return -1;
  const l = QMB.foolShow(lie);
  return l ? opts.findIndex((o) => QMB.foolSame(l, o)) : -1;
};
/* 3 to 8 teams: the team a captain says will fall for its lie (any team but its own) */
export function FoolPredict({ teams, me, value, onPick, busy, locked }: { teams: FoolTeam[]; me: number; value: number | null; onPick: (t: number) => void; busy?: boolean; locked?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Who will fall for your lie?">
      {teams.map((t, i) => i === me ? null : (
        <button key={i} type="button" className="btn btn-sm fool-team" aria-pressed={value === i} disabled={busy || locked} onClick={() => onPick(i)}
          style={value === i ? { background: t.color, color: "#04050e", borderColor: "transparent" } : { borderColor: t.color }}>
          <Dot t={i} color={value === i ? "#04050e" : t.color} size={14} /><bdi className="truncate">{t.name}</bdi></button>))}
    </div>);
}
export type { FoolOpt };
