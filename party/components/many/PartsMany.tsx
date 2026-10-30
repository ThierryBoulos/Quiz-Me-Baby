"use client";
/* MANY TEAMS: the pieces the TV and every phone share, each the two-team one (components/GameParts.tsx)
   drawn for 3 to 8 teams: the tracker, the game's intro with its rules, the board of columns (a result, the
   standings), the ranked lists of a reveal, and the phone's Scores sheet. Same classes, same words. */
import { useEffect, useState, type ReactNode } from "react";
import { Roll, Verdict } from "../GameParts";
import { showKm, showNum } from "@/lib/game";
import { LETTERS, PLACE_PTS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";

export type Size = "tv" | "phone";
/* the team's letter in its dot: eight colours never need telling apart */
export function Dot({ t, color, size = 18 }: { t: number; color: string; size?: number }) {
  return <span className="dot ltr" aria-hidden style={{ background: color, width: size, height: size, fontSize: size >= 24 ? 13 : size >= 16 ? 11 : 8, boxShadow: `0 0 12px ${color}` }}>{LETTERS[t]}</span>;
}
/* how the teams are packed: up to four sit side by side as the two do; five and six squeeze; seven and eight stack */
export const packing = (k: number) => (k > 5 ? "stack" : k > 4 ? "mid" : "");
/* columns for a board or a grid of teams: all in one row up to four, then rows of three or four */
export const colsFor = (k: number) => (k <= 4 ? k : k <= 6 ? 3 : 4);

export const place = (n: number) => ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][n] || `${n}th`;
export const pct = (x: number) => `${Math.round(100 * x)}%`;
/* who leads the night (one team, or nobody when the top is shared) */
export function leader(pub: PubMany): number | null {
  const best = Math.max(...pub.teams.map((t) => t.score));
  const top = pub.teams.map((t, i) => (t.score === best ? i : -1)).filter((i) => i >= 0);
  return best > 0 && top.length === 1 ? top[0] : null;
}
/* who takes this leg, in words, and whose colour it's said in (the TV and every phone say the same) */
export function takes(pub: PubMany): { text: string; color: string } {
  const w = pub.reveal?.winners || [], T = pub.teams;
  if (!w.length) return { text: pub.game?.key === "flag" ? "Nobody gets it" : "Nobody takes it", color: "var(--color-ink-2)" };
  if (w.length === 1) return { text: `${T[w[0]].name} takes it`, color: T[w[0]].color };
  if (w.length === T.length) return { text: "Everyone takes it", color: "var(--color-gold)" };
  return { text: `${w.length} teams take it`, color: "var(--color-gold)" };
}
/* a game's result, in words: who came 1st and what it pays ("TEAM A +10", "2 TEAMS SHARE 1ST · +10 EACH") */
export function paid(pub: PubMany): { text: string; color: string } {
  const S = pub.summary, T = pub.teams;
  const top = (S?.places || []).map((p, t) => (p === 1 && (S?.award[t] ?? 0) > 0 ? t : -1)).filter((t) => t >= 0);
  if (!top.length) return { text: "Nobody scores", color: "var(--color-ink-2)" };
  if (top.length === 1) return { text: `${T[top[0]].name} +${S!.award[top[0]]}`, color: T[top[0]].color };
  return { text: `${top.length > 2 ? `${top.length} teams` : top.map((t) => T[t].name).join(" & ")} share 1st · +${S!.award[top[0]]} each`, color: "var(--color-gold)" };
}
/* the teams in the order of a reveal: the nearest first, the ones with nothing at the end */
export const byDistance = (pub: PubMany) => {
  const off = pub.reveal?.off || [];
  return pub.teams.map((_, i) => i).sort((a, b) => (off[a] == null ? 1 : 0) - (off[b] == null ? 1 : 0) || (off[a] ?? 0) - (off[b] ?? 0) || a - b);
};

/* ---- the tracker: the room code, the teams along the top, the night's label and pips under them, then this game's tally.
   The phone keeps only the label, the pips and whose side you're on: the scores are behind its Scores button. ---- */
export function HudMany({ pub, size, code, me, host }: { pub: PubMany; size: Size; code?: string; me?: number | null; host?: boolean }) {
  const T = pub.teams, g = pub.game, k = T.length, tv = size === "tv", pc = g?.key === "majority";
  const label = pub.screen === "final" ? <b>Final result</b> : g
    ? <><b>{g.title}</b> &nbsp;·&nbsp; {pub.screen === "intro" ? `Game ${g.index + 1} of ${g.count}` : pub.screen === "summary" ? "Final" : `${pc ? "Question" : "Leg"} ${g.leg} of ${g.of}`}</>
    : null;
  /* a pip a game, as the two-team night's mini-games are pips */
  const pips = g ? Array.from({ length: g.count }, (_, i) => (i < g.index || pub.screen === "final" ? "done" : i === g.index ? "now" : "")) : [];
  /* the team row's number (the owner's idea, 30 Oct: the game's score and the night's on screen at once was too much):
     during a game, this game's points (Majority Rules: its share right); between games, the night's totals. On a
     game's result, what each place pays flies up from the board into the totals, then they roll up */
  const inGame = !!g && (pub.screen === "q" || pub.screen === "reveal");
  const award = pub.screen === "summary" ? pub.summary?.award : undefined;
  const [landed, setLanded] = useState(false);
  useEffect(() => { setLanded(false); if (pub.screen !== "summary") return; const t = setTimeout(() => setLanded(true), 1500); return () => clearTimeout(t); }, [pub.screen, pub.step]);
  const num = (i: number) => (inGame && !pc ? g!.pts[i] : award && !landed ? T[i].score - (award[i] || 0) : T[i].score);
  const order = award ? T.map((_, i) => i).sort((a, b) => (pub.summary!.places[a] - pub.summary!.places[b]) || a - b) : [];
  return (
    <div className={`hud ${size} many ${packing(k)}`} role="group" aria-label={tv ? "Scores" : "Where we are"}>
      {/* the room code, small, top middle, where the two-team TV has it */}
      {tv && code && <div className="hud-code many-code">Room {code}</div>}
      {tv && <div className="hud-in">
        {T.map((t, i) => (
          <div key={i} className="hud-team" style={{ ["--c" as string]: t.color }}>
            <div className="flex items-center gap-2 min-w-0"><Dot t={i} color={t.color} size={k > 5 ? 16 : k > 4 ? 18 : 22} /><div className="nm"><bdi>{t.name}</bdi></div>
              {pub.fire?.[i] && <span className="flame" title="On fire" aria-label="on fire">🔥</span>}</div>
            {/* a new mode starts its numbers fresh (no roll from a game's points down to the totals) */}
            <div className="sc" data-score={i}>{inGame && pc ? pct(g!.shares?.[i] ?? 0) : <Roll key={inGame ? "g" + g!.index : "t"} v={num(i)} />}</div>
            {award && !landed && (award[i] || 0) > 0 && <span className="hud-plus" style={{ animationDelay: order.indexOf(i) * 0.07 + "s" }} aria-hidden>+{award[i]}</span>}
          </div>))}
      </div>}
      <div className="hud-mid">
        {label && <div className="hud-label">{label}</div>}
        {pips.length > 0 && <div className="pips" aria-hidden>{pips.map((p, i) => <span key={i} className={`pip mini ${p}`} />)}</div>}
      </div>
      {/* what the numbers are: this game's, while it's on */}
      {tv && inGame && <div className="hud-mini"><span>{pc ? "Share right, this game" : "Points this game"} · the night&rsquo;s totals after it</span></div>}
      {/* the phone: whose side you're on, small, in the team's colour (the screen's glow is that colour too) */}
      {!tv && me != null && T[me] && <div className="hud-mini" style={{ ["--c" as string]: T[me].color }}><span>You&rsquo;re on</span><Dot t={me} color={T[me].color} size={14} /><span className="nm" style={{ color: T[me].color }}><bdi>{T[me].name}</bdi></span></div>}
      {!tv && me == null && host && <div className="hud-mini"><span>You&rsquo;re the host</span></div>}
    </div>);
}

/* ---- a game's intro: the title, the gold band, the numbered rules (GameParts' MiniIntro, for N teams) ---- */
function rules(pub: PubMany): string[] {
  const g = pub.game!, n = g.of, k = pub.teams.length;
  /* points by place (30 Oct): what a question pays, and what the game's places pay the night */
  const pay = `At the end, places pay the night: ${PLACE_PTS.slice(0, k).join(", ")}. Level teams share the better place.`;
  const each = (by: string) => `Every leg ranks all ${k} teams ${by}: 1st scores ${k}, 2nd ${k - 1}, down to 1 for last. No answer scores nothing.`;
  switch (g.key) {
    case "majority": return [
      "Everyone plays on their own phone, captains too. The lists are fixed at Start.",
      `${n} questions, four answers each. One tap and it's locked. No answer counts as wrong.`,
      "Eyes on your own phone: every phone has the answers in a different order.",
      `Teams are ranked by the share of their answers that are right, so a smaller team isn't at a disadvantage. ${pay}`];
    case "flag": return [
      `A flag goes up. All ${k} captains type whose it is, at the same time.`,
      `The app checks them, and the host can change a call. Right answers are ranked by who sent first: the fastest scores ${k}, the next ${k - 1}, and so on. Wrong scores nothing.`, pay];
    case "closest": return [
      `All ${k} teams get the same number question at the same time. Each captain locks in one number on their phone.`,
      each("by how far off"), pay];
    case "pin": return [
      `A photo of a landmark goes up. All ${k} captains drop a pin on the world map on their phone, where they think it is. Pinch or tap + to zoom right in: the closer, the better.`,
      each("by the kilometre"), pay];
  }
}
/* compact: the TV's Majority Rules intro, which shares the screen with the QR code */
export function IntroMany({ pub, size, head, compact }: { pub: PubMany; size: Size; head?: ReactNode; compact?: boolean }) {
  const g = pub.game, tv = size === "tv";
  if (!g) return null;
  const band = g.key === "majority" ? `${g.of} questions` : `Best of ${g.of}`;
  return (
    <div className={"flex flex-col items-center text-center w-full " + (tv && !compact ? "gap-5" : "gap-4")}>
      {head || <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>Game {g.index + 1} of {g.count}</div>}
      <h1 className={"display" + (tv ? " slam" : "")} style={{ fontSize: tv ? (compact ? 64 : 88) : 44 }}>{g.title}</h1>
      <div className={"mini-band " + (tv ? "" : "sm")}>
        <span className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 15 : 11 }}>{band}</span>
        <span className="sep text-[var(--color-ink-3)]">·</span>
        <span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>Places pay {PLACE_PTS.slice(0, Math.min(3, pub.teams.length)).join(" · ")}{pub.teams.length > 3 ? " …" : ""}</span>
        <span className="sep text-[var(--color-ink-3)]">·</span>
        <span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>{pub.teams.length} teams</span>
      </div>
      <div className="card w-full">
        <ol className="rules" style={tv ? { fontSize: compact ? 18 : 20, gap: compact ? 8 : 12 } : undefined}>
          {rules(pub).map((r, i) => <li key={i}>{r}</li>)}
        </ol>
      </div>
    </div>);
}

/* ---- the board: a column a team, in the order given, each team's number big in its colour and its name under
   it; the columns that didn't take it dimmed (GameParts' ScoreBoard, for N teams). ---- */
export type Col = { t: number; big: string; sub?: ReactNode; place?: number; lit?: boolean };
export function BoardMany({ pub, cols, size, label, width }: { pub: PubMany; cols: Col[]; size: Size; label?: string; width?: number }) {
  const T = pub.teams, k = T.length, tv = size === "tv", dense = k > 4;
  const long = Math.max(...cols.map((c) => c.big.length));
  /* a phone with long numbers (1,000,000) takes two columns, so none is squeezed */
  const n = !tv && long > 4 && k > 3 ? 2 : colsFor(k);
  /* the numbers: a score fits big; a long guess (1,500,000) comes down a size */
  const v = tv ? (dense ? (long > 4 ? 44 : 64) : long > 6 ? 60 : long > 4 ? 80 : 110) : dense ? (long > 4 ? 24 : 32) : long > 4 ? 32 : 44;
  const anyLit = cols.some((c) => c.lit);
  return (
    <div className="board-many" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, maxWidth: width ?? (tv ? Math.min(1168, n * (dense ? 290 : 320)) : undefined), margin: "0 auto" }}
      aria-label={`${label ? label + ": " : ""}${cols.map((c) => `${T[c.t].name} ${c.big}`).join(", ")}`}>
      {cols.map((c) => (
        <div key={c.t} className={"col " + (anyLit && !c.lit ? "dim" : "") + (c.place === 1 ? " first" : "")} style={{ ["--c" as string]: T[c.t].color }}>
          {c.place != null && <div className="place" style={{ fontSize: tv ? (dense ? 15 : 18) : 11 }}>{place(c.place)}</div>}
          <div className="v" style={{ fontSize: v }}>{c.big}</div>
          <div className="nm" style={{ fontSize: tv ? (dense ? 13 : 18) : dense ? 10 : 12 }}><Dot t={c.t} color={T[c.t].color} size={tv ? (dense ? 14 : 18) : 12} /><span><bdi>{T[c.t].name}</bdi></span></div>
          {c.sub && <div className="sub" style={{ fontSize: tv ? (dense ? 15 : 20) : 12 }}>{c.sub}</div>}
        </div>))}
    </div>);
}
/* ---- Majority Rules' result on the TV (the owner's idea, 30 Oct): a bar a team, as tall as its share right, in
   place order, growing up one after another; the share on top, the place, the name and what it pays under it ---- */
export function BarsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, H = dense ? 180 : 240;
  const order = T.map((_, i) => i).sort((a, b) => S.places[a] - S.places[b] || a - b);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={"Share right: " + order.map((t) => `${T[t].name} ${pct(S.shares?.[t] ?? 0)}`).join(", ")}>
      {order.map((t, j) => { const v = S.shares?.[t] ?? 0, paid = S.award[t] > 0, lit = paid && S.places[t] === 1; return (
        <div key={t} role="listitem" className="flex flex-col items-center gap-1 min-w-0" style={{ width: dense ? 124 : 180 }}>
          <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }}>{pct(v)}</div>
          <div className="w-full flex items-end" style={{ height: H }}>
            <div className="bar-grow w-full" style={{ height: Math.max(4, v * H), borderRadius: "12px 12px 3px 3px", animationDelay: j * 0.08 + "s", opacity: paid ? 1 : 0.4,
              background: `linear-gradient(180deg, ${T[t].color}, color-mix(in srgb, ${T[t].color} 35%, transparent))`, boxShadow: lit ? `0 0 28px ${T[t].color}` : undefined }} />
          </div>
          <div className="display text-16 leading-none mt-1" style={{ color: lit ? "var(--color-gold)" : "var(--color-ink-3)" }}>{paid ? place(S.places[t]) : "—"}</div>
          <div className="flex items-center gap-1.5 min-w-0 max-w-full"><Dot t={t} color={T[t].color} size={dense ? 14 : 18} />
            <span className="eyebrow truncate" style={{ color: T[t].color, fontSize: dense ? 12 : 15 }}><bdi>{T[t].name}</bdi></span></div>
          <div className="display leading-none" style={{ fontSize: dense ? 22 : 28, color: paid ? "var(--color-ok)" : "var(--color-ink-3)" }}>{paid ? "+" + S.award[t] : "0"}</div>
        </div>); })}
    </div>);
}

/* the columns of a game's result, by place: the game's points (or the share right), and what the place pays */
export const summaryCols = (pub: PubMany): Col[] => {
  const S = pub.summary!;
  return pub.teams.map((_, t) => t).sort((a, b) => S.places[a] - S.places[b] || a - b).map((t) => ({ t, big: S.shares ? pct(S.shares[t]) : String(S.pts[t]),
    place: S.award[t] > 0 ? S.places[t] : undefined, lit: S.places[t] === 1 && S.award[t] > 0,
    sub: S.award[t] > 0 ? <b style={{ color: "var(--color-ok)" }}>+{S.award[t]}</b> : <span className="text-[var(--color-ink-3)]">nothing</span> }));
};
/* the columns of the final standings: by place */
export const finalCols = (pub: PubMany): Col[] => pub.final!.order.map(({ team, place: p }) => ({ t: team, big: String(pub.teams[team].score), place: p, lit: p === 1 }));
/* the columns of a Closest To Wins reveal: the nearest first */
export const closestCols = (pub: PubMany): Col[] => {
  const R = pub.reveal!;
  return byDistance(pub).map((t) => { const n = R.nums?.[t], off = R.off?.[t]; return {
    t, big: n == null ? "—" : showNum(n), lit: R.winners.includes(t),
    sub: n == null ? "No answer" : off === 0 ? "Spot on!" : `Off by ${showNum(off ?? 0)}` }; });
};

/* ---- a reveal's rows: each team's line, in the order given (a side column on the TV, a list on a phone), the
   ones who take it with a trophy ---- */
export function RowsMany({ pub, order, right, size, label, pts }: { pub: PubMany; order: number[]; right: (t: number) => ReactNode; size: Size; label?: (t: number) => ReactNode; pts?: number[] }) {
  const T = pub.teams, tv = size === "tv", dense = T.length > 4, W = pub.reveal?.winners || [];
  return (
    <div className="flex flex-col w-full" style={{ gap: tv ? (dense ? 2 : 8) : 4 }} role="list">
      {order.map((t) => (
        <div key={t} role="listitem" className="flex items-center gap-3 min-w-0" style={{ opacity: W.length && !W.includes(t) ? 0.55 : 1 }}>
          <Dot t={t} color={T[t].color} size={tv ? (dense ? 16 : 20) : 14} />
          <span className="display truncate flex-1 text-left" style={{ fontSize: tv ? (dense ? 22 : 28) : 16, color: T[t].color }}><bdi>{T[t].name}</bdi>{label?.(t)}</span>
          {/* who takes it: a trophy in a slot of its own, so a long name stops short of it and nothing moves */}
          {W.length > 0 && <span className="shrink-0 text-center leading-none" style={{ width: tv ? (dense ? 26 : 32) : 20, fontSize: tv ? (dense ? 18 : 24) : 14 }} role={W.includes(t) ? "img" : undefined} aria-label={W.includes(t) ? "takes it" : undefined}>{W.includes(t) ? "🏆" : ""}</span>}
          <span className="display shrink-0 text-right" style={{ fontSize: tv ? (dense ? 24 : 32) : 18 }}>{right(t)}</span>
          {/* what this leg pays, in a column of its own */}
          {pts && <span className="display shrink-0 text-right" style={{ width: tv ? (dense ? 40 : 52) : 30, fontSize: tv ? (dense ? 20 : 26) : 14, color: pts[t] ? "var(--color-ok)" : "var(--color-ink-3)" }}>{pts[t] ? "+" + pts[t] : "0"}</span>}
        </div>))}
    </div>);
}
/* a Drop the Pin reveal's rows: how far off */
export const kmOf = (pub: PubMany, t: number): ReactNode => (pub.reveal?.pins?.[t] ? showKm(pub.reveal.off?.[t] ?? 0) : <span className="text-[var(--color-ink-3)]">No pin</span>);

/* ---- a flag reveal: each team's ruling beside its name, what it typed under them (TvGame's TeamRows) ---- */
export function FlagRowsMany({ pub, size, delay }: { pub: PubMany; size: Size; delay?: (i: number) => React.CSSProperties }) {
  const T = pub.teams, R = pub.reveal!, k = T.length, tv = size === "tv", n = tv ? colsFor(k) : k > 4 ? 2 : 1, dense = k > 4;
  const long = T.some((t) => t.name.length > 10);
  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: tv ? "12px 24px" : "12px 10px", maxWidth: tv ? Math.min(1168, n * (dense ? 300 : 390)) : undefined, ["--beat" as string]: ".4s" }}>
      {T.map((t, i) => { const ok = R.ok?.[i], x = R.typed?.[i]; return (
        <div key={i} className={"flex flex-col items-center gap-1 min-w-0 " + (tv ? "beat" : "")} style={delay?.(i)}>
          <div className="flex items-baseline justify-center gap-2 whitespace-nowrap min-w-0 max-w-full" style={{ fontSize: tv ? (dense ? 20 : long ? 26 : 30) : 14 }}>
            <span className={tv ? "display truncate" : "eyebrow truncate"} style={{ color: t.color }}><bdi>{t.name}</bdi></span>
            {ok != null && <Verdict v={ok} stamp={tv} size={tv ? undefined : 14} word={ok ? undefined : !x ? "No answer" : undefined} />}
            {ok && (R.pts?.[i] ?? 0) > 0 && <b className="display" style={{ color: "var(--color-ok)", fontSize: tv ? (dense ? 20 : 26) : 14 }}>+{R.pts![i]}</b>}
          </div>
          {(x || ok == null) && <div className="font-bold truncate max-w-full" style={{ fontSize: tv ? (dense ? 20 : 26) : 16, color: x ? undefined : "var(--color-ink-3)" }}><bdi>{x ?? "No answer"}</bdi></div>}
        </div>); })}
    </div>);
}

/* ---- the phone's Scores sheet: every team in order, yours marked (behind the Scores button: the owner found a
   score strip for eight teams too much on a phone) ---- */
export function ScoresMany({ pub, me }: { pub: PubMany; me: number | null }) {
  const T = pub.teams, g = pub.game, pc = g?.key === "majority";
  const order = pub.final ? pub.final.order.map((o) => o.team) : T.map((_, i) => i).sort((a, b) => T[b].score - T[a].score || a - b);
  const placeOf = (t: number) => pub.final ? pub.final.order.find((o) => o.team === t)!.place : order.findIndex((x) => T[x].score === T[t].score) + 1;
  const tally = g && pub.screen !== "intro" && pub.screen !== "final" ? (pc ? g.shares : g.pts) : null;
  return (
    <div className="card flex flex-col gap-3" role="group" aria-label="Scores">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{pub.screen === "final" ? "Final standings" : "The scores"}</div>
      {/* the column titles: what the grey number is, and that the big one is the night's total */}
      <div className="flex items-end gap-2 px-2 -mx-2 text-11 font-bold uppercase tracking-[.14em] leading-tight text-[var(--color-ink-3)]" aria-hidden>
        <span className="flex-1">Team</span>
        {tally && <span className="w-14 text-right">This game</span>}
        <span className="w-12 text-right">Total</span>
      </div>
      <ol className="flex flex-col gap-1">
        {order.map((t) => (
          <li key={t} className="flex items-center gap-2 min-h-[44px] rounded-[14px] px-2 -mx-2" style={t === me ? { background: `color-mix(in srgb, ${T[t].color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${T[t].color} 40%, transparent)` } : undefined}>
            <span className="display text-16 w-7 text-right" style={{ color: placeOf(t) === 1 ? "var(--color-gold)" : "var(--color-ink-3)" }}>{placeOf(t)}</span>
            <Dot t={t} color={T[t].color} size={16} />
            <span className="flex-1 min-w-0 flex flex-col"><span className="font-bold text-16 truncate" style={{ color: T[t].color }}><bdi>{T[t].name}</bdi></span>{t === me && <span className="cap self-start">Your team</span>}</span>
            {tally && <span className="w-14 shrink-0 text-13 text-[var(--color-ink-2)] tabular-nums text-right" aria-label={`${g!.title}: ${pc ? pct(tally[t]) : `${tally[t]} points`}`}>{pc ? pct(tally[t]) : `${tally[t]} pts`}</span>}
            <span className="display text-26 w-12 text-right" style={{ color: T[t].color }} aria-label={`Total ${T[t].score}`}>{T[t].score}</span>
          </li>))}
      </ol>
      {tally && g && <div className="text-12 text-[var(--color-ink-3)]">This game: {g.title}, {pc ? "the share of answers right so far" : `points by place so far, ${g.of} legs`}; its places pay the night at the end. Total: the night&rsquo;s points.</div>}
    </div>);
}
