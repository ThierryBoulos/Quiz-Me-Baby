"use client";
/* Russian Roulette on screen (9 Nov, the owner): the barrel, the same picture with 6 or 8 chambers, for the TV and
   the phones, two teams or eight. It spins for SPIN_MS from the TV's spinAt (a phone that opens late joins the spin
   where it is, or sees it landed); then each team's chamber lights up in its colour, with its letter. At the reveal
   the drawn chambers click one by one, the bullet last: a brass round, and BANG if a team drew it. Low motion: one
   rotation, a fade, a pulse; none of it (but the spin) with motion off in Settings. */
import { useEffect, useState, type ReactNode, useMemo } from "react";
import { tvNow } from "./Clock";
import { playSound } from "@/lib/sound";
import { HOLD_MS, SPIN_MS, STEP_MS, TURN_MS, type RrPub } from "@/lib/roulette";

export type RrLit = { j: number; color: string; letter: string; theme?: string; level?: string };
/* every chamber (shown before the spin), and those drawn in earlier spins of this barrel, in the colour of who had them */
export type RrCh = { theme: string; level: string };
export type RrUsed = { j: number; color: string; ok?: boolean };
const geo = (n: number) => ({ R: n === 8 ? 58 : 54, r: n === 8 ? 16.5 : 21 });
const at = (n: number, j: number, R: number) => { const a = (-90 + (360 / n) * j) * (Math.PI / 180); return { x: 100 + R * Math.cos(a), y: 100 + R * Math.sin(a) }; };
/* a theme in a chamber: one line if it fits, else two (at the space nearest the middle), shrunk till it fits; the
   level under it, small */
const levelTag = (lv?: string) => (lv === "bullet" ? "BULLET" : lv === "hard" ? "HARD" : lv === "expert" ? "EXPERT" : "MEDIUM");
/* what a chamber pays, said on it: +2, +3; the bullet +5 or −3 (11 Nov, the owner: not only in the rules) */
const OK = "#46e38a", NO = "#ff6b7a";
function ChamberLabel({ x, y, r, theme, level, dim }: { x: number; y: number; r: number; theme: string; level: string; dim?: boolean }) {
  const w = fitTheme(theme, r), b = level === "bullet";
  const ly = y + w.y0 + w.lines.length * w.fs * 1.08 + w.ls * 0.2;
  return (
    /* (a dark edge on the letters, so the green and red points read on a chamber filled with a team's colour too) */
    <text x={x} textAnchor="middle" fontWeight="800" style={{ fill: "#fff", fontFamily: "var(--font-body, inherit)", opacity: dim ? 0.75 : 1,
      stroke: "rgba(6,8,28,.88)", strokeWidth: w.ls * 0.26, strokeLinejoin: "round", paintOrder: "stroke" }}>
      {w.lines.map((l, i) => <tspan key={i} x={x} y={y + w.y0 + i * w.fs * 1.08} fontSize={w.fs}>{l}</tspan>)}
      <tspan x={x} y={ly} fontSize={w.ls} style={{ letterSpacing: ".03em", fill: b ? "#ffd84a" : "rgba(255,255,255,.8)" }}>{b ? "BULLET " : levelTag(level) + " "}</tspan>
      {b ? <><tspan fontSize={w.ls} style={{ fill: OK }}>+5</tspan><tspan fontSize={w.ls} style={{ fill: NO }}> −3</tspan></>
        : <tspan fontSize={w.ls} style={{ fill: OK }}>{level === "medium" ? "+2" : "+3"}</tspan>}
    </text>);
}
function fitTheme(theme: string, r: number) {
  const w = r * 1.78, wide = (t: string, f: number) => t.length * f * 0.58;
  let lines = [theme];
  if (wide(theme, r * 0.36) > w && theme.includes(" ")) {
    const sp = [...theme].map((c, i) => (c === " " ? i : -1)).filter((i) => i > 0);
    const cut = sp.reduce((b, i) => (Math.abs(i - theme.length / 2) < Math.abs(b - theme.length / 2) ? i : b), sp[0]);
    lines = [theme.slice(0, cut), theme.slice(cut + 1)];
  }
  const longest = Math.max(...lines.map((l) => l.length));
  /* (two lines sit lower in the circle, where it's narrower: a little smaller, so the level clears the rim) */
  const two = lines.length > 1, fs = Math.min(r * (two ? 0.31 : 0.36), (w * (two ? 0.92 : 1)) / (longest * 0.58)), ls = Math.min(r * (two ? 0.22 : 0.25), fs * 0.82);
  const h = lines.length * fs * 1.08 + ls;
  return { lines, fs, ls, y0: -h / 2 + fs * 0.8 };
}
/* the reveal's order: the drawn chambers clockwise from the top, the bullet's last (drawn or not) */
export const rrOrder = (lit: number[], bullet: number) => [...lit.filter((j) => j !== bullet).sort((a, b) => a - b), ...(bullet >= 0 ? [bullet] : [])];
export const rrRevealMs = (count: number) => count * STEP_MS + 900;

/* how far into the spin we are (ms; null: no spin, or it's over) — read once, when the screen opens */
/* (for each spin: it was read once, when the screen opened, and a phone that opened on the game's rules took every
   spin as over, so its clock and answer box came up while the barrel was still turning: 11 Nov, the owner) */
function useSpinPhase(spinAt?: number | null) {
  const phase = useMemo(() => (spinAt ? tvNow() - spinAt : null), [spinAt]);
  const [doneAt, setDoneAt] = useState<number | null | undefined>(undefined);
  const done = phase == null || phase >= SPIN_MS || doneAt === spinAt;
  useEffect(() => {
    if (phase == null || phase >= SPIN_MS) return;
    const t = setTimeout(() => setDoneAt(spinAt), Math.max(0, SPIN_MS - phase));
    return () => clearTimeout(t);
  }, [spinAt, phase]);
  return { spinning: !done && phase != null, phase: phase ?? SPIN_MS, done };
}
/* the spin's stage: "hold" (the barrel still, its chambers on show), "turn", or "done" (re-renders at each) */
export function useSpinStage(spinAt?: number | null): "hold" | "turn" | "done" {
  const { done, phase } = useSpinPhase(spinAt);
  const [, tick] = useState(0);
  useEffect(() => {
    if (done || phase >= HOLD_MS) return;
    const t = setTimeout(() => tick((x) => x + 1), HOLD_MS - phase + 10);
    return () => clearTimeout(t);
  }, [done, phase, spinAt]);
  if (done) return "done";
  return spinAt && tvNow() - spinAt < HOLD_MS ? "hold" : "turn";
}
export const useSpun = (spinAt?: number | null) => useSpinPhase(spinAt).done;

export function Barrel({ n, lit, spinAt, bullet, reveal, size, label, ch, used = [], labels }: {
  n: number; lit: RrLit[]; spinAt?: number | null; bullet?: number | null; reveal?: boolean; size: number; label?: string; ch?: RrCh[]; used?: RrUsed[]; labels?: boolean }) {
  const { spinning, phase } = useSpinPhase(spinAt);
  const { R, r } = geo(n), big = labels ?? size >= 300;
  const order = bullet != null ? rrOrder(lit.map((x) => x.j), bullet) : [];
  const step = (j: number) => ({ ["--rr-at" as string]: `${Math.max(0, order.indexOf(j)) * STEP_MS}ms` });
  const hit = bullet != null && lit.some((x) => x.j === bullet);
  const chambers = Array.from({ length: n }, (_, j) => j);
  const who = lit.map((x) => x.letter).join(", ");
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ width: size }} className="rr-barrel" role="img"
      aria-label={label || `A barrel of ${n} chambers${who ? `: ${who} landed` : ""}${bullet != null ? (hit ? ", and the bullet was in a team's chamber" : ", and the bullet was in a chamber nobody drew") : ""}.`}>
      <defs>
        <radialGradient id="rrSteel" cx="38%" cy="32%" r="80%"><stop offset="0" stopColor="#4a5178" /><stop offset=".55" stopColor="#252b4c" /><stop offset="1" stopColor="#11152c" /></radialGradient>
        <radialGradient id="rrHole" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#010208" /><stop offset=".8" stopColor="#070a1a" /><stop offset="1" stopColor="#1b2142" /></radialGradient>
        <radialGradient id="rrBrass" cx="38%" cy="34%" r="70%"><stop offset="0" stopColor="#fff1bf" /><stop offset=".45" stopColor="#f5c518" /><stop offset="1" stopColor="#8a6410" /></radialGradient>
      </defs>
      {/* the cylinder turns (three full turns, so it stops where it started) */}
      {/* (held still first, its chambers on show, then turning) */}
      <g key={spinAt ?? 0} className={spinning ? "rr-spin" : undefined} style={spinning ? { ["--rr-ms" as string]: `${TURN_MS}ms`, ["--rr-at" as string]: `${HOLD_MS - phase}ms` } : undefined}>
        <circle cx="100" cy="100" r="95" fill="url(#rrSteel)" stroke="#646d9c" strokeWidth="2" />
        {chambers.map((j) => { const a = (-90 + (360 / n) * (j + 0.5)) * (Math.PI / 180); return (
          <ellipse key={"f" + j} cx={100 + 88 * Math.cos(a)} cy={100 + 88 * Math.sin(a)} rx="6" ry="11" fill="#0a0d20" opacity=".85"
            transform={`rotate(${-90 + (360 / n) * (j + 0.5) + 90} ${100 + 88 * Math.cos(a)} ${100 + 88 * Math.sin(a)})`} />); })}
        {chambers.map((j) => { const p = at(n, j, R), u = used.find((x) => x.j === j), c = ch?.[j];
          /* a chamber this spin landed on gets its label on top, once the barrel stops */
          const mine = !spinning && lit.some((x) => x.j === j);
          return (
          <g key={"c" + j}>
            <circle cx={p.x} cy={p.y} r={r + 3.5} fill="#1e2442" stroke="#59628f" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r={r} fill="url(#rrHole)" />
            {/* drawn in an earlier spin: filled in the colour of the team that had it */}
            {u && <circle cx={p.x} cy={p.y} r={r} style={{ fill: u.color, fillOpacity: 0.62 }} />}
            {big && c && !mine && <ChamberLabel x={p.x} y={p.y} r={r} theme={c.theme} level={c.level} dim={!!u} />}
          </g>); })}
        <circle cx="100" cy="100" r="14" fill="#2b3157" stroke="#646d9c" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="5" fill="#0a0d20" />
      </g>
      {/* where each team landed: its colour round the chamber and in it; on a barrel big enough to read (the TV), the
          chamber's theme with its level under it, in place of the team's letter (11 Nov, the owner) */}
      {!spinning && lit.map((x) => { const p = at(n, x.j, R), words = big && !!x.theme; return (
        <g key={"l" + x.j} className={spinAt && !reveal ? "rr-lit" : undefined}>
          <g className={reveal && x.j !== bullet ? "rr-click" : undefined} style={reveal ? step(x.j) : undefined}>
            <circle cx={p.x} cy={p.y} r={r + 1.5} strokeWidth="4.5" style={{ stroke: x.color, fill: x.color, fillOpacity: words ? 0.32 : 0 }} />
            {words && x.theme ? <ChamberLabel x={p.x} y={p.y} r={r} theme={x.theme} level={x.level || "medium"} />
              : <circle cx={p.x} cy={p.y} r={r * 0.42} style={{ fill: x.color }} />}
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
    if (phase === "spin") {
      const ph = rr.spinAt ? tvNow() - rr.spinAt : 1e9;
      if (ph < HOLD_MS + 600) { const t = setTimeout(() => playSound("spin"), Math.max(0, HOLD_MS - ph)); return () => clearTimeout(t); }
      return;
    }
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
  /* what it pays, in green and red (11 Nov, the owner: the bullet's +5 and −3 said where it's shown, not only in the rules) */
  return <span className={"rr-chip" + (b ? " bullet" : "") + (small ? " sm" : "")}>{rrLevelWord(level)}
    {b ? <><b className="rr-pt ok">+5</b><b className="rr-pt no">−3</b></> : <b className="rr-pt ok">{level === "medium" ? "+2" : "+3"}</b>}</span>;
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
  const spun = useSpun(rr.spinAt), stage = useSpinStage(reveal ? null : rr.spinAt), k = teams.length, dense = k > 4, tight = k > 6, R = reveal ? rr.rev : undefined;
  const cols = !!R && tight;   /* 7 or 8 teams at the reveal: two columns */
  const used = (rr.used || []).map((u) => ({ j: u.j, color: teams[u.t]?.color || "#888", ok: u.ok }));
  useRouletteSounds(sound ? rr : undefined, reveal ? "reveal" : "spin", `${rr.lap}.${rr.spinAt}.${reveal ? "r" : "q"}`);
  const lit = rr.draw.map((d, t) => ({ j: d.j, color: teams[t].color, letter: teams[t].letter, theme: d.theme, level: d.level }));
  const order = R ? rrOrder(lit.map((x) => x.j), R.bullet) : [];
  const stepOf = (t: number) => Math.max(0, order.indexOf(rr.draw[t].j));
  const end = rrRevealMs(order.length - 1);
  const hit = R ? R.hit : -1;
  return (
    <div className="flex gap-8 items-center w-full justify-center">
      <div className="shrink-0 flex flex-col items-center gap-3">
        <Barrel n={rr.n} lit={spun || reveal ? lit : []} spinAt={reveal ? null : rr.spinAt} bullet={R && R.bullet >= 0 ? R.bullet : null} reveal={!!R} size={dense ? 380 : 420} ch={rr.ch} used={used} />
      </div>
      {/* (a little narrower than it was: at 760 the score at the right edge of each row was cut: 11 Nov, the owner) */}
      <div className="flex-1 min-w-0 max-w-[700px] flex flex-col gap-3 text-left">
        {/* what this spin is, and the clock on the right once the barrel has stopped */}
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0 flex flex-col gap-2">
            {/* (which spin it is: the bar at the top says so) */}
            {/* the barrel held still: every chamber on show, the bullet among them; then it turns */}
            {!R && !spun && (stage === "hold"
              ? <><div className="display leading-none" style={{ fontSize: dense ? 44 : 52 }}>One of these is the bullet</div>
                <div className="text-22 text-[var(--color-ink-2)]">{(rr.used || []).length ? `${rr.n - (rr.used || []).length} chambers left in the barrel.` : "Where will you land?"}</div></>
              : <div className="display text-60 leading-none">The barrel&rsquo;s spinning&hellip;</div>)}
            {/* who drew the bullet, as soon as the barrel stops (11 Nov, the owner: no surprise there; the surprise is the
                question itself) */}
            {!R && spun && (<><div className="display leading-none" style={{ fontSize: dense ? 40 : 48, color: rr.hit >= 0 ? teams[rr.hit].color : undefined }}>
              {rr.hit >= 0 ? <><bdi>{teams[rr.hit].name}</bdi> drew the bullet</> : rr.blank ? "Tie-breaker: no bullet" : "Nobody drew the bullet"}</div>
              <div className="text-22 text-[var(--color-ink-2)]">Captains, type your answer.</div></>)}
          </div>
          {!R && spun && <div className="shrink-0 pl-6">{clock}</div>}
        </div>
        {(spun || R) && (
          /* (7 or 8 teams at the reveal: two columns, so it all sits under the bar at the top) */
          <div className={cols ? "grid grid-cols-2" : "flex flex-col"} style={{ gap: tight ? 6 : dense ? 6 : 10 }} role="list" aria-label="Each team's chamber">
            {rr.draw.map((d, t) => { const T = teams[t], lv = R?.level[t], got = R?.got[t] ?? 0, x = typed?.[t], v = ok?.[t];
              return (
                <div key={t} role="listitem" className={"rr-row" + (R ? " rr-late" : " enter") + (R && t === hit ? " bang" : "")} style={{ ["--c" as string]: T.color, ["--rr-at" as string]: `${stepOf(t) * STEP_MS + 250}ms`, padding: tight ? "4px 12px" : dense ? "6px 12px" : undefined }}>
                  <LetterDot t={T} size={tight ? 24 : dense ? 26 : 34} />
                  <div className="min-w-0 flex flex-col">
                    {/* (two columns: the team by its lettered dot and colour, no name, so the answers have the room: the
                        owner, 11 Nov) */}
                    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                      {!cols && <b className="truncate" style={{ color: T.color }}><bdi>{T.name}</bdi></b>}
                      <span className={cols ? "font-bold" : "text-[var(--color-ink-2)]"} style={cols ? { color: T.color } : undefined}>{cols ? d.theme : <>· {d.theme}</>}</span>
                      <LevelChip level={lv || d.level} small={dense} />
                    </div>
                    {showQs && !R && <div className="font-bold leading-snug" style={{ fontSize: d.q.length > 120 ? 22 : 26 }}>{d.q}</div>}
                    {R && <div className="leading-snug truncate" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                      {x ? <><bdi>&ldquo;{x}&rdquo;</bdi> <b style={{ color: v ? "var(--color-ok)" : "var(--color-no)" }}>{v ? "RIGHT" : "WRONG"}</b></> : <span className="text-[var(--color-ink-3)]">No answer</span>}
                      {!v && !cols && <span className="text-[var(--color-ink-2)]"> · <bdi>{R.answer[t]}</bdi></span>}
                    </div>}
                    {/* (two columns: the right answer on a line of its own, two lines if it needs them) */}
                    {R && !v && cols && <div className="leading-snug clamp2 text-[var(--color-ink-2)]" style={{ fontSize: 16 }}><bdi>{R.answer[t]}</bdi></div>}
                  </div>
                  <div className="shrink-0 text-right">
                    {R ? <span className="display leading-none" style={{ fontSize: tight ? 26 : dense ? 30 : 40, color: got > 0 ? "var(--color-ok)" : got < 0 ? "var(--color-no)" : "var(--color-ink-3)" }}>{signed(got)}</span>
                      : <span className="font-bold" style={{ fontSize: dense ? 15 : 18, color: sent?.[t] ? "var(--color-ok)" : "var(--color-ink-3)" }}>{sent?.[t] ? "✓ in" : "thinking"}</span>}
                  </div>
                </div>); })}
          </div>)}
        {R && <div className="display rr-late leading-tight" style={{ ["--rr-at" as string]: `${end}ms`, fontSize: dense ? 36 : 44, color: hit >= 0 ? teams[hit].color : "var(--color-ink-2)" }}>
          {hit >= 0 ? <>BANG! <bdi>{teams[hit].name}</bdi> drew the bullet</> : R.bullet < 0 ? "Tie-breaker: no bullet in this one." : "Nobody drew the bullet this time."}</div>}
      </div>
    </div>);
}

/* ---- the lap, on a phone: the barrel spinning, then your team's chamber and its question (the host sees every
   team's); at the reveal, what was behind your chamber ---- */
export function RrPhone({ rr, me, teams, host }: { rr: RrPub; me: number | null; teams: RrTeam[]; host?: boolean }) {
  const spun = useSpun(rr.spinAt), stage = useSpinStage(rr.spinAt);
  const lit = rr.draw.map((d, t) => ({ j: d.j, color: teams[t].color, letter: teams[t].letter }));
  const mine = me != null ? rr.draw[me] : null, left = rr.n - (rr.used || []).length;
  /* until it lands, big enough to read every chamber's theme and points, as on the TV (with no TV, the phones are the
     only screen); then small, with your chamber's question under it */
  return (
    <div className="flex flex-col items-center gap-3 w-full noselect">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{lapWord(rr)}</div>
      <Barrel n={rr.n} lit={spun ? lit : []} spinAt={rr.spinAt} size={spun ? 168 : 300} labels={!spun} ch={rr.ch}
        used={(rr.used || []).map((u) => ({ j: u.j, color: teams[u.t]?.color || "#888" }))} />
      {!spun && stage === "hold" && <div className="flex flex-col items-center gap-1 text-center" role="status"><p className="display text-26 leading-none">One of these is the bullet</p>
        <p className="text-15 text-[var(--color-ink-2)]">{(rr.used || []).length ? `${left} chambers left in the barrel.` : "Where will you land?"}</p></div>}
      {!spun && stage !== "hold" && <p className="display text-26 text-center" role="status">The barrel&rsquo;s spinning&hellip;</p>}
      {spun && mine && me != null && (
        <div className="card w-full flex flex-col gap-1.5 text-center enter" style={{ borderColor: teams[me].color }}>
          <div className="flex items-center justify-center gap-2 flex-wrap"><span className="eyebrow" style={{ color: teams[me].color }}>Your chamber: {mine.theme}</span><LevelChip level={mine.level} small /></div>
          {rr.hit === me && <p className="text-14 font-bold" style={{ color: "var(--color-gold)" }}>You drew the bullet: right +5, wrong or no answer −3.</p>}
          <p className={"font-bold leading-snug " + (mine.q.length > 120 ? "text-16" : "text-20")}>{mine.q}</p>
        </div>)}
      {spun && me != null && rr.hit >= 0 && rr.hit !== me && <p className="text-14 text-center" role="status"><b style={{ color: teams[rr.hit].color }}><bdi>{teams[rr.hit].name}</bdi></b> drew the bullet.</p>}
      {spun && me != null && rr.hit < 0 && <p className="text-14 text-center text-[var(--color-ink-2)]" role="status">{rr.blank ? "Tie-breaker: no bullet in this one." : "Nobody drew the bullet this time."}</p>}
      {spun && me == null && (host || !mine) && (
        <div className="flex flex-col gap-2 w-full enter">{rr.draw.map((d, t) => (
          <div key={t} className="card !py-2 flex flex-col gap-0.5" style={{ borderColor: teams[t].color }}>
            <div className="eyebrow flex items-center gap-2" style={{ color: teams[t].color, letterSpacing: ".1em" }}><LetterDot t={teams[t]} size={16} /><span className="truncate"><bdi>{teams[t].name}</bdi> · {d.theme}</span><LevelChip level={d.level} small /></div>
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
      <Barrel n={rr.n} lit={lit} bullet={R.bullet >= 0 ? R.bullet : null} reveal size={150} used={(rr.used || []).map((u) => ({ j: u.j, color: teams[u.t]?.color || "#888" }))} />
      {me != null && rr.draw[me] && <div className="flex items-center gap-2 flex-wrap justify-center text-14"><span className="text-[var(--color-ink-2)]">Your chamber: {rr.draw[me].theme}</span><LevelChip level={R.level[me]} small /></div>}
      <p className="display text-22 text-center rr-late" style={{ ["--rr-at" as string]: `${end}ms`, color: hit >= 0 ? teams[hit].color : "var(--color-ink-2)" }} role="status">
        {hit >= 0 ? (hit === me ? "BANG! Your team drew the bullet" : <>BANG! <bdi>{teams[hit].name}</bdi> drew the bullet</>) : R.bullet < 0 ? "Tie-breaker: no bullet in this one." : "Nobody drew the bullet this time."}</p>
    </div>);
}
