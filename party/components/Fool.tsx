"use client";
/* FOOL ME TWICE's screens (the owner, 16 Nov), the same pieces on the TV and every phone, 2 teams or 8: the fact with
   its blank, who has written and picked, the answers to pick from, and the reveal (each lie, whose it was and who fell
   for it, the truth first). The rules are in lib/fool.ts. */
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { FOOL_PEN_END as PEN_END, foolAwards, foolAwardWhat, rvFool, type FoolOpt, type FoolPub, type FoolRev, type FoolSum } from "@/lib/fool";
import { Dot } from "./many/PartsMany";
import { QMB } from "@/lib/engine";

export type FoolTeam = { name: string; color: string };
const LETTERS = "ABCDEFGHI";

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

/* a phone's own order (16 Nov, the owner): every phone shuffles the answers its own way, so no two phones show them in
   the same order (seed: who's holding it and the fact); the TV keeps the order the game dealt. Each answer keeps the
   TV's letter wherever it is (19 Nov review: the room shouted "it's D!" and D on a phone was another answer) */
/* (the last steps stir every bit: without them the answer's number, last in the string, decided most of the order, and
   1 phone in 14 showed the same order as another, 1 in 16 the TV's own: 21 Nov) */
const mix = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
/* the answers to pick from: on the TV, all of them; on a captain's phone, buttons (its own lie left out) */
/* (locked: the pick is sent, no other tap; by default once one is picked: with 3 to 8 teams the captain can change it
   until Lock in) */
/* (compact, on a phone (16 Nov, the owner: with many teams every answer in one screen): 1, smaller rows; 2, two columns) */
export function FoolOptions({ opts, tv, onPick, hide, mine, busy, locked, seed, compact = 0 }: { opts: string[]; tv?: boolean; onPick?: (k: number) => void; hide?: number[]; mine?: number | null; busy?: boolean; locked?: boolean; seed?: string; compact?: 0 | 1 | 2 }) {
  let shown = opts.map((o, k) => ({ o, k })).filter((x) => !hide?.includes(x.k));
  if (seed && !tv) shown = shown.map((x) => ({ ...x, h: mix(seed + "|" + x.k) })).sort((a, b) => a.h - b.h);
  const two = tv ? shown.length > 4 : compact === 2;
  return (
    <div className={"grid w-full gap-2 fool-opts " + (two ? "grid-cols-2" : "grid-cols-1") + (compact && !tv ? " fool-cmp" : "")} style={tv ? { gap: shown.length > 6 ? 10 : 14 } : compact ? { gap: 6 } : undefined} role={onPick ? "group" : "list"} aria-label="The answers">
      {shown.map(({ o, k }, i) => {
        const on = mine === k, body = <><span className="fool-letter">{LETTERS[k]}</span><span className="min-w-0 text-left leading-snug"><bdi>{o}</bdi></span></>;
        return onPick
          ? <button key={k} type="button" className={"fool-opt" + (on ? " on" : "")} disabled={busy || (locked ?? mine != null)} aria-pressed={on} onClick={() => onPick(k)}>{body}</button>
          : <div key={k} className={"fool-opt" + (tv ? " tv" : "") + (on ? " on" : "")} role="listitem" style={tv ? { fontSize: shown.length > 6 ? 24 : 30 } : undefined}>{body}</div>;
      })}
    </div>);
}

/* a right prediction (the owner's pick, 17 Nov: the flip board): whose lie it is flips over, like a station board, to
   "As expected, Gotcha! Lions −1, Owls +1" and back, every few seconds: "As expected, Gotcha!" in grey, the team that
   fell for it in its colour, its −1 in red, the team that called it in its colour, its +1 in green (21 Nov); and the
   team that fell for it gets a red ring on its dot. It adds no line: every row of a reveal is the same
   size, with one or without (16 Nov, the owner: "all should fit in the same size boxes, all the time"). 3 to 8 teams
   only: with 2 teams nobody names a team */

/* the reveal: the truth first, on top, in gold, with who guessed it (16 Nov, the owner); then each answer that fooled
   someone or was a team's, whose it was and who fell for it; ours nobody fell for go quietly. Then each team's points */
/* TRIAL (21 Nov, for the owner's choice, pictures only): how the Gotcha line names the teams. "names", the game now;
   "letters", from 5 teams the teams' dots instead of their names (option A); "points", the owner's idea: the lie's own
   points on its label ("Lions' lie, +2") and only the −1 on the Gotcha side; "both", the two together. Set by the screen check
   (SCREENS_GOTCHA); qmb.flap = "a" holds the board on the label side with motion off. Goes once the owner picks. */
function useGotchaTrial() {
  const [v, setV] = useState({ style: "names", flapA: false });
  useEffect(() => { try { setV({ style: localStorage.getItem("qmb.gotcha") || "names", flapA: localStorage.getItem("qmb.flap") === "a" }); } catch { /* */ } }, []);
  return v;
}
export function FoolReveal({ rev, teams, tv }: { rev: FoolRev; teams: FoolTeam[]; tv?: boolean }) {
  const trial = useGotchaTrial(), dots = (trial.style === "letters" || trial.style === "both") && teams.length >= 5, pts = trial.style === "points" || trial.style === "both";
  const names = (ts: number[]) => ts.map((t) => teams[t]?.name ?? "").join(" & ");
  const rows = rev.opts.map((o, k) => ({ o, k, fell: rev.fooled[k] || [] }))
    .filter((x) => x.o.truth || x.o.by.length || x.fell.length)
    .sort((a, b) => (b.o.truth ? 1 : 0) - (a.o.truth ? 1 : 0) || b.fell.length - a.fell.length);
  /* (on the TV, more than five rows go in two columns, the truth across the top: one column of nine shrank the
     whole screen to fit, 16 Nov screen check) */
  const step = tv ? (rows.length > 5 ? 0.6 : 0.9) : 0.6, big = rows.length > 6, cols = !!tv && rows.length > 5;   // (many rows: a quicker beat, the truth in under 6 s)
  const gap = tv ? (cols ? 10 : big ? 6 : 10) : 6, ds = tv ? (big ? 20 : 24) : 15;
  /* who fell for it: each team's dot; the team a right prediction named, in a red ring */
  const who = (ts: number[], hit: number[]): ReactNode => ts.length ? <span className="flex items-center justify-end gap-1.5 flex-wrap">{ts.map((t) => {
    const dot = <Dot key={t} t={t} color={teams[t]?.color ?? "#888"} size={ds} />;
    return hit.includes(t) ? <span key={t} className="fool-ring">{dot}</span> : dot; })}</span> : null;
  /* (a team's name in its colour, 16 Nov, the owner: "Team D's lie") */
  /* (trial "points": what the lie earned its team: 1 a team fooled, 1 more for the right call) */
  const lieGot = (x: { k: number; fell: number[]; o: FoolOpt }) => { const w = x.o.by[0]; if (w == null) return 0;
    return x.fell.filter((f) => f !== w).length + rev.hits.filter((h) => h.by === w && x.fell.includes(h.on)).length; };
  const named = (ts: number[], and = " & "): ReactNode => ts.map((w, j) => <Fragment key={w}>{j ? and : ""}<bdi style={{ color: teams[w]?.color }}>{teams[w]?.name}</bdi></Fragment>);
  return (
    <div className="flex flex-col w-full" style={{ gap }}>
      {/* (every row the same height, the tallest's: 16 Nov, the owner) */}
      <div className={"grid w-full " + (cols ? "grid-cols-2" : "grid-cols-1")} style={{ gap, gridAutoRows: "1fr" }}>
      {rows.map((x, i) => {
        /* (a name ending in s takes the apostrophe alone: "Owls' lie") */
        const by = names(x.o.by), t = x.o.truth, tag: ReactNode = t ? "The truth" : x.o.ours ? "One of ours" : <>{named(x.o.by)}{/s$/i.test(by.replace(/[\u2066-\u2069]/g, "")) ? "'" : "'s"} lie{pts && lieGot(x) > 0 ? <>, <span style={{ color: "var(--color-ok)" }}>+{lieGot(x)}</span></> : null}</>;   // (2-team names carry invisible direction marks)
        /* a right prediction: the team whose lie it is named the team that fell for it */
        const pred = t ? [] : x.fell.filter((f) => rev.hits.some((h) => h.on === f && x.o.by.includes(h.by)));
        const got = pred.length > 0, d = { ["--d" as string]: `${i * step + 0.35}s` };
        /* ...and who called it: +1 more each, in green (21 Nov, the owner: "As expected, Gotcha! Lions −1, Owls +1") */
        const callers = x.o.by.filter((w) => rev.hits.some((h) => h.by === w && pred.includes(h.on)));
        const said = `As expected, Gotcha! ${[...pred.map((f) => `${teams[f]?.name} −1`), ...callers.map((w) => `${teams[w]?.name} +1`)].join(", ")}.`;
        const nm = (w: number) => dots ? <span className="inline-block align-middle" style={{ marginInline: 2 }}><Dot t={w} color={teams[w]?.color ?? "#888"} size={tv ? (big ? 18 : 20) : 12} /></span> : <bdi style={{ color: teams[w]?.color }}>{teams[w]?.name}</bdi>;
        const label = got ? <span className={"fool-flap" + (trial.flapA ? " show-a" : "")}><span className="fool-flap-a">{tag}</span><span className="fool-flap-b" aria-hidden="true">
          <span style={{ color: "var(--color-ink-2)" }}>As expected, Gotcha!</span>{pred.map((f, j) => <Fragment key={f}>{j ? "," : ""} {nm(f)} <span style={{ color: "var(--color-no)" }}>−1</span></Fragment>)}
          {!pts && callers.map((w) => <Fragment key={"c" + w}>, {nm(w)} <span style={{ color: "var(--color-ok)" }}>+1</span></Fragment>)}</span></span> : tag;
        const caption = t ? (x.fell.length ? "guessed it" : "nobody guessed it") : x.fell.length ? "fell for it" : "nobody fell for it";
        return (
          <div key={x.k} className={"fool-rev rv relative" + (t ? " truth" : "") + (tv ? " tv" : "") + (cols && t ? " col-span-2" : "")} style={{ animationDelay: `${i * step}s`, ...d, ...(tv ? { fontSize: cols ? 24 : big ? 22 : 28, padding: big && !cols ? "6px 14px" : undefined } : {}) }}>
            {got && <span className="sr-only">{said}</span>}
            <div className="min-w-0 flex-1 text-left">
              <div className="font-bold leading-snug"><bdi>{x.o.text}</bdi></div>
              <div className="eyebrow" style={{ fontSize: tv ? (big ? 16 : 18) : 10, color: t ? "var(--color-gold)" : x.o.ours ? "var(--color-ink-3)" : undefined }}>{label}</div>
            </div>
            {/* (on a phone, many teams' dots wrap onto a second line rather than squeeze the lie) */}
            <div className="flex flex-col items-end gap-0.5 shrink-0 text-right" style={tv ? undefined : { maxWidth: "46%" }}>
              {who(x.fell, pred)}
              <span className="text-[var(--color-ink-3)]" style={{ fontSize: tv ? (big ? 16 : 18) : 11 }}>{caption}</span>
            </div>
          </div>);
      })}
      </div>
      <div className="rv flex flex-wrap justify-center gap-x-6 gap-y-1 font-bold" style={{ animationDelay: `${rows.length * step}s`, fontSize: tv ? 26 : 15 }}>
        {teams.map((tm, i) => <span key={i} style={{ color: tm.color }}><bdi>{tm.name}</bdi> {rev.pts[i] > 0 ? `+${rev.pts[i]}` : rev.pts[i] < 0 ? `−${-rev.pts[i]}` : "0"}</span>)}
      </div>
      {rev.notes && <p className="rv text-center text-[var(--color-ink-2)] leading-snug" style={{ animationDelay: `${rows.length * step + 0.3}s`, fontSize: tv ? 20 : 13 }}>{rev.notes}</p>}
    </div>);
}

/* the opts index of this team's own lie (a captain's phone leaves it out of the picks): matched by what it sent, as the
   TV matches two lies that are the same (a typo, a plural: shown once) */
export const ownIndex = (opts: string[] | undefined, lie: string | null | undefined) => {
  if (!opts || !lie) return -1;
  const l = QMB.foolShow(lie);
  return l ? opts.findIndex((o) => QMB.foolSame(l, o)) : -1;
};
/* 3 to 8 teams: the team a captain says will fall for its lie (any team but its own). From 5 teams, one row of the teams'
   letters (in their colours, as on the scores), the team picked named under it: every answer and this fit in one screen */
export function FoolPredict({ teams, me, value, onPick, busy, locked, compact }: { teams: FoolTeam[]; me: number; value: number | null; onPick: (t: number) => void; busy?: boolean; locked?: boolean; compact?: boolean }) {
  if (compact) return (
    <div className="flex flex-col items-center gap-1">
      {/* (8 teams: 7 circles of 44px, 2px apart, still one row on a 360-wide phone: 21 Nov) */}
      <div className="flex flex-wrap justify-center" style={{ gap: teams.length >= 8 ? 2 : 4 }} role="group" aria-label="Who will fall for your lie?">
        {teams.map((t, i) => i === me ? null : (
          <button key={i} type="button" className="fool-dot" aria-pressed={value === i} aria-label={t.name} disabled={busy || locked} onClick={() => onPick(i)}
            style={{ ["--c" as string]: t.color }}>{LETTERS[i]}</button>))}
      </div>
    </div>);
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Who will fall for your lie?">
      {teams.map((t, i) => i === me ? null : (
        <button key={i} type="button" className="btn btn-sm fool-team" aria-pressed={value === i} disabled={busy || locked} onClick={() => onPick(i)}
          style={value === i ? { background: t.color, color: "#04050e", borderColor: "transparent" } : { borderColor: t.color }}>
          <Dot t={i} color={value === i ? "#04050e" : t.color} size={14} /><bdi className="truncate">{t.name}</bdi></button>))}
    </div>);
}
export type { FoolOpt };

/* ---- THE RESULT (16 Nov, the owner's pick of four: the lie detector, with four awards under it). A polygraph's ivory
   paper with its red grid: each team's pen draws its points fact by fact (up for the truth or a team fooled, down for
   falling for a lie meant for it), trembling as a lie detector's does; at each pen's end the team's letter, points,
   name, place and what it adds to the night. The winner's line glows and the paper's bulbs light up and chase; then
   the points fly into the totals (as in every game), and the awards come in. ---- */
const PLACE = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
const bare = (x: string) => x.replace(/[\u2066-\u2069]/g, "");
export function FoolResult({ teams, sum, pts, places, award, two }: { teams: FoolTeam[]; sum: FoolSum; pts: number[]; places: number[]; award: number[]; two?: boolean }) {
  const k = teams.length, dense = k > 4, rv = rvFool(places, k), done = PEN_END + rv.done, N = Math.max(1, sum.tally.length);
  const W = two ? 860 : dense ? 1000 : 960, H = two ? 220 : dense ? 200 : 190, L = 26, R = 360, top = 16, bot = 28, gw = W - L - R, gh = H - top - bot;
  const all = [0, ...sum.tally.flat()], lo = Math.min(...all), hi = Math.max(1, ...all);
  const X = (i: number) => L + (i / N) * gw, Y = (v: number) => top + gh - ((v - lo) / (hi - lo || 1)) * gh;
  const lit = (t: number) => award[t] > 0 && places[t] === 1;
  const end = (t: number) => (sum.tally.length ? sum.tally[sum.tally.length - 1][t] : 0);
  /* a pen's trace: its points after each fact, a little tremor between (the same for a team every time) */
  const path = (t: number) => { let z = 11 + t * 7919; const r = () => (z = (z * 16807) % 2147483647) / 2147483647;
    let d = `M${X(0)},${Y(0)}`, prev = 0;
    sum.tally.forEach((row, f) => { const v = row[t];
      for (let j = 1; j <= 4; j++) d += ` L${(X(f) + (j / 5) * (X(f + 1) - X(f))).toFixed(1)},${(Y(prev + ((v - prev) * j) / 5) + (r() - 0.5) * (j % 2 ? 8 : 4)).toFixed(1)}`;
      d += ` L${X(f + 1).toFixed(1)},${Y(v).toFixed(1)}`; prev = v; });
    return d; };
  /* the labels at the pens' ends, kept apart, inside the paper (closer together if eight need it) */
  const lo2 = 22, hi2 = H - 12, gap = Math.min(dense ? 22 : 27, (hi2 - lo2) / Math.max(1, k - 1)), at: number[] = []; let y0 = -Infinity;
  teams.map((_, t) => t).sort((a, b) => Y(end(a)) - Y(end(b)) || a - b).forEach((t) => { at[t] = Math.max(Y(end(t)), lo2, y0 + gap); y0 = at[t]; });
  const over = y0 - hi2; if (over > 0) at.forEach((v, t) => { at[t] = v - over; });
  const fs = dense ? (k > 6 ? 17 : 18) : 21, order = teams.map((_, t) => t).sort((a, b) => places[a] - places[b] || a - b);
  const AW = foolAwards(sum, !!two);
  /* (an award's teams: one, its name in its colour; two tied, each name in its own colour; three or more, their letters) */
  const who = (ts: number[]) => foolAwardWho(ts, teams, dense ? 22 : 26);
  return (
    <div className="flex flex-col items-center w-full" style={{ gap: dense ? 18 : 22 }}>
      <div className="ld-paper ld-bulbs" role="img" aria-label={"Each team's points, fact by fact: " + order.map((t) => `${bare(teams[t].name)} ${pts[t]}`).join(", ")} style={{ width: W, maxWidth: "100%", ["--g" as string]: done + "s" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block", overflow: "hidden", borderRadius: 14, maxWidth: "100%", height: "auto" }} aria-hidden>
          <g className="ld-grid">
            {Array.from({ length: Math.ceil(W / 24) + 2 }, (_, i) => <line key={"v" + i} x1={L + i * 24} y1={0} x2={L + i * 24} y2={H} stroke="rgba(201,40,58,.16)" strokeWidth={1} />)}
            {Array.from({ length: 9 }, (_, i) => <line key={"h" + i} x1={0} y1={top + (i * gh) / 8} x2={W + 30} y2={top + (i * gh) / 8} stroke="rgba(201,40,58,.16)" strokeWidth={1} />)}
          </g>
          {Array.from({ length: N }, (_, f) => (
            <g key={"f" + f}>
              <text x={(X(f) + X(f + 1)) / 2} y={H - 9} textAnchor="middle" fontSize={16} fontWeight={800} fill="rgba(27,22,7,.55)" letterSpacing=".12em">FACT {f + 1}</text>
              <line x1={X(f + 1)} y1={top} x2={X(f + 1)} y2={H - bot} stroke="rgba(27,22,7,.2)" strokeDasharray="3 4" />
            </g>))}
          <line x1={L} y1={Y(0)} x2={X(N)} y2={Y(0)} stroke="rgba(27,22,7,.35)" />
          {/* (the winner's pen drawn last, on top) */}
          {[...order].reverse().map((t) => { const c = teams[t].color, d = path(t), w = lit(t); return (
            <g key={"p" + t}>
              <path className={"ld-pen" + (w ? " win" : "")} d={d} pathLength={1} stroke={c} style={{ ["--c" as string]: c }} />
              <circle className="ld-head" r={w ? 6 : 4.5} fill={c} style={{ offsetPath: `path('${d}')` }} />
            </g>); })}
          {order.map((t) => { const c = teams[t].color, paid = award[t] > 0, y = at[t], nm = bare(teams[t].name); return (
            <g key={"l" + t} className={"ld-lab" + (lit(t) ? " win" : "")} style={{ ["--d" as string]: PEN_END + rv.at(t) + "s", ["--c" as string]: c }}>
              <line x1={X(N) + 4} y1={Y(end(t))} x2={X(N) + 18} y2={y} stroke={c} strokeWidth={1.5} opacity={0.7} />
              <circle cx={X(N) + 30} cy={y} r={dense ? 9 : 11} fill={c} />
              <text x={X(N) + 30} y={y + 4} textAnchor="middle" fontSize={dense ? 10 : 12} fontWeight={800} fill="#04050e">{LETTERS[t]}</text>
              <text x={X(N) + 46} y={y + 7} fontFamily="var(--font-display)" fontSize={fs + 3} fill="#1b1607">{pts[t] < 0 ? `−${-pts[t]}` : pts[t]}</text>
              <text x={X(N) + 84} y={y + 6} fontSize={fs - 4} fontWeight={800} fill={c} stroke="rgba(0,0,0,.35)" strokeWidth={0.6} style={{ paintOrder: "stroke" }}>{nm.length > 16 ? nm.slice(0, 15) + "…" : nm}</text>
              <text x={W - 12} y={y + 7} textAnchor="end" fontFamily="var(--font-display)" fontSize={fs + 1} fill={paid ? "#1f8a57" : "#9a937d"}>{paid ? `${PLACE[places[t]] || places[t] + "th"}  +${award[t]}` : "0"}</text>
            </g>); })}
        </svg>
      </div>
      {/* the awards, as the night's (16 Nov, the owner): the most correct, the best liars, the best prediction (3 to 8
          teams), and the team fooled the most; tied teams share one, a 0 has none */}
      {AW.length > 0 && (
        <div className="grid w-full" style={{ gap: dense ? 10 : 14, maxWidth: W, gridTemplateColumns: `repeat(${AW.length}, minmax(0, 1fr))` }} role="list" aria-label="The awards">
          {AW.map((a, i) => { const c = a.teams.length === 1 ? teams[a.teams[0]]?.color : undefined; return (
            <div key={a.t} role="listitem" className="rv card !p-2 !px-3 text-left min-w-0" style={{ animationDelay: done + 0.7 + i * 0.3 + "s", borderColor: c, background: "linear-gradient(180deg, #151a3c, #0c1028)" }}>
              <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: dense ? 14 : 16 }}>{a.spoon ? "🥄" : "🏆"} {a.t}</div>
              <div className="font-bold leading-snug line-clamp-2" style={{ fontSize: dense ? 18 : 20 }}>{who(a.teams)}</div>
              <div className="text-[var(--color-ink-2)] leading-snug" style={{ fontSize: dense ? 14 : 16 }}>{foolAwardWhat(a, !!two)}</div>
            </div>); })}
        </div>)}
    </div>);
}
/* an award's teams (16 Nov, the owner): one team, its name in its colour; two tied, each name in its own colour; three
   or more, their letters (as on the scores) */
export function foolAwardWho(ts: number[], teams: FoolTeam[], dot: number): ReactNode {
  if (ts.length >= 3) return <span className="inline-flex flex-wrap items-center gap-1 align-middle" aria-label={ts.map((t) => teams[t]?.name).join(", ")}>{ts.map((t) => <Dot key={t} t={t} color={teams[t]?.color ?? "#888"} size={dot} />)}</span>;
  /* (each name whole on its line: a long one moves down entire) */
  return <>{ts.map((t, i) => <Fragment key={t}>{i > 0 && <span className="text-[var(--color-ink-2)]"> &amp; </span>}<bdi className="inline-block whitespace-nowrap max-w-full overflow-hidden text-ellipsis align-bottom" style={{ color: teams[t]?.color }}>{teams[t]?.name}</bdi></Fragment>)}</>;
}
/* the phones' list of the awards (with no TV, the result is the list, as in every game; the awards under it) */
export const foolAwardList = (sum: FoolSum, teams: FoolTeam[], two: boolean) => foolAwards(sum, two).map((a) => ({
  t: a.t, spoon: a.spoon, color: a.teams.length === 1 ? teams[a.teams[0]]?.color : undefined,
  who: `${a.teams.map((t) => teams[t]?.name ?? "").join(" & ")}: ${foolAwardWhat(a, two)}`,
  node: <>{foolAwardWho(a.teams, teams, 18)}<span className="text-[var(--color-ink-2)] font-normal">: {foolAwardWhat(a, two)}</span></> }));
