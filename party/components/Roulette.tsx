"use client";
/* Russian Roulette on screen (9 Nov, the owner): the barrel, the same picture with 6 or 8 chambers, for the TV and
   the phones, two teams or eight. It spins for SPIN_MS from the TV's spinAt (a phone that opens late joins the spin
   where it is, or sees it landed); then each team's chamber lights up in its colour, with its letter. At the reveal
   the drawn chambers click one by one, the bullet last: a brass round, and BANG if a team drew it. Low motion: one
   rotation, a fade, a pulse; none of it with "reduce motion" on. */
import { useEffect, useState, type ReactNode } from "react";
import { tvNow } from "./Clock";
import { playSound } from "@/lib/sound";
import { SPIN_MS, STEP_MS, type RrPub } from "@/lib/roulette";

export type RrLit = { j: number; color: string; letter: string };
const geo = (n: number) => ({ R: n === 8 ? 58 : 54, r: n === 8 ? 16.5 : 21 });
const at = (n: number, j: number, R: number) => { const a = (-90 + (360 / n) * j) * (Math.PI / 180); return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) }; };
/* the reveal's order: the drawn chambers clockwise from the top, the bullet's last (drawn or not) */
export const rrOrder = (lit: number[], bullet: number) => [...lit.filter((j) => j !== bullet).sort((a, b) => a - b), ...(bullet >= 0 ? [bullet] : [])];
export const rrRevealMs = (count: number) => count * STEP_MS + 900;

/* how far into the spin we are (ms; null: no spin, or it's over) — read once, when the screen opens */
function useSpinPhase(spinAt?: number | null) {
  const [phase] = useState(() => (spinAt ? tvNow() - spinAt : null));
  const [done, setDone] = useState(() => phase == null || phase >= SPIN_MS);
  useEffect(() => {
    if (done || phase == null) return;
    const t = setTimeout(() => setDone(true), Math.max(0, SPIN_MS - phase));
    return () => clearTimeout(t);
  }, [done, phase]);
  return { spinning: !done && phase != null, phase: phase ?? SPIN_MS, done };
}
export const useSpun = (spinAt?: number | null) => useSpinPhase(spinAt).done;

export function Barrel({ n, lit, spinAt, bullet, reveal, size, label }: {
  n: number; lit: RrLit[]; spinAt?: number | null; bullet?: number | null; reveal?: boolean; size: number; label?: string }) {
  const { spinning, phase } = useSpinPhase(spinAt);
  const { R, r } = geo(n);
  const order = bullet != null ? rrOrder(lit.map((x) => x.j), bullet) : [];
  const step = (j: number) => ({ ["--rr-at" as string]: `${Math.max(0, order.indexOf(j)) * STEP_MS}ms` });
  const hit = bullet != null && lit.some((x) => x.j === bullet);
  const chambers = Array.from({ length: n }, (_, j) => j);
  const who = lit.map((x) => x.letter).join(", ");
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="rr-barrel" role="img"
      aria-label={label || `A barrel of ${n} chambers${who ? `: ${who} landed` : ""}${bullet != null ? (hit ? ", and the bullet was in a team's chamber" : ", and the bullet was in a chamber nobody drew") : ""}.`}>
      <defs>
        <radialGradient id="rrSteel" cx="38%" cy="32%" r="80%"><stop offset="0" stopColor="#4a5178" /><stop offset=".55" stopColor="#252b4c" /><stop offset="1" stopColor="#11152c" /></radialGradient>
        <radialGradient id="rrHole" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#010208" /><stop offset=".8" stopColor="#070a1a" /><stop offset="1" stopColor="#1b2142" /></radialGradient>
        <radialGradient id="rrBrass" cx="38%" cy="34%" r="70%"><stop offset="0" stopColor="#fff1bf" /><stop offset=".45" stopColor="#f5c518" /><stop offset="1" stopColor="#8a6410" /></radialGradient>
      </defs>
      {/* the cylinder turns (three full turns, so it stops where it started) */}
      <g key={spinAt ?? 0} className={spinning ? "rr-spin" : undefined} style={spinning ? { ["--rr-ms" as string]: `${SPIN_MS}ms`, ["--rr-at" as string]: `${-phase}ms` } : undefined}>
        <circle cx="100" cy="100" r="95" fill="url(#rrSteel)" stroke="#646d9c" strokeWidth="2" />
        {chambers.map((j) => { const a = (-90 + (360 / n) * (j + 0.5)) * (Math.PI / 180); return (
          <ellipse key={"f" + j} cx={100 + 88 * Math.cos(a)} cy={100 + 88 * Math.sin(a)} rx="6" ry="11" fill="#0a0d20" opacity=".85"
            transform={`rotate(${-90 + (360 / n) * (j + 0.5) + 90} ${100 + 88 * Math.cos(a)} ${100 + 88 * Math.sin(a)})`} />); })}
        {chambers.map((j) => { const p = at(n, j, R); return (
          <g key={"c" + j}>
            <circle cx={p.x} cy={p.y} r={r + 3.5} fill="#1e2442" stroke="#59628f" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r={r} fill="url(#rrHole)" />
          </g>); })}
        <circle cx="100" cy="100" r="14" fill="#2b3157" stroke="#646d9c" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="5" fill="#0a0d20" />
      </g>
      {/* where each team landed: its colour round the chamber, its letter in it */}
      {!spinning && lit.map((x) => { const p = at(n, x.j, R); return (
        <g key={"l" + x.j} className={spinAt && !reveal ? "rr-lit" : undefined}>
          <g className={reveal && x.j !== bullet ? "rr-click" : undefined} style={reveal ? step(x.j) : undefined}>
            <circle cx={p.x} cy={p.y} r={r + 1.5} fill="none" strokeWidth="4.5" style={{ stroke: x.color }} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize={r * 1.05} style={{ fill: x.color, fontFamily: "var(--font-display, inherit)" }}>{x.letter}</text>
          </g>
        </g>); })}
      {/* the bullet, last: in a team's chamber, BANG */}
      {!spinning && bullet != null && reveal && (() => { const p = at(n, bullet, R), st = step(bullet); return (
        <g>
          {hit && <polygon className="rr-bang" style={st} fill="#ffcf3a" opacity=".9"
            points={Array.from({ length: 16 }, (_, i) => { const a = (Math.PI * 2 * i) / 16, d = i % 2 ? r * 1.25 : r * 2.6; return `${p.x + d * Math.cos(a)},${p.y + d * Math.sin(a)}`; }).join(" ")} />}
          <g className="rr-shot" style={st}>
            <circle cx={p.x} cy={p.y} r={r * 0.84} fill="url(#rrBrass)" stroke="#6b4c08" strokeWidth="1.2" />
            <circle cx={p.x} cy={p.y} r={r * 0.36} fill="#d9a21a" stroke="#7a5608" strokeWidth="1.2" />
          </g>
        </g>); })()}
    </svg>);
}

/* the TV's sounds for a lap: the barrel's ratchet as it spins (only if the spin is just starting), then at the
   reveal a click a chamber and the bang (or one more click, and the bullet's in a dark one) */
export function useRouletteSounds(rr: RrPub | undefined, phase: "spin" | "reveal" | null, key: string) {
  useEffect(() => {
    if (!rr || !phase) return;
    if (phase === "spin") { if (rr.spinAt && tvNow() - rr.spinAt < 600) playSound("spin"); return; }
    if (!rr.rev) return;
    const lit = rr.draw.map((d) => d.j), order = rrOrder(lit, rr.rev.bullet), hit = rr.rev.hit >= 0;
    const ts = order.map((j, k) => setTimeout(() => playSound(k === order.length - 1 && hit ? "bang" : "click"), k * STEP_MS + 60));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, phase]);
}

/* what a chamber is worth, said plainly */
export const rrLevelWord = (level: string) => (level === "bullet" ? "The bullet · Expert" : level === "hard" ? "Hard" : level === "expert" ? "Expert" : "Medium");
export const rrWorthWord = (level: string) => (level === "bullet" ? "+5 or −3" : level === "medium" ? "2 points" : "3 points");
export const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

/* a chip for a chamber's level, gold for the bullet */
export function LevelChip({ level, small }: { level: string; small?: boolean }) {
  const b = level === "bullet";
  return <span className={"rr-chip" + (b ? " bullet" : "") + (small ? " sm" : "")}>{rrLevelWord(level)}{b ? "" : ` · ${level === "medium" ? 2 : 3}`}</span>;
}
export function RrNote({ children }: { children: ReactNode }) { return <p className="rr-note">{children}</p>; }

/* ---- the lap, on the TV (both setups): the barrel on the left; on the right what this spin is, then each team's
   chamber (its theme; with two teams the question too, big enough to read across the room), and at the reveal what
   was behind each one, in the order the chambers click ---- */
export type RrTeam = { name: string; color: string; letter: string };
export const lapWord = (rr: Pick<RrPub, "lap" | "laps">) => (rr.lap > rr.laps ? "Tie-breaker spin" : `Spin ${rr.lap} of ${rr.laps}`);
const LetterDot = ({ t, size }: { t: RrTeam; size: number }) => (
  <span className="dot ltr shrink-0" aria-hidden style={{ background: t.color, width: size, height: size, fontSize: size * 0.55 }}>{t.letter}</span>);
export function RouletteTv({ rr, teams, clock, sent, typed, ok, reveal, showQs, sound }: {
  rr: RrPub; teams: RrTeam[]; clock?: ReactNode; sent?: boolean[]; typed?: (string | null)[]; ok?: (boolean | null)[]; reveal?: boolean; showQs?: boolean; sound?: boolean }) {
  const spun = useSpun(rr.spinAt), k = teams.length, dense = k > 4, tight = k > 6, R = reveal ? rr.rev : undefined;
  useRouletteSounds(sound ? rr : undefined, reveal ? "reveal" : "spin", `${rr.lap}.${rr.spinAt}.${reveal ? "r" : "q"}`);
  const lit = rr.draw.map((d, t) => ({ j: d.j, color: teams[t].color, letter: teams[t].letter }));
  const order = R ? rrOrder(lit.map((x) => x.j), R.bullet) : [];
  const stepOf = (t: number) => Math.max(0, order.indexOf(rr.draw[t].j));
  const end = rrRevealMs(order.length - 1);
  const hit = R ? R.hit : -1;
  return (
    <div className="flex gap-10 items-center w-full justify-center">
      <div className="shrink-0 flex flex-col items-center gap-3">
        <Barrel n={rr.n} lit={spun || reveal ? lit : []} spinAt={reveal ? null : rr.spinAt} bullet={R && R.bullet >= 0 ? R.bullet : null} reveal={!!R} size={dense ? 360 : 420} />
      </div>
      <div className="flex-1 min-w-0 max-w-[760px] flex flex-col gap-3 text-left">
        {/* what this spin is, and the clock on the right once the barrel has stopped */}
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0 flex flex-col gap-2">
            {/* (which spin it is: the bar at the top says so) */}
            {!R && !spun && <div className="display text-60 leading-none">The barrel&rsquo;s spinning&hellip;</div>}
            {!R && spun && (<><div className="display leading-none" style={{ fontSize: dense ? 40 : 48 }}>One of these is the bullet</div>
              <div className="text-22 text-[var(--color-ink-2)]">Captains, type your answer.</div></>)}
          </div>
          {!R && spun && <div className="shrink-0 pl-6">{clock}</div>}
        </div>
        {(spun || R) && (
          /* (7 or 8 teams at the reveal: two columns, so it all sits under the bar at the top) */
          <div className={R && tight ? "grid grid-cols-2" : "flex flex-col"} style={{ gap: tight ? 6 : dense ? 6 : 10 }} role="list" aria-label="Each team's chamber">
            {rr.draw.map((d, t) => { const T = teams[t], lv = R?.level[t], got = R?.got[t] ?? 0, x = typed?.[t], v = ok?.[t];
              return (
                <div key={t} role="listitem" className={"rr-row" + (R ? " rr-late" : " enter") + (R && t === hit ? " bang" : "")} style={{ ["--c" as string]: T.color, ["--rr-at" as string]: `${stepOf(t) * STEP_MS + 250}ms`, padding: tight ? "4px 12px" : dense ? "6px 12px" : undefined }}>
                  <LetterDot t={T} size={tight ? 24 : dense ? 26 : 34} />
                  <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                      <b className="truncate" style={{ color: T.color }}><bdi>{T.name}</bdi></b>
                      <span className="text-[var(--color-ink-2)]">· {d.theme}</span>
                      {lv && <LevelChip level={lv} small={dense} />}
                    </div>
                    {showQs && !R && <div className="font-bold leading-snug" style={{ fontSize: d.q.length > 120 ? 22 : 26 }}>{d.q}</div>}
                    {R && <div className="leading-snug truncate" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                      {x ? <><bdi>&ldquo;{x}&rdquo;</bdi> <b style={{ color: v ? "var(--color-ok)" : "var(--color-no)" }}>{v ? "RIGHT" : "WRONG"}</b></> : <span className="text-[var(--color-ink-3)]">No answer</span>}
                      {!v && <span className="text-[var(--color-ink-2)]"> · <bdi>{R.answer[t]}</bdi></span>}
                    </div>}
                  </div>
                  <div className="shrink-0 text-right">
                    {R ? <span className="display leading-none" style={{ fontSize: tight ? 26 : dense ? 30 : 40, color: got > 0 ? "var(--color-ok)" : got < 0 ? "var(--color-no)" : "var(--color-ink-3)" }}>{signed(got)}</span>
                      : <span className="font-bold" style={{ fontSize: dense ? 15 : 18, color: sent?.[t] ? "var(--color-ok)" : "var(--color-ink-3)" }}>{sent?.[t] ? "✓ in" : "thinking"}</span>}
                  </div>
                </div>); })}
          </div>)}
        {R && <div className="display rr-late leading-tight" style={{ ["--rr-at" as string]: `${end}ms`, fontSize: dense ? 36 : 44, color: hit >= 0 ? teams[hit].color : "var(--color-ink-2)" }}>
          {hit >= 0 ? <>BANG! <bdi>{teams[hit].name}</bdi> drew the bullet</> : R.bullet < 0 ? "Tie-breaker: no bullet in this one." : "Click. Nobody drew the bullet this time."}</div>}
      </div>
    </div>);
}

/* ---- the lap, on a phone: the barrel spinning, then your team's chamber and its question (the host sees every
   team's); at the reveal, what was behind your chamber ---- */
export function RrPhone({ rr, me, teams, host }: { rr: RrPub; me: number | null; teams: RrTeam[]; host?: boolean }) {
  const spun = useSpun(rr.spinAt);
  const lit = rr.draw.map((d, t) => ({ j: d.j, color: teams[t].color, letter: teams[t].letter }));
  const mine = me != null ? rr.draw[me] : null;
  return (
    <div className="flex flex-col items-center gap-3 w-full noselect">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{lapWord(rr)}</div>
      <Barrel n={rr.n} lit={spun ? lit : []} spinAt={rr.spinAt} size={168} />
      {!spun && <p className="display text-26 text-center" role="status">The barrel&rsquo;s spinning&hellip;</p>}
      {spun && mine && me != null && (
        <div className="card w-full flex flex-col gap-1.5 text-center enter" style={{ borderColor: teams[me].color }}>
          <div className="eyebrow" style={{ color: teams[me].color }}>Your chamber: {mine.theme}</div>
          <p className={"font-bold leading-snug " + (mine.q.length > 120 ? "text-16" : "text-20")}>{mine.q}</p>
        </div>)}
      {spun && me == null && (host || !mine) && (
        <div className="flex flex-col gap-2 w-full enter">{rr.draw.map((d, t) => (
          <div key={t} className="card !py-2 flex flex-col gap-0.5" style={{ borderColor: teams[t].color }}>
            <div className="eyebrow flex items-center gap-2" style={{ color: teams[t].color, letterSpacing: ".1em" }}><LetterDot t={teams[t]} size={16} /><span className="truncate"><bdi>{teams[t].name}</bdi> · {d.theme}</span></div>
            <p className="text-15 font-bold leading-snug">{d.q}</p>
          </div>))}</div>)}
    </div>);
}
/* the reveal on a phone: the barrel clicking, and the line for your team (or who drew the bullet) */
export function RrPhoneReveal({ rr, me, teams }: { rr: RrPub; me: number | null; teams: RrTeam[] }) {
  const R = rr.rev; if (!R) return null;
  const lit = rr.draw.map((d, t) => ({ j: d.j, color: teams[t].color, letter: teams[t].letter }));
  const order = rrOrder(lit.map((x) => x.j), R.bullet), end = rrRevealMs(order.length - 1), hit = R.hit;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{lapWord(rr)}</div>
      <Barrel n={rr.n} lit={lit} bullet={R.bullet >= 0 ? R.bullet : null} reveal size={150} />
      {me != null && rr.draw[me] && <div className="flex items-center gap-2 flex-wrap justify-center text-14"><span className="text-[var(--color-ink-2)]">Your chamber: {rr.draw[me].theme}</span><LevelChip level={R.level[me]} small /></div>}
      <p className="display text-22 text-center rr-late" style={{ ["--rr-at" as string]: `${end}ms`, color: hit >= 0 ? teams[hit].color : "var(--color-ink-2)" }} role="status">
        {hit >= 0 ? (hit === me ? "BANG! Your team drew the bullet" : <>BANG! <bdi>{teams[hit].name}</bdi> drew the bullet</>) : R.bullet < 0 ? "Tie-breaker: no bullet in this one." : "Click. Nobody drew the bullet this time."}</p>
    </div>);
}
