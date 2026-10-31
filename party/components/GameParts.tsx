"use client";
/* The pieces every in-game screen shares — the TV and every phone — copied
   from Classic (index.html): the HUD tracker, the round intro with each
   team's lifelines, the "Question for TEAM A" head, the lifeline tiles and
   the mini-game intro with its rules. One look everywhere. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { preloadMap } from "./MapView";
import { preloadWorld, type Mark } from "./PinMap";
import { DISH_STEP, showKm, T_AIRPORT, T_AUCTION, T_MAJORITY, T_BATTLE_HOST, T_BATTLE_TYPED, T_CLOSEST, T_DISH_TYPE, T_FLAG, T_MAP, T_PIN, T_SAY, type MiniKey, type Pub, type Two } from "@/lib/game";

const ICON = {
  friend: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>,
  dip: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M9 5H4v5" /><path d="M15 19h5v-5" /><path d="M4 10a8 8 0 0 1 14-4" /><path d="M20 14a8 8 0 0 1-14 4" /></svg>,
  dbl: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9Z" /></svg>,
};
const LL_NAME = { friend: "Call a Friend", dip: "Double Dip", dbl: "Double Points" } as const;
const side = (t: 0 | 1) => (t === 0 ? "a" : "b");

/* ---- the tracker: scores, where we are, and the night's progress ---- */
function hudLabel(pub: Pub): ReactNode {
  const m = pub.mini, sc = pub.screen;
  if (sc === "final") return <b>Final result</b>;
  if (sc === "sudden") return <b>Sudden death</b>;
  if (m) {
    const tail = /Summary$|Result$/.test(sc) ? "Final" : /Tie$/.test(sc) && m.key !== "battle" ? "Tie"
      : m.key === "battle" && pub.battle ? (sc === "battleTie" ? `Tie-breaker ${pub.battle.tb ?? 1}` : sc === "battleLevel" ? "Tie" : `${pub.teams[pub.battle.cap].name} ${Math.min(pub.battle.i + 1, pub.battle.n)}/${pub.battle.n}`)
      : sc === "decided" ? "Won" : m.tie ? "Tie-breaker" : sc === "majorityIntro" ? "Everyone on their phone" : m.key === "majority" ? `Question ${m.leg} of ${m.of}`
      : `Leg ${m.leg} of ${m.of}${m.fun ? " · for fun" : ""}`;
    return <><b>{m.title}</b> &nbsp;·&nbsp; {tail}</>;
  }
  return <>Round <b>{Math.min(pub.r + 1, pub.N)}</b> of {pub.N} &nbsp;·&nbsp; <b>{pub.theme}</b></>;
}
/* A score that changes rolls like a car's odometer: the old number goes up and out, the new one comes in from
   below (down, the other way), with a pop and a ring in the team's colour when it goes up. */
export function Roll({ v }: { v: number }) {
  const last = useRef(v), [m, setM] = useState<{ from: number; n: number } | null>(null);
  useEffect(() => {
    if (v === last.current) return;
    setM((x) => ({ from: last.current, n: (x?.n ?? 0) + 1 })); last.current = v;
    const t = setTimeout(() => setM((x) => (x ? { ...x, from: v } : x)), 600);
    return () => clearTimeout(t);
  }, [v]);
  const up = !!m && m.from < v, moving = !!m && m.from !== v;
  return (
    <span className={"roll" + (moving && up ? " pop" : "")} key={m?.n ?? 0}>
      <span className="roll-win">
        {moving && <span className={"roll-out " + (up ? "up" : "down")} aria-hidden>{m!.from}</span>}
        <span className={moving ? "roll-in " + (up ? "up" : "down") : ""}>{v}</span>
      </span>
      {moving && up && <span className="roll-ring" aria-hidden />}
    </span>);
}

/* shown: the scores to show for now (the TV holds the old one while the points fly up to it) */
/* code: the room's code, tiny above the round's name, so someone signed out can find their way back in (the TV) */
export function Hud({ pub, size, shown, code }: { pub: Pub; size: "tv" | "phone"; shown?: Two<number>; code?: string }) {
  const T = pub.teams, w = pub.mini?.wins, u = pub.mini?.pct ? "%" : "";
  const sc = (t: 0 | 1) => shown?.[t] ?? T[t].score;
  return (
    <div className={"hud " + size} role="group" aria-label="Scores">
      <div className="hud-in">
        <div className="hud-team a"><span className="dot" /><div className="nm">{T[0].name}</div><div className="sc" data-score="0"><Roll v={sc(0)} /></div>{pub.fire?.[0] && <span className="flame" title="On fire" aria-label="on fire">🔥</span>}</div>
        <div className="hud-mid">
          {code && <div className="hud-code">Room {code}</div>}
          <div className="hud-label">{hudLabel(pub)}</div>
          {pub.pips && pub.pips.length > 0 && <div className="pips" aria-hidden>{pub.pips.map((p, i) => <span key={i} className={`pip ${p.kind === "mini" ? "mini" : ""} ${p.state === "todo" ? "" : p.state}`} />)}</div>}
        </div>
        <div className="hud-team b">{pub.fire?.[1] && <span className="flame" title="On fire" aria-label="on fire">🔥</span>}<div className="sc" data-score="1"><Roll v={sc(1)} /></div><div className="nm">{T[1].name}</div><span className="dot" /></div>
      </div>
      {/* the mini-game's own score, small, under the night's: "This game: A 1 – 2 B" */}
      {w && <div className="hud-mini" aria-label={`This game: ${T[0].name} ${w[0]}${u}, ${T[1].name} ${w[1]}${u}`}>
        <span>This game:</span><span className="nm a">{T[0].name}</span><b className="a">{w[0]}{u}</b><span aria-hidden>–</span><b className="b">{w[1]}{u}</b><span className="nm b">{T[1].name}</span>
      </div>}
    </div>);
}

/* ---- a ruling, in words: RIGHT / WRONG, or DODGED IT / SAID IT. Capitals,
   green for the good one and red for the bad, on the TV and every phone ---- */
export const verdictWord = (v: boolean, say?: boolean) => (say ? (v ? "Dodged it" : "Said it") : v ? "Right" : "Wrong");
/* stamp: on the TV's reveal, the call comes down like a rubber stamp (on the drumroll's hit) */
/* word: a bad call said more exactly ("No answer", "Not on list") */
export function Verdict({ v, say, size, stamp, word }: { v: boolean | null | undefined; say?: boolean; size?: number; stamp?: boolean; word?: string }) {
  if (v == null) return null;
  return <span className={"verdict " + (v ? "pos" : "neg") + (stamp ? " stamped" : "")} style={size ? { fontSize: stamp ? Math.round(size * 0.84) : size } : undefined}>{word || verdictWord(v, say)}</span>;
}

/* ---- the ruling buttons under a team's answer: [RIGHT] [WRONG] (or
   [DODGED IT] [SAID IT]). The call that stands is filled in; the app's own
   call carries an "App suggests" tag; the other button flips it. Wherever
   the app judges, the host (or, with no host, the other captain) can. ---- */
/* sticky: the call already stands (a reveal), so tapping the lit button again changes nothing */
/* compact: the reveal screens' smaller pair, beside each team's answer */
/* neg: the exact word for the call that scores nothing ("Same word", "Off the list"), where the app has one */
export function RulingPicker({ value, app, say, onPick, busy, label, sticky, compact, neg }: { value: boolean | null | undefined; app?: boolean | null; say?: boolean; onPick: (v: boolean) => void; busy?: boolean; label?: string; sticky?: boolean; compact?: boolean; neg?: string }) {
  const opt = (v: boolean) => {
    const on = value === v;
    return (
      <button type="button" className={"btn btn-lg rule-btn " + (v ? "pos" : "neg") + (on ? " on" : "")} aria-pressed={on} disabled={busy} onClick={() => { if (!(sticky && on)) onPick(v); }}>
        {app === v && <span className="rule-tag">App suggests</span>}
        <span>{!v && neg ? neg : verdictWord(v, say)}</span>
      </button>);
  };
  return <div className={"rule-pick" + (compact ? " compact" : "")} role="group" aria-label={label || "Your call"}>{opt(true)}{opt(false)}</div>;
}

/* ---- a mini-game's score, the same on the TV and every phone: each team's
   number big in its colour, the team's name under it, the loser dimmed ---- */
export function ScoreBoard({ pub, w, win, label, size }: { pub: Pub; w: Two<number>; win?: 0 | 1 | null; label?: string; size: "tv" | "phone" }) {
  const T = pub.teams, tv = size === "tv", u = pub.mini?.pct && /^majority/.test(pub.screen) ? "%" : "";
  const col = (t: 0 | 1) => (
    <div key={t} className={"flex flex-col items-center gap-1 min-w-0 " + (t === 1 ? "order-3" : "")} style={{ opacity: win == null || win === t ? 1 : 0.55 }}>
      <div className="display leading-none" style={{ fontSize: tv ? 130 : 60, color: t === 0 ? "var(--color-a)" : "var(--color-b)" }}>{w[t]}{u}</div>
      <div className="font-bold uppercase text-center leading-tight text-[var(--color-ink-2)] max-w-full truncate" style={{ fontSize: tv ? 22 : 12, letterSpacing: ".1em" }}>{T[t].name}</div>
    </div>);
  return (
    <div className={tv ? "w-full max-w-[900px]" : "py-1"} aria-label={`${label ? label + ": " : ""}${T[0].name} ${w[0]}${u}, ${T[1].name} ${w[1]}${u}`}>
      {label && <div className="eyebrow text-center mb-2" style={tv ? { fontSize: 18 } : undefined}>{label}</div>}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {col(0)}{col(1)}
        <div className="display text-[var(--color-ink-3)] order-2" style={{ fontSize: tv ? 70 : 36 }}>–</div>
      </div>
    </div>);
}

/* ---- Drop the Pin: the landmark's photo (our own copy, under a name that says nothing), and whose photo it is ----
   zoom (the phones): a tap opens it full screen, in the TV's size, and another tap closes it */
export function PinPhoto({ pin, h, small, credit, zoom }: { pin?: Pub["pin"]; h: number; small?: boolean; credit?: boolean; zoom?: boolean }) {
  const [big, setBig] = useState(false);
  useEffect(() => setBig(false), [pin?.photo]);
  if (!pin) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  const img = <img src={`/pins/${pin.photo}${small ? "-s" : ""}.jpg`} alt="The landmark" className="pin-photo" style={{ maxHeight: h }} draggable={false} />;
  return (
    <figure className="flex flex-col items-center gap-1 m-0">
      {zoom ? <button type="button" className="pin-zoom" onClick={() => setBig(true)} aria-label="Make the photo bigger">{img}<span className="pin-zoom-hint" aria-hidden>Tap to enlarge</span></button> : img}
      {credit && <figcaption className="pin-credit">Photo: {pin.credit} · {pin.licence} · Wikimedia Commons</figcaption>}
      {/* on the page itself, so nothing on the screen (an animation, a card) can box it in */}
      {big && createPortal(
        <div className="pin-big" role="dialog" aria-label="The landmark, full screen" onClick={() => setBig(false)}>
          <PinchImg src={`/pins/${pin.photo}.jpg`} />
          <span className="pin-pinch">Pinch to zoom</span>
          <button type="button" className="btn btn-sm">Close</button>
        </div>, document.body)}
    </figure>);
}

/* the enlarged photo: two fingers zoom it (up to 5×), one finger moves it about once zoomed, a double tap
   goes back; the page itself stays locked like an app (23 Oct) */
function PinchImg({ src }: { src: string }) {
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ d: number; k: number; x: number; y: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);
  const begin = () => {
    const p = [...pts.current.values()];
    if (p.length === 2) start.current = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, k: t.k, x: t.x, y: t.y, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 };
    else if (p.length === 1) start.current = { d: 0, k: t.k, x: t.x, y: t.y, cx: p[0].x, cy: p[0].y };
  };
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={src} alt="The landmark" draggable={false}
      style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId);
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); begin();
        if (pts.current.size === 1) { const now = Date.now(); if (now - lastTap.current < 300) setT({ k: 1, x: 0, y: 0 }); lastTap.current = now; }
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId) || !start.current) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const p = [...pts.current.values()], s0 = start.current;
        if (p.length >= 2 && s0.d) {
          const k = Math.min(5, Math.max(1, (s0.k * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) / s0.d));
          setT({ k, x: k === 1 ? 0 : s0.x + (p[0].x + p[1].x) / 2 - s0.cx, y: k === 1 ? 0 : s0.y + (p[0].y + p[1].y) / 2 - s0.cy });
        } else if (p.length === 1 && s0.k > 1) setT({ k: s0.k, x: s0.x + p[0].x - s0.cx, y: s0.y + p[0].y - s0.cy });
      }}
      onPointerUp={(e) => { pts.current.delete(e.pointerId); begin(); if (!pts.current.size) start.current = null; }}
      onPointerCancel={(e) => { pts.current.delete(e.pointerId); begin(); if (!pts.current.size) start.current = null; }} />);
}

/* the reveal on the map: where it is (the landmark's name on it), and each team's pin with how far off */
export const TEAM_HEX = ["#31c9f7", "#ff4d82"] as const;   // --color-a, --color-b (a canvas can't read CSS variables)
export function pinMarks(pub: Pub): Mark[] {
  const R = pub.pin?.reveal;
  if (!R) return [];
  const out: Mark[] = [{ at: R.at, kind: "truth", color: "#F5C518", label: R.name }];
  ([0, 1] as const).forEach((t) => { const p = R.pins[t], km = R.km[t]; if (p) out.push({ at: p, kind: "pin", color: TEAM_HEX[t], label: `${pub.teams[t].name.replace(/[\u2068\u2069]/g, "")} · ${km == null ? "" : showKm(km)}` }); });
  return out;
}

/* ---- Guess the Airport: a departures board, drawn (not a photo): time, where to, the flight, the gate, its status ---- */
/* the status's colour, whatever the language: cancelled red, delayed amber, boarding green */
const TONE: [RegExp, string][] = [
  [/cancel|annul|ακυρ|iptal|geannuleerd|ملغ|欠航/i, "#ff5566"],
  [/delay|retras|atras|retard|καθυστ|gecik|vertraag|verspät|متأخر|遅延/i, "#ffb020"],
  [/board|embar|instap|biniş|son çağrı|επιβίβ|صعود|搭乗|última|last call|gate offen/i, "#3ddc97"],
];
const tone = (st: string) => TONE.find(([r]) => r.test(st))?.[1] || "#ffd25a";
/* flip: the TV, a new board: its rows flip in one after another, like a real departures board */
export function Board({ air, size, flip }: { air?: Pub["airport"]; size: "tv" | "phone" | "small"; flip?: boolean }) {
  if (!air) return null;
  const tv = size === "tv", fs = tv ? 21 : size === "small" ? 11 : 13;
  return (
    <div className="board" style={{ fontSize: fs }} role="table" aria-label="Departures board">
      <div className="board-title" style={{ fontSize: fs * 1.25 }}>
        <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z" /></svg>
        <bdi>{air.title}</bdi>
      </div>
      {air.board.map((r, i) => (
        <div key={i} className={"board-row " + (tv ? "tv" : "") + (flip ? " board-flip" : "")} role="row" style={flip ? { animationDelay: 0.05 + i * 0.06 + "s" } : undefined}>
          <span className="b-time" role="cell">{r[0]}</span>
          <span className="b-dest" role="cell"><bdi>{r[2]}</bdi></span>
          <span className="b-flight" role="cell">{r[3]}</span>
          {tv && <span className="b-gate" role="cell">{r[4]}</span>}
          <span className="b-status" role="cell" style={{ color: tone(r[1]) }}><bdi>{r[1]}</bdi></span>
        </div>))}
    </div>);
}

/* ---- a flag, with a thin light edge: a black stripe (Yemen, Germany) must not melt into the night sky ---- */
export function FlagImg({ name, h, maxW }: { name?: string; h: number; maxW?: number }) {
  /* name: the flag's public/fx name (scripts/hash-flags.mjs), which doesn't give the country away */
  // eslint-disable-next-line @next/next/no-img-element
  return name ? <img src={`/fx/${name}.svg`} alt="The flag" className="flag-img" style={{ height: h, maxWidth: maxW ?? "100%" }} /> : null;
}

/* ---- the end of the night: confetti, on the TV and every phone ---- */
const CONFETTI = ["var(--color-gold)", "var(--color-gold-2)", "var(--color-a)", "var(--color-b)", "#ffffff", "var(--color-ok)"];
export function Confetti({ n = 90 }: { n?: number }) {
  /* fixed positions per piece (no Math.random in render: the TV and a phone's re-render must not reshuffle) */
  const bits = Array.from({ length: n }, (_, i) => {
    const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    return { left: r(1) * 100, delay: -r(2) * 6, dur: 3.2 + r(3) * 3, w: 6 + r(4) * 8, h: 8 + r(5) * 10, rot: r(6) * 360, sway: (r(7) - 0.5) * 160,
      c: CONFETTI[i % CONFETTI.length], round: r(8) > 0.75 };
  });
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => <i key={i} style={{ left: b.left + "%", width: b.w, height: b.round ? b.w : b.h, background: b.c, borderRadius: b.round ? "50%" : 2,
        animationDelay: b.delay + "s", animationDuration: b.dur + "s", ["--rot" as string]: b.rot + "deg", ["--sway" as string]: b.sway + "px" }} />)}
    </div>);
}

/* ---- a team's remaining lifelines, as Classic's badges ---- */
function Inventory({ pub, t }: { pub: Pub; t: 0 | 1 }) {
  const ll = pub.teams[t].ll;
  return (
    <div className="ll-inv grid-cols-2">
      {(["friend", "dip"] as const).map((k) => <span key={k} className={"badge " + (ll[k] ? "line" : "no")}>{LL_NAME[k]}</span>)}
    </div>);
}

/* ---- the round intro: theme, who's first, and "double points, yes or no?" ----
   The Double Points tile is a button on that team's captain's phone; everyone
   else sees the same tile, lit or not, so the room knows what was armed. */
export function RoundIntro({ pub, canArm, onArm, size, busy }: { pub: Pub; canArm?: (t: 0 | 1) => boolean; onArm?: (t: 0 | 1) => void; size: "tv" | "phone"; busy?: boolean }) {
  const T = pub.teams, tv = size === "tv";
  /* only a captain's phone gets the yes/no card (for its own team) */
  const captain = !!canArm && (canArm(0) || canArm(1));
  const card = (t: 0 | 1) => {
    const armed = !!pub.dbl?.[t], can = T[t].ll.dbl, mine = !!canArm?.(t);
    const cls = "ll " + (armed ? "armed" : can ? "" : "usedup");
    const label = armed ? "Double points armed" : can ? (mine ? "Arm double points" : "Not armed") : "Double points already used";
    return (
      <div key={t} className={"team-card " + side(t)}>
        <div className="flex items-center justify-between gap-2">
          <span className="team-tag">{T[t].name}</span>
          {pub.captains?.[t] && <span className="badge line">Captain: {pub.captains[t]}</span>}
        </div>
        {mine && (can || armed)
          ? <button type="button" className={cls} disabled={busy} aria-pressed={armed} onClick={() => onArm?.(t)}>{ICON.dbl}<span className="nm">{armed ? "Armed: tap to undo" : label}</span></button>
          : <div className={cls} aria-label={label}>{ICON.dbl}<span className="nm">{label}</span></div>}
        <Inventory pub={pub} t={t} />
      </div>);
  };
  return (
    <div className={"flex flex-col items-center text-center " + (tv ? "gap-5" : "gap-4")}>
      <div className="flex flex-col items-center gap-2">
        <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>Round {pub.r + 1} of {pub.N}</div>
        <h1 className={"display" + (tv ? " slam" : "")} style={{ fontSize: tv ? 104 : 46 }}>{pub.theme}</h1>
        <p className="text-[var(--color-ink-2)]" style={{ fontSize: tv ? 22 : 13 }}>{T[pub.first ?? 0].name} answers first</p>
      </div>
      {/* the TV, the host and the players: no explaining, just a badge once a team has armed it */}
      {!captain && (pub.dbl?.[0] || pub.dbl?.[1]) && (
        <div className="flex flex-wrap justify-center gap-3" role="status">
          {([0, 1] as const).filter((t) => pub.dbl?.[t]).map((t) => (
            <span key={t} className={"ll armed " + side(t)} style={tv ? { fontSize: 24, padding: "12px 22px" } : undefined}>{ICON.dbl}<span className="nm">{T[t].name} · Double points</span></span>))}
        </div>)}
      {captain && <div className={"card flex flex-col gap-3 w-full " + (tv ? "" : "ri-sm !p-3")}>
        <div>
          <div className="eyebrow" style={{ fontSize: tv ? 15 : undefined }}>{tv ? "Captains: double points, yes or no?" : "Double points, yes or no?"}</div>
          <p className="text-[var(--color-ink-3)] mt-1.5" style={{ fontSize: tv ? 16 : 12 }}>{tv ? "Armed now, before the questions: a right answer scores 2, and a steal against you pays them 2. One other lifeline at most this round." : "Arm it now. Right: 2 points. Stolen from you: they get 2. One other lifeline at most this round."}</p>
        </div>
        <div className={tv ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-3"}>{card(0)}{card(1)}</div>
      </div>}
    </div>);
}

/* ---- "QUESTION FOR TEAM A": the head of a question or a steal ---- */
export function AskHead({ pub, you, go, size }: { pub: Pub; you?: string; go?: boolean; size: "tv" | "phone" }) {
  const t = (pub.turn ?? 0) as 0 | 1, T = pub.teams, steal = pub.screen === "steal", tv = size === "tv";
  const armed = !steal && !!pub.dbl?.[t];
  /* phones, a team's own question: one line, "THEME · Question for TEAM", so Send stays on screen (29 Oct, C18 B) */
  if (!tv && !steal) return (
    <div className="flex flex-col items-center text-center gap-1.5">
      <p className={"whofor " + side(t)} style={{ fontSize: 18 }}><span className="text-[var(--color-ink-2)]">{pub.theme}{armed ? " · Double points" : ""} · </span>Question for <b>{T[t].name}</b></p>
      {you && <p className={"you-line mt-1 " + (go ? "go" : "")}>{you}</p>}
    </div>);
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div className="q-theme" style={steal ? { borderColor: "var(--color-gold)", color: "var(--color-gold)", fontSize: tv ? 15 : undefined } : { fontSize: tv ? 15 : undefined }}>
        {steal ? "Steal" : pub.theme}{armed && <> &nbsp;·&nbsp; <span style={{ color: "var(--color-gold)" }}>Double points</span></>}
      </div>
      <p className={"whofor " + side(t)} style={{ fontSize: tv ? 30 : 18 }}>{steal ? "Steal for" : "Question for"} <b>{T[t].name}</b></p>
      {(steal || !tv) && <p className="reader" style={{ fontSize: tv ? 15 : 11 }}>
        {steal ? "No lifelines on a steal" : pub.captains?.[t] ? `Answer from ${pub.captains[t]} only` : "Only the captain's answer counts"}
      </p>}
      {you && <p className={"you-line mt-1 " + (go ? "go" : "")}>{you}</p>}
    </div>);
}

/* ---- the lifelines of the team answering: tiles everyone sees; the captain taps ---- */
export function LifelineStrip({ pub, t, onUse, busy, size }: { pub: Pub; t: 0 | 1; onUse?: (k: "friend" | "dip") => void; busy?: boolean; size: "tv" | "phone" }) {
  const team = pub.teams[t], used = pub.llUsed?.[t] || [], armed = !!pub.dbl?.[t];
  const blocked = armed && used.length >= 1;
  const tile = (k: "friend" | "dip") => {
    const inuse = used.includes(k), spent = !team.ll[k] && !inuse;
    const cls = "ll " + (inuse ? "inuse" : spent ? "spent" : blocked ? "off" : "");
    const can = !!onUse && !inuse && !spent && !blocked;
    return can
      ? <button key={k} type="button" className={cls} disabled={busy} onClick={() => onUse!(k)}>{ICON[k]}<span className="nm">{LL_NAME[k]}</span></button>
      : <div key={k} className={cls}>{ICON[k]}<span className="nm">{inuse ? `${LL_NAME[k]}: used now` : LL_NAME[k]}</span></div>;
  };
  return (
    <div className={"card flex flex-col " + (size === "tv" ? "gap-2.5" : "gap-2 !p-3")} style={size === "tv" ? { padding: 14 } : undefined}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="eyebrow">Lifelines · {team.name}</div>
        {armed && <span className="badge gold">Double points armed</span>}
      </div>
      <div className={"ll-grid " + (size === "phone" ? "sm" : "")}>
        {tile("friend")}{tile("dip")}
        <div className={"ll " + (armed ? "armed" : "off")}>{ICON.dbl}<span className="nm">{armed ? "Double armed" : "Round start only"}</span></div>
      </div>
      {onUse && blocked && <p className="text-12 text-[var(--color-ink-3)]">Double points armed: no more lifelines this round.</p>}
    </div>);
}

/* ---- the mini-game intro: title, the gold band, the numbered rules ---- */
function rules(pub: Pub): { text: string; warn?: boolean }[] {
  const m = pub.mini!, n = m.of, pts = m.pts === 1 ? "1 point" : `${m.pts} points`, host = pub.mode === "host";
  /* the house timers, as set in Settings on the TV */
  const t = pub.timers, sec = (v: number | undefined, d: number) => `${v ?? d} seconds`;
  /* level at the end: the same choice in every mini-game */
  const call = host ? "the host's call" : `${pub.captains?.[pub.lead ?? 0] || "Team A's captain"}'s call`;
  const level = `Won with legs to spare? Keep playing for fun, or stop. Tied at the end? One more, or a point each. Both ${call}.`;
  switch (m.key) {
    case "closest": return [
      { text: "Both teams get the same number question at the same time." },
      { text: `${sec(t?.mini ?? pub.tMini, T_CLOSEST)} for each captain to lock in one number on their phone.` },
      { text: "Closest number wins the leg. Tie = one point each. Nobody answers = nobody scores." },
      { text: "No lifelines in this leg.", warn: true },
      { text: `After ${n} legs, whoever leads takes ${pts}. ${level}` }];
    case "auction": return [
      { text: `${n} categories. The open alternates, so nobody bids blind twice.` },
      { text: "One captain bids on their phone: how many they can name. The other raises, or passes." },
      { text: `Whoever holds the bid gets ${sec(t?.auction, T_AUCTION)} to name that many, out loud.` },
      { text: `Bids go up to 100. ${host ? "The host counts" : "The other captain counts"}. Make it, you take the leg. Fall short and the other team takes it.` },
      { text: `No lifelines, no help from the room. Most legs takes ${pts}.`, warn: true }];
    case "saysame": return [
      { text: `A prompt, ${sec(t?.say, T_SAY)}. Both captains type an answer, hidden from each other. The app has a word hidden: matching each other is fine, only matching the app costs you.` },
      { text: "Your answer must be a real one, on the app's list for the prompt (typos are fine). Anything else counts as SAID IT." },
      { text: `Time's up: the word comes up. ${host ? "The host can change the app's call." : "The other captain can give you a fair answer the list missed."}` },
      { text: "Dodged it alone? You take the leg. Both dodged or both said it? Tie, a point each." },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "map": return [
      { text: `A map goes up: no title, just the colours. ${sec(t?.map, T_MAP)}.` },
      { text: "Both captains type what the map shows, at the same time." },
      { text: `${host ? "The host reveals it and rules." : "It's revealed, and each captain rules on the other team's answer."} The idea counts, not the exact words. Both right? A point each. Nobody? Nobody.` },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "flag": return [
      { text: `A flag goes up. ${sec(t?.flag, T_FLAG)}.` },
      { text: "Both captains type whose flag it is, at the same time." },
      { text: `The app checks them${host ? ", and the host can change the call" : ". Its RIGHT stands; the other captain can give one it called WRONG"}. Both right? A point each. Nobody? Nobody.` },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "pin": return [
      { text: `A photo of a landmark goes up. ${sec(t?.pin, T_PIN)}. On the hard ones its name comes too: the trick is finding it.` },
      { text: "Both captains drop a pin on the world map on their phone, where they think it is. Pinch or tap + to zoom right in: the closer, the better." },
      { text: "The nearer pin takes the leg, by the kilometre. The same distance? A point each. No pin? No point." },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "airport": return [
      { text: `A departures board goes up: where its flights go, the airlines, the language on it. ${sec(t?.airport, T_AIRPORT)}.` },
      { text: "Both captains type which airport it is, at the same time. The city is enough, except where it has more than one: then name the airport (Heathrow, not London)." },
      { text: `The app checks them${host ? ", and the host can change the call" : ". Its RIGHT stands; the other captain can give one it called WRONG"}. Both right? A point each. Nobody? Nobody.` },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "majority": return [
      { text: "Everyone plays on their own phone, captains too. The lists are fixed at Start.", warn: true },
      { text: `${n} questions, four answers, ${sec(t?.majority, T_MAJORITY)} each. One tap and it's locked. No answer counts as wrong.` },
      { text: "Eyes on your own phone: every phone has the answers in a different order." },
      { text: `Each team scores the share of its answers that are right, so a smaller team isn't at a disadvantage. The higher share takes ${pts}.` }];
    case "dish": return [
      { text: `The ingredients come up one at a time, a new one every ${sec(t?.dishStep, DISH_STEP)}. The giveaway comes last.` },
      { text: `Know it? Captain, hit BUZZ: the first buzz answers, and has ${sec(t?.dishType, T_DISH_TYPE)} to type it.` },
      { text: "One go per team. Wrong, and you're out of that one: the list keeps coming for the other team." },
      { text: `Best of ${n} takes ${pts}. ${level}` }];
    case "battle": return [
      { text: "Captains only. The room says nothing, and that means nothing.", warn: true },
      { text: `${n} questions each, ${host ? `${sec(t?.battleHost, T_BATTLE_HOST)} a shot, out loud` : `${sec(t?.battleTyped, T_BATTLE_TYPED)} a shot, typed on the phone`}. ${pub.teams[0].name}'s captain goes first.` },
      { text: "Same spread for both: five easy, five medium, in the same order. Different questions." },
      { text: "No lifelines, no conferring, no second guesses." },
      { text: `Best score takes ${pts}. Tied? One buzzer question to settle it (first captain in takes it), or a point each: ${call}.` }];
  }
}
/* head: in place of the small heading above the title (the TV's Battle: its two captains, VS between them) */
export function MiniIntro({ pub, size, head }: { pub: Pub; size: "tv" | "phone"; head?: ReactNode }) {
  const m = pub.mini, tv = size === "tv";
  if (!m) return null;
  const band = m.key === "battle" ? `${m.of} questions each` : m.key === "majority" ? `${m.of} questions` : `Best of ${m.of}`;
  return (
    <div className={"flex flex-col items-center text-center w-full " + (tv ? "gap-5" : "gap-4")}>
      {head || <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>{m.key === "battle" ? "The last word" : "Mini-game"}</div>}
      <h1 className={"display" + (tv ? " slam" : "")} style={{ fontSize: tv ? 88 : 44 }}>{m.title}</h1>
      <div className={"mini-band " + (tv ? "" : "sm")}>
        <span className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 15 : 11 }}>{band}</span>
        <span className="sep text-[var(--color-ink-3)]">·</span>
        <span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>Winner takes {m.pts} point{m.pts === 1 ? "" : "s"}</span>
        {m.kinds && <><span className="sep text-[var(--color-ink-3)]">·</span><span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>{m.kinds}</span></>}
      </div>
      <div className="card w-full">
        <ol className="rules" style={tv ? { fontSize: 20, gap: 12 } : undefined}>
          {rules(pub).map((r, i) => <li key={i} className={r.warn ? "warn" : undefined}>{r.text}</li>)}
        </ol>
      </div>
    </div>);
}

/* a standard question's result: a team that had its go (its own question, or the steal) and sent nothing */
export const silent = (pub: Pub, t: 0 | 1) => {
  const r = pub.result;
  if (!r || r.owner == null || r.typed?.[t]) return null;
  if (r.by === t) return null;                     // the host ruled it right, typed or not
  return t === r.owner ? "No answer" : !r.correct ? "No answer" : null;
};

/* a tie at the end of a mini-game, in the same words on the TV and every phone */
export const tieHead = (pub: Pub) => (pub.mini?.pct ? `Tie at ${pub.mini.wins[0]}% each` : `Tie at ${pub.mini?.wins[0] ?? 0} each`);
export const tieCall = (pub: Pub) =>
  `One more to settle it, or a point each: ${pub.mode === "host" ? "the host" : pub.captains?.[pub.lead ?? 0] || "the captain"} decides.`;
/* the pictures coming up, fetched ahead (flags into the browser's cache, maps into MapView's) */
export function usePreload(pub: Pub | null) {
  const key = JSON.stringify(pub?.preload || null);
  useEffect(() => {
    const P = pub?.preload;
    P?.flags?.forEach((f) => { const i = new Image(); i.src = `/fx/${f}.svg`; });
    P?.maps?.forEach((m) => preloadMap(m));
    P?.pins?.forEach((f) => { for (const v of ["", "-s"]) { const i = new Image(); i.src = `/pins/${f}${v}.jpg`; } });
    if (P?.world) preloadWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
/* won with legs to spare: the same words on the TV and every phone */
export const decidedHead = (pub: Pub) => (pub.decided ? `${pub.teams[pub.decided.winner].name} won it!` : "");
/* what a mini-game's legs are called ("4 flags", "the last landmark") */
const LEG_UNIT: Partial<Record<MiniKey, string>> = { closest: "question", saysame: "prompt", flag: "flag", map: "map", dish: "recipe", pin: "landmark", airport: "board", auction: "category" };
export const legsLeft = (key: MiniKey, n: number) => { const u = LEG_UNIT[key] || "leg"; return n === 1 ? `The last ${u} is` : `The last ${n} ${u.replace(/y$/, "ie")}s are`; };
export const decidedPts = (pub: Pub) => (pub.decided ? `+${pub.decided.pts} point${pub.decided.pts === 1 ? "" : "s"}` : "");
export const decidedFun = (pub: Pub) => (pub.decided ? `${legsLeft(pub.decided.key, pub.decided.spare)} just for fun.` : "");
export const decidedSub = (pub: Pub) => (pub.decided ? `${decidedPts(pub)}. ${decidedFun(pub)}` : "");
export const decidedWho = (pub: Pub) => (pub.mode === "host" ? "The host" : pub.captains?.[pub.lead ?? 0] || "The captain");
export const decidedCall = (pub: Pub) => `Play on, or stop here? ${decidedWho(pub)} decides.`;
/* the Battle at halftime: what the second captain needs (the Battle pays mini.pts) */
export const battleNeeds = (pub: Pub) => {
  const B = pub.battle, T = pub.teams;
  if (!B) return "";
  const s = B.score[0], pts = pub.mini?.pts;
  if (s >= B.n) return `${T[1].name} need all ${B.n} to tie it.`;
  return `${T[1].name} need ${s + 1} to win the Battle${pts ? ` (+${pts})` : ""}, ${s} to tie.`;
};
