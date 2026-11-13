"use client";
/* Secret Stakes on screen (11 Nov, the owner), for the TV and the phones, two teams or eight. A round: three themes
   go up and the captains bet in secret (the TV only shows who has); then each team's own question on its own phones
   (the TV: "Bets are in" and the clock); then the reveal, one team at a time from last place up, each row its theme,
   its bet, its answer, and the points on or off its total; after the third round, what each team won or lost.
   Low motion: rows fade in one after another, and at the end each team's chips drop onto its stack (all still, with
   motion off in Settings). */
import type { ReactNode } from "react";
import { SK_LEVELS, signedPts, skBet, skLevelWord, skRowAt, type SkPub } from "@/lib/stakes";

export type SkTeam = { name: string; color: string; letter: string };
const OK = "var(--color-ok)", NO = "var(--color-no)";

const Dot = ({ t, size }: { t: SkTeam; size: number }) => (
  <span className="dot ltr shrink-0" aria-hidden style={{ background: t.color, width: size, height: size, fontSize: size * 0.55 }}>{t.letter}</span>);
/* a level and what it's worth: "Hard +16 −16"; Easy is the safe bet. (12 Nov, the owner: safe in green, the win in
   green and the loss in red, on every screen; Expert no longer lit gold, it's a level like the others) */
/* warn: the danger sign beside Expert (the legend, the bet buttons): it's almost impossible to get */
export function SkChip({ unit, level, small, warn }: { unit: number; level: string; small?: boolean; warn?: boolean }) {
  const b = skBet(unit, level);
  return (
    <span className={"rr-chip sk-chip" + (small ? " sm" : "")} aria-label={level === "easy" ? "Easy: safe" : `${skLevelWord(level)}: win ${b} or lose ${b}`}>
      {warn && level === "expert" && <span aria-hidden>⚠</span>}{skLevelWord(level)}
      {level === "easy" ? <b className="rr-pt ok">safe</b> : <><b className="rr-pt ok">+{b}</b><b className="rr-pt no">−{b}</b></>}
    </span>);
}
/* the four levels, once, as a legend; and where the points come from (the owner, 12 Nov: say it's the total score) */
export function SkLevels({ unit, small }: { unit: number; small?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap items-center justify-center gap-2" aria-label="What each level is worth">{SK_LEVELS.map((l) => <SkChip key={l} unit={unit} level={l} small={small} warn />)}</div>
      <div className={"text-center font-semibold text-[var(--color-ink-2)] " + (small ? "text-13" : "text-20")}>{SK_TOTAL}</div>
    </div>);
}
/* (the owner, 12 Nov: "it's from their TOTAL SCORES"; and Expert is almost impossible to get, so a danger sign) */
export const SK_TOTAL = "Win or lose, it comes from your total score.";
const skWarn = (unit: number) => `Beware: Expert is almost impossible to get. Wrong, and you lose ${skBet(unit, "expert")} from your total score.`;
/* who has bet (or answered): a row of names (two teams) or lettered dots (three or more) */
function Ticks({ teams, done, yes, no, size = 22 }: { teams: SkTeam[]; done: boolean[]; yes: string; no: string; size?: number }) {
  const many = teams.length > 2;
  return (
    <div className={"flex flex-wrap justify-center " + (many ? "gap-x-5 gap-y-2" : "gap-x-10 gap-y-2")} role="status" aria-live="polite">
      {teams.map((t, i) => (
        <span key={i} className="flex items-center gap-2 font-bold" style={{ fontSize: size }}>
          <Dot t={t} size={size * 1.25} />
          {!many && <bdi style={{ color: t.color }}>{t.name}</bdi>}
          <span style={{ color: done[i] ? OK : "var(--color-ink-3)" }}>{done[i] ? `✓ ${yes}` : no}</span>
        </span>))}
    </div>);
}

/* ---- the TV ---- */
export function StakesTv({ sk, screen, teams, clock, sent }: { sk: SkPub; screen: string; teams: SkTeam[]; clock?: ReactNode; sent?: boolean[] }) {
  const k = teams.length, dense = k > 4;
  if (screen === "stakesPick") return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-1">
        <div className="display leading-none" style={{ fontSize: 60, color: "var(--color-gold)" }}>Place your bets</div>
        <div className="text-22 text-[var(--color-ink-2)]">Captains, pick a theme and a level on your phone. Nobody sees your bet.</div>
      </div>
      <div className="grid grid-cols-3 gap-5 w-full max-w-[1080px]" role="list" aria-label="This round's themes">
        {sk.themes.map((t, i) => (
          <div key={i} role="listitem" className="card sk-theme grid place-items-center text-center" style={{ minHeight: 120 }}>
            <span className="display leading-tight" style={{ fontSize: t.length > 16 ? 36 : 44 }}>{t}</span>
          </div>))}
      </div>
      <SkLevels unit={sk.unit} />
      <div className="flex items-center gap-10">
        {clock}
        <Ticks teams={teams} done={sk.locked} yes="bet in" no="choosing…" size={dense ? 20 : 24} />
      </div>
    </div>);
  if (screen === "stakesQ") return (
    <div className="flex flex-col items-center gap-6">
      <div className="display leading-none" style={{ fontSize: 80, color: "var(--color-gold)" }}>Bets are in</div>
      <div className="text-26 text-[var(--color-ink-2)] max-w-[900px]">Every team has the question it bet on, on its own phones. Captains, type your answer.</div>
      {clock}
      <Ticks teams={teams} done={sent || []} yes="in" no="thinking" size={dense ? 20 : 24} />
    </div>);
  if (screen === "stakesReveal" && sk.rev) return <StakesRevealTv sk={sk} teams={teams} />;
  if (screen === "stakesSummary" && sk.sum) return <StakesSummaryTv sk={sk} teams={teams} />;
  return null;
}

/* the reveal: last place first, up to the leader; each row comes in on its own beat, and (two teams) its points fly to
   the top bar as it does. 7 or 8 teams: two columns. Every row the same size */
function StakesRevealTv({ sk, teams }: { sk: SkPub; teams: SkTeam[] }) {
  const R = sk.rev!, k = teams.length, dense = k > 4, tight = k > 6, cols = tight;
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="eyebrow" style={{ fontSize: 18, color: "var(--color-gold)" }}>The reveal · from last place up</div>
      {/* (two columns read down the left one first: last place to the middle, then on up to the leader) */}
      <div className={"grid w-full " + (cols ? "grid-cols-2 max-w-[1180px]" : "grid-cols-1 max-w-[1080px]")}
        style={{ gap: tight ? 6 : dense ? 6 : 12, gridAutoRows: "1fr", ...(cols ? { gridAutoFlow: "column", gridTemplateRows: `repeat(${Math.ceil(k / 2)}, minmax(0, 1fr))` } : {}) }} role="list" aria-label="Each team's bet">
        {R.order.map((t, n) => { const T = teams[t], ok = R.ok[t], d = R.delta[t], at = skRowAt(n, k), x = R.typed[t];
          return (
            <div key={t} role="listitem" className="rr-row rr-late text-left" style={{ ["--c" as string]: T.color, ["--rr-at" as string]: `${at}ms`, padding: tight ? "4px 12px" : dense ? "6px 12px" : "10px 16px" }}>
              <Dot t={T} size={tight ? 26 : dense ? 28 : 36} />
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2 min-w-0 whitespace-nowrap" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                  {!cols && <b className="truncate min-w-0" style={{ color: T.color, flexShrink: 2 }}><bdi>{T.name}</bdi></b>}
                  <span className={"truncate min-w-0 " + (cols ? "font-bold" : "text-[var(--color-ink-2)]")} style={cols ? { color: T.color } : undefined}>{cols ? R.theme[t] : <>· {R.theme[t]}</>}</span>
                  <span className="shrink-0"><SkChip unit={sk.unit} level={R.level[t]} small={dense} /></span>
                </div>
                <div className="leading-snug truncate" style={{ fontSize: tight ? 16 : dense ? 18 : 22 }}>
                  {x ? <><bdi>&ldquo;{x}&rdquo;</bdi> <b style={{ color: ok ? OK : NO }}>{ok ? "RIGHT" : "WRONG"}</b></> : <span className="text-[var(--color-ink-3)]">No answer</span>}
                  {!ok && <span className="text-[var(--color-ink-2)]"> · <bdi>{R.answer[t]}</bdi></span>}
                </div>
              </div>
              <div className="shrink-0 text-right flex flex-col items-end leading-none">
                <span className="display" data-fly-src={k === 2 ? String(t) : undefined} data-fly-at={k === 2 ? String(at) : undefined}
                  style={{ fontSize: tight ? 28 : dense ? 32 : 44, color: d > 0 ? OK : d < 0 ? NO : "var(--color-ink-3)" }}>{signedPts(d)}</span>
                <span className="text-[var(--color-ink-3)] font-bold" style={{ fontSize: tight ? 12 : 15 }}>now {R.after[t]}</span>
              </div>
            </div>); })}
      </div>
    </div>);
}

/* the game's end: each team's stack of chips (the owner, 13 Nov), the biggest winner first, on the left: a chip for
   what a Medium bet pays, green for what it won, red for what it lost, none if it broke even. Its total on top, its name
   and its three bets under; every part at the same height across, so nothing runs into anything. The chips drop onto
   the stack one by one, a team after the other as the rows did; the biggest winner's stack lights up in its colour */
function StakesSummaryTv({ sk, teams }: { sk: SkPub; teams: SkTeam[] }) {
  const S = sk.sum!, k = teams.length, dense = k > 4, tight = k > 6;
  const order = teams.map((_, t) => t).sort((a, b) => S.net[b] - S.net[a] || a - b), top = Math.max(...S.net);
  const cw = k <= 4 ? 200 : k <= 6 ? 150 : 120, fs = tight ? 30 : dense ? 36 : 48, most = Math.max(1, ...S.net.map((v) => chipsOf(v, sk.unit)));
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="display leading-none slam" style={{ fontSize: dense ? 52 : 60, color: "var(--color-gold)" }}>The bets are settled</div>
      <div className="flex items-start justify-center w-full max-w-[1080px]" style={{ gap: tight ? 12 : dense ? 16 : 28 }} role="list" aria-label="What each team won or lost">
        {order.map((t, n) => { const T = teams[t], v = S.net[t], at = 300 + n * 250;
          return (
            <div key={t} role="listitem" className="rr-late flex flex-col items-center gap-1 min-w-0" style={{ width: cw, ["--rr-at" as string]: `${at}ms` }}
              aria-label={`${T.name}: ${signedPts(v)}, ${S.rounds[t].map((r) => `${skLevelWord(r.level)} ${signedPts(r.delta)}`).join(", ")}`}>
              <span className="display leading-none" style={{ fontSize: fs, height: fs, color: v > 0 ? OK : v < 0 ? NO : "var(--color-ink-3)" }}>{signedPts(v)}</span>
              <Chips n={chipsOf(v, sk.unit)} most={most} lost={v < 0} w={cw} h={dense ? 128 : 150} dense={dense} color={T.color} at={at / 1000} win={v > 0 && v === top} />
              <div className="flex items-start justify-center w-full mt-1" style={{ fontSize: dense ? 11 : 14, height: "2.5em" }}>
                <div className="eyebrow text-center min-w-0 max-w-full" style={{ color: T.color, fontSize: "inherit", letterSpacing: ".1em", lineHeight: 1.25, overflowWrap: "anywhere",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  <span className="inline-block align-middle mr-1.5" style={{ marginTop: -2 }}><Dot t={T} size={dense ? 14 : 18} /></span><bdi>{T.name}</bdi></div>
              </div>
              <div className="flex flex-col items-center gap-1">{S.rounds[t].map((r, i) => (
                <span key={i} className="sk-mini" title={`${r.theme}, ${skLevelWord(r.level)}`} style={{ color: r.delta > 0 ? OK : r.delta < 0 ? NO : "var(--color-ink-3)", fontSize: tight ? 12 : dense ? 13 : 15 }}>
                  {skLevelWord(r.level)} {signedPts(r.delta)}</span>))}</div>
            </div>); })}
      </div>
    </div>);
}
/* a team's stack: a chip for each Medium bet's worth it won (green) or lost (red); a dashed ring where none. Every
   stack's chips the same thickness, thin enough for the tallest to stay inside its box: nothing touches the total
   over it or the name under it */
const chipsOf = (v: number, unit: number) => Math.min(10, Math.round(Math.abs(v) / Math.max(1, unit)));
function Chips({ n, most, lost, w, h, dense, color, at, win }: { n: number; most: number; lost: boolean; w: number; h: number; dense: boolean; color: string; at: number; win: boolean }) {
  const rx = Math.min(w * 0.36, 58), ry = rx * 0.3, th = Math.min(dense ? 11 : 15, (h - 2 * ry - 8) / most), cx = w / 2, base = h - ry - th - 4;
  const [top, side] = lost ? ["#ff5566", "#b92a40"] : ["#3ddc97", "#1f9a63"];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className={win ? "dt-glow" : undefined}
      style={{ overflow: "visible", display: "block", ...(win ? { ["--c" as string]: color, animationDelay: at + 0.3 + n * 0.08 + "s" } : {}) }}>
      {!n && <ellipse cx={cx} cy={base} rx={rx} ry={ry} fill="none" stroke="#8a92b8" strokeWidth="2" strokeDasharray="5 5" opacity=".7" />}
      {Array.from({ length: n }, (_, i) => { const y = base - i * th; return (
        <g key={i} className="sk-drop" style={{ animationDelay: (at + 0.2 + i * 0.08).toFixed(2) + "s", ["--h" as string]: -70 - i * 3 + "px" }}>
          <ellipse cx={cx} cy={y + th} rx={rx} ry={ry} fill={side} /><rect x={cx - rx} y={y} width={rx * 2} height={th} fill={side} />
          {[-0.62, -0.08, 0.46].map((f) => <rect key={f} x={cx + rx * f} y={y + 1} width={rx * 0.16} height={th - 2} fill="#fff" opacity=".75" />)}
          <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill={top} stroke={side} strokeWidth="1" />
          <ellipse cx={cx} cy={y} rx={rx * 0.84} ry={ry * 0.84} fill="none" stroke="#fff" strokeWidth={dense ? 2 : 2.6} strokeDasharray={`${rx * 0.22} ${rx * 0.2}`} opacity=".85" />
          <ellipse cx={cx} cy={y} rx={rx * 0.5} ry={ry * 0.5} fill="none" stroke={color} strokeWidth={dense ? 2.5 : 3} />
        </g>); })}
    </svg>);
}

/* ---- a phone ---- */
/* what's on screen, for a team's phone (me: its team; null: the host's, which sees every team's) */
export function StakesPhone({ sk, screen, teams, me, cap }: { sk: SkPub; screen: string; teams: SkTeam[]; me: number | null; cap?: boolean }) {
  const mine = me != null ? sk.picks?.[me] ?? null : null;
  const many = teams.length > 2;
  /* (the captain's own buttons are the themes: see StakesBet, so nothing more here for them) */
  if (screen === "stakesPick" && cap) return null;
  if (screen === "stakesPick") return (
    <div className="flex flex-col gap-3 w-full">
      <div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>Round {sk.round} of {sk.rounds} · this round&rsquo;s themes</div>
      {/* (the captain's own buttons are the themes: see StakesBet) */}
      {/* (the host's phone: the themes in one line, so every team's bet fits under them) */}
      {!cap && (me == null ? <div className="card !py-2 text-center text-15 font-bold leading-snug">{sk.themes.join(" · ")}</div>
        : <div className="grid grid-cols-1 gap-2 sk-themes">{sk.themes.map((t, i) => <div key={i} className="card !py-3 text-center display text-24 leading-tight">{t}</div>)}</div>)}
      {!cap && <SkLevels unit={sk.unit} small />}
      {me != null && !cap && <p className="text-center text-16 font-bold" role="status">{mine ? <>Your captain bet <b style={{ color: "var(--color-gold)" }}>{skLevelWord(mine.level)}</b> on <b>{sk.themes[mine.k]}</b>.</> : "Your captain is choosing."}</p>}
      {me == null && <div className="flex flex-col gap-1">{teams.map((T, t) => { const p = sk.picks?.[t]; return (
        <div key={t} className="flex items-center gap-2 text-14"><Dot t={T} size={18} /><bdi className="font-bold truncate min-w-0" style={{ color: T.color }}>{T.name}</bdi>
          <span className="ml-auto shrink-0" style={{ color: p ? OK : "var(--color-ink-3)" }}>{p ? `${sk.themes[p.k]} · ${skLevelWord(p.level)}` : "choosing…"}</span></div>); })}</div>}
      {me != null && many && <p className="text-center text-13 text-[var(--color-ink-3)]">{sk.locked.filter(Boolean).length} of {teams.length} teams have bet.</p>}
    </div>);
  if (screen === "stakesQ") {
    if (me == null) return (
      <div className="flex flex-col gap-2 w-full">{teams.map((T, t) => { const p = sk.picks?.[t]; return (
        <div key={t} className="card !py-2 flex flex-col gap-0.5" style={{ borderColor: T.color }}>
          <div className="eyebrow flex items-center gap-2 min-w-0" style={{ color: T.color, letterSpacing: ".1em" }}><Dot t={T} size={16} /><span className="truncate min-w-0"><bdi>{T.name}</bdi> · {p ? sk.themes[p.k] : ""}</span>{p && <SkChip unit={sk.unit} level={p.level} small />}</div>
          <p className="text-15 font-bold leading-snug">{sk.q?.[t]}</p>
        </div>); })}</div>);
    return mine ? (
      <div className="card w-full flex flex-col gap-1.5 text-center enter" style={{ borderColor: teams[me].color }}>
        <div className="flex items-center justify-center gap-2 flex-wrap"><span className="eyebrow" style={{ color: teams[me].color }}>Your bet: {sk.themes[mine.k]}</span><SkChip unit={sk.unit} level={mine.level} small /></div>
        {mine.auto && <p className="text-13 text-[var(--color-ink-2)]">No bet in time: the safe one, Easy.</p>}
        <p className={"font-bold leading-snug " + ((sk.q?.[me] || "").length > 120 ? "text-16" : "text-20")}>{sk.q?.[me]}</p>
      </div>) : null;
  }
  if (screen === "stakesReveal" && sk.rev) { const R = sk.rev; return (
    <div className="flex flex-col gap-1.5 w-full" role="list" aria-label="Each team's bet">
      {R.order.map((t, n) => { const T = teams[t], d = R.delta[t];
        return (
          <div key={t} role="listitem" className="rr-late card !py-2 !px-3 flex items-center gap-2" style={{ ["--rr-at" as string]: `${skRowAt(n, teams.length)}ms`, borderColor: me === t ? T.color : undefined }}>
            <Dot t={T} size={20} />
            <div className="min-w-0 flex-1 flex flex-col leading-tight">
              <span className="text-13 truncate"><bdi className="font-bold" style={{ color: T.color }}>{T.name}</bdi> · {R.theme[t]} · {skLevelWord(R.level[t])}</span>
              <span className="text-13 truncate">{R.typed[t] ? <><bdi>&ldquo;{R.typed[t]}&rdquo;</bdi> <b style={{ color: R.ok[t] ? OK : NO }}>{R.ok[t] ? "RIGHT" : "WRONG"}</b></> : <span className="text-[var(--color-ink-3)]">No answer</span>}
                {!R.ok[t] && <span className="text-[var(--color-ink-3)]"> · <bdi>{R.answer[t]}</bdi></span>}</span>
            </div>
            <span className="display text-22 shrink-0" style={{ color: d > 0 ? OK : d < 0 ? NO : "var(--color-ink-3)" }}>{signedPts(d)}</span>
          </div>); })}
    </div>); }
  if (screen === "stakesSummary" && sk.sum) { const S = sk.sum, order = teams.map((_, t) => t).sort((a, b) => S.net[b] - S.net[a] || a - b); return (
    <div className="flex flex-col gap-1.5 w-full" role="list" aria-label="What each team won or lost">
      {order.map((t) => { const T = teams[t], v = S.net[t];
        return (
          <div key={t} role="listitem" className="card !py-2 !px-3 flex items-center gap-2" style={{ borderColor: me === t ? T.color : undefined }}>
            <Dot t={T} size={20} />
            <div className="min-w-0 flex-1 flex flex-col leading-tight">
              <bdi className="text-14 font-bold truncate" style={{ color: T.color }}>{T.name}</bdi>
              <span className="text-12 text-[var(--color-ink-2)] truncate">{S.rounds[t].map((r, i) => <span key={i}>{i ? " · " : ""}{skLevelWord(r.level)} <b style={{ color: r.delta > 0 ? OK : r.delta < 0 ? NO : undefined }}>{signedPts(r.delta)}</b></span>)}</span>
            </div>
            <span className="display text-24 shrink-0" style={{ color: v > 0 ? OK : v < 0 ? NO : "var(--color-ink-3)" }}>{signedPts(v)}</span>
          </div>); })}
    </div>); }
  return null;
}

/* the captain's bet: a theme, then a level, then Lock in (no changing it after) */
export function StakesBet({ sk, theme, level, setTheme, setLevel, onLock, busy }: { sk: SkPub; theme: number | null; level: string | null;
  setTheme: (k: number) => void; setLevel: (l: string) => void; onLock: () => void; busy?: boolean }) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {/* (which round it is: the bar at the top says so) */}
      <div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>1. Pick a theme</div>
      <div className="grid grid-cols-1 gap-2 sk-themes" role="radiogroup" aria-label="Theme">
        {sk.themes.map((t, i) => (
          <button key={i} type="button" role="radio" aria-checked={theme === i} className={"btn btn-lg btn-block sk-pick" + (theme === i ? " on" : "")} disabled={busy} onClick={() => setTheme(i)}>
            <span className="display text-22 leading-tight">{t}</span></button>))}
      </div>
      <div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>2. Pick a level</div>
      <div className="grid grid-cols-2 gap-2 sk-levels" role="radiogroup" aria-label="Level">
        {SK_LEVELS.map((l) => { const b = skBet(sk.unit, l); return (
          <button key={l} type="button" role="radio" aria-checked={level === l} className={"btn btn-lg sk-pick sk-lv flex flex-col !gap-0" + (level === l ? " on" : "") + (l === "expert" ? " sk-danger" : "")} disabled={busy} onClick={() => setLevel(l)}>
            <span className="text-18 font-bold">{l === "expert" && <span aria-label="Danger">⚠ </span>}{skLevelWord(l)}</span>
            <span className="text-13 font-semibold text-[var(--color-ink-2)]">{l === "easy" ? <span style={{ color: OK }}>safe: 0 either way</span>
              : <><span style={{ color: OK }}>win {b}</span> or <span style={{ color: NO }}>lose {b}</span></>}</span>
          </button>); })}
      </div>
      <p className="text-center text-14 font-semibold">{SK_TOTAL}</p>
      {/* (Expert picked: the warning, in red, before Lock in) */}
      {level === "expert" && <p className="sk-warn text-14 font-semibold leading-snug" role="alert">⚠ {skWarn(sk.unit)}</p>}
      {/* (not docked: docked, it sat over the levels, upright and sideways) */}
      <button className="btn btn-gold btn-lg btn-block" disabled={busy || theme == null || !level} onClick={onLock}>
        {theme != null && level ? `Lock in: ${skLevelWord(level)} on ${sk.themes[theme]}` : "Lock in"}</button>
      <p className="text-center text-13 text-[var(--color-ink-3)]">Nobody else sees your bet. Once it&rsquo;s in, it stays.</p>
    </div>);
}
