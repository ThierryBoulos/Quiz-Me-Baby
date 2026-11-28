"use client";
/* TEAM MASCOTS (28 Nov, the owner's pick, idea 3 option A): each team's little creature, picked by its captain in the
   lobby from eight, in the team's colour. It lives the question with its team on the TV: it bobs and blinks, looks up at
   the clock, hops when its captain sends, jumps with its arms up when the team is right, sinks under a little rain cloud
   when it's wrong, shrugs when there was no answer. Between questions one walks out and hops about (MascotStroll).
   (The players' faces are gone: 28 Nov, the owner, "it just confuses everyone"; a player is their name, a team its
   mascot.) With Motion off in Settings the mascots stand still and only change face. */
import { createContext, useContext, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motionOff } from "./Marquee";

export const MASCOT_COUNT = 8;
export type Mood = "idle" | "think" | "sent" | "right" | "wrong" | "none";

/* the room's picks (room.state.teamMascots): what each team's captain picked, or null. A picked mascot is that team's
   alone: the other captains see it greyed out (28 Nov, the owner). A team that hasn't picked has its own number's
   creature, or the next one nobody has, so no two teams ever look alike */
const TEAMS_MAX = 8;
export const pickedOf = (picks: unknown, t: number) => {
  const v = Array.isArray(picks) && picks[t] != null ? Number(picks[t]) : NaN;
  return Number.isInteger(v) && v >= 0 && v < MASCOT_COUNT ? v : null;
};
export function allMascots(picks: unknown): number[] {
  const taken = new Set<number>(), out: number[] = [];
  for (let t = 0; t < TEAMS_MAX; t++) { const v = pickedOf(picks, t); if (v != null) taken.add(v); }
  for (let t = 0; t < TEAMS_MAX; t++) {
    const v = pickedOf(picks, t);
    if (v != null) { out[t] = v; continue; }
    let c = t % MASCOT_COUNT;
    for (let j = 0; j < MASCOT_COUNT; j++) { const x = (t + j) % MASCOT_COUNT; if (!taken.has(x)) { c = x; break; } }
    out[t] = c; taken.add(c);
  }
  return out;
}
export const mascotOf = (picks: unknown, t: number) => allMascots(picks)[t] ?? t % MASCOT_COUNT;
/* the mascots the other teams (of k) have picked: not to be picked again */
export const takenBy = (picks: unknown, t: number, k: number) => new Set(Array.from({ length: k }, (_, i) => (i === t ? null : pickedOf(picks, i))).filter((v): v is number => v != null));
/* the TV hands its room's picks down to every screen (the screens never carry them: they're the room's, like its names) */
const Picks = createContext<unknown>(null);
export const MascotPicks = Picks.Provider;
export const useMascot = (t: number) => mascotOf(useContext(Picks), t);

/* shade a team's colour: f < 0 darker, f > 0 lighter */
function shade(hex: string, f: number) {
  const h = hex.replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (!Number.isFinite(n)) return hex;
  const m = (c: number) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

/* the eight bodies: each its own outline and what sits on top (ears, horns, an antenna...), the same face */
const SHAPES: { body: string; top: string; cream?: boolean; one?: boolean }[] = [
  { body: "M50 22 C78 22 88 46 88 66 C88 90 72 100 50 100 C28 100 12 90 12 66 C12 46 22 22 50 22Z", top: "M16 30a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M64 30a10 10 0 1 0 20 0a10 10 0 1 0 -20 0" },
  { body: "M50 18 C80 18 86 50 86 70 C86 92 70 100 50 100 C30 100 14 92 14 70 C14 50 20 18 50 18Z", top: "M30 26 L22 4 L40 20Z M70 26 L78 4 L60 20Z", cream: true },
  { body: "M50 26 C76 26 90 44 90 68 C90 90 74 100 50 100 C26 100 10 90 10 68 C10 44 24 26 50 26Z", top: "M48 27 Q46 12 56 6 L58 9 Q50 14 52 27Z M54 6a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" },
  { body: "M50 20 L58 28 L66 18 L70 30 L82 26 L80 40 C90 52 90 64 88 74 C86 92 72 100 50 100 C28 100 14 92 12 74 C10 64 10 52 20 40 L18 26 L30 30 L34 18 L42 28Z", top: "" },
  { body: "M50 10 C72 10 80 34 80 62 C80 90 68 100 50 100 C32 100 20 90 20 62 C20 34 28 10 50 10Z", top: "M41 9a9 4 0 1 0 18 0a9 4 0 1 0 -18 0", cream: true },
  { body: "M22 28 Q50 20 78 28 Q90 30 90 46 L90 84 Q90 100 74 100 L26 100 Q10 100 10 84 L10 46 Q10 30 22 28Z", top: "M24 28 L30 14 L38 26Z M76 28 L70 14 L62 26Z" },
  { body: "M50 22 C80 22 90 48 90 68 C90 92 72 100 50 100 C28 100 10 92 10 68 C10 48 20 22 50 22Z", top: "", one: true },
  { body: "M50 24 C78 24 86 48 86 68 C86 92 70 100 50 100 C30 100 14 92 14 68 C14 48 22 24 50 24Z", top: "M14 56 Q-6 40 2 22 Q14 38 20 46Z M86 56 Q106 40 98 22 Q86 38 80 46Z" },
];

export function Mascot({ kind, color, mood = "idle", size = 80, delay = 0, className, style, label }: {
  kind: number; color: string; mood?: Mood; size?: number; delay?: number; className?: string; style?: CSSProperties; label?: string;
}) {
  const id = useId().replace(/:/g, ""), s = SHAPES[((kind % MASCOT_COUNT) + MASCOT_COUNT) % MASCOT_COUNT];
  const [still, setStill] = useState(false);
  useEffect(() => setStill(motionOff()), []);
  const dark = shade(color, -0.35), light = shade(color, 0.45), fill = `url(#m${id})`;
  return (
    <span className={`msc ${mood}${still ? " still" : ""}${className ? " " + className : ""}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ width: size || undefined, ["--dl" as string]: -delay + "s", ["--bl" as string]: -((delay * 1.7) % 4) + "s", ...style }}>
      <svg viewBox="-6 -14 112 128">
        <defs><radialGradient id={"m" + id} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor={light} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={dark} /></radialGradient></defs>
        <ellipse cx="50" cy="108" rx="30" ry="5" fill="rgba(0,0,0,.4)" />
        {/* what goes with each mood: sparkles, the rain cloud, a question mark, the tick */}
        <g className="fx spark" fill="#ffe58a"><path d="M8 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /><path d="M92 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M96 40l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" /></g>
        <g className="fx cloud"><path d="M28 -2 a10 10 0 0 1 18 -6 a12 12 0 0 1 22 4 a9 9 0 0 1 4 17 H30 a9 9 0 0 1 -2 -15z" fill="#9aa3c7" />
          <g fill="#5aa9ff"><path className="drop" d="M38 16 q2 4 0 6 q-2 -2 0 -6z" /><path className="drop" d="M50 16 q2 4 0 6 q-2 -2 0 -6z" /><path className="drop" d="M62 16 q2 4 0 6 q-2 -2 0 -6z" /></g></g>
        <g className="fx qm"><circle cx="82" cy="4" r="12" fill="#fff6df" /><text x="82" y="10" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="18" fill="#15172a">?</text></g>
        <g className="fx tick"><circle cx="84" cy="6" r="11" fill="#3ddc84" /><path d="M78 6 l4 4 l8 -9" fill="none" stroke="#05200f" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
        <g className="bod">
          <ellipse cx="36" cy="102" rx="10" ry="5" fill={dark} /><ellipse cx="64" cy="102" rx="10" ry="5" fill={dark} />
          <g className="arm l"><ellipse cx="11" cy="70" rx="6" ry="11" fill={dark} /></g><g className="arm r"><ellipse cx="89" cy="70" rx="6" ry="11" fill={dark} /></g>
          {s.top && <path d={s.top} fill={s.cream ? "#fff1d6" : fill} />}
          <path d={s.body} fill={fill} />
          <ellipse cx="50" cy="82" rx="22" ry="14" fill={light} opacity=".55" />
          <ellipse cx="34" cy="36" rx="10" ry="6" fill="#fff" opacity=".22" transform="rotate(-25 34 36)" />
          {s.one ? (<g><circle cx="50" cy="52" r="15" fill="#fff" /><g className="pu"><circle cx="51" cy="53" r="7.5" fill="#15172a" /><circle cx="54" cy="50" r="2.4" fill="#fff" /></g>
            <rect className="lid" x="34" y="36" width="32" height="32" rx="16" fill={color} /></g>)
            : (<g><ellipse cx="38" cy="52" rx="9" ry="10.5" fill="#fff" /><ellipse cx="62" cy="52" rx="9" ry="10.5" fill="#fff" />
              <g className="pu"><circle cx="39" cy="54" r="4.8" fill="#15172a" /><circle cx="63" cy="54" r="4.8" fill="#15172a" /><circle cx="41" cy="52" r="1.6" fill="#fff" /><circle cx="65" cy="52" r="1.6" fill="#fff" /></g>
              <rect className="lid" x="28" y="41" width="20" height="22" rx="10" fill={color} /><rect className="lid" x="52" y="41" width="20" height="22" rx="10" fill={color} /></g>)}
          <g fill="none" stroke="#15172a" strokeWidth="3" strokeLinecap="round"><path className="mo sm" d="M42 70 Q50 77 58 70" /><path className="mo fr" d="M42 75 Q50 68 58 75" /><path className="mo fl" d="M42 72 H58" /></g>
          <ellipse className="mo op" cx="50" cy="72" rx="4.5" ry="5" fill="#15172a" />
          <path className="mo big" d="M38 68 Q50 86 62 68 Z" fill="#15172a" />
        </g>
      </svg>
    </span>);
}

/* true once ms have gone by since key last changed (a mascot reacts when the stamps land, never before) */
export function useLater(key: string, ms: number) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); const t = window.setTimeout(() => setOn(true), ms); return () => clearTimeout(t); }, [key, ms]);
  return on;
}

/* THE TV, 2 TEAMS: one mascot in each bottom corner of the stage, under its team's side of the score bar; away: the one
   out on a stroll (it isn't in its corner meanwhile) */
export function MascotCorners({ colors, moods, away, size = 116, show = [true, true] }: { colors: [string, string]; moods: [Mood, Mood]; away?: number | null; size?: number; show?: [boolean, boolean] }) {
  const k0 = useMascot(0), k1 = useMascot(1);
  return (<>
    {show[0] && away !== 0 && <span className="msc-corner l" aria-hidden><Mascot kind={k0} color={colors[0]} mood={moods[0]} size={size} /></span>}
    {show[1] && away !== 1 && <span className="msc-corner r" aria-hidden><Mascot kind={k1} color={colors[1]} mood={moods[1]} size={size} delay={0.6} /></span>}
  </>);
}

/* BETWEEN QUESTIONS (28 Nov, the owner: "walk around the screen from time to time... jump around"): on a screen that
   isn't asking anything, every so often one mascot walks out from its side along the bottom of the stage, hops about,
   and walks back. It only walks where nothing is written: it measures the free floor under what's on screen first,
   and skips its turn if there's no room. Each team in turn; with 5 teams or more, only one is ever out. */
const STAGE_H = 720, STAGE_W = 1280;
export function MascotStroll({ teams, on, first = 4500, every = 15000, onAway }: {
  teams: readonly { kind: number; color: string; side?: "l" | "r" }[]; on: boolean; first?: number; every?: number; onAway?: (t: number | null) => void;
}) {
  /* (it walks on the stage itself, in the stage's own 1280 by 720, wherever this sits in the screen) */
  const anchor = useRef<HTMLSpanElement>(null), box = useRef<HTMLDivElement>(null);
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setStageEl((anchor.current?.closest(".tv-stage") as HTMLElement | null) ?? null); }, []);
  const [walker, setWalker] = useState<{ t: number; w: number; top: number; from: number; to: number; side: "l" | "r"; n: number } | null>(null);
  const away = useRef(onAway); away.current = onAway;
  const list = useRef(teams); list.current = teams;
  useEffect(() => {
    if (!on || motionOff()) return;
    let n = 0, timer = 0;
    const go = () => {
      const stage = anchor.current?.closest(".tv-stage") as HTMLElement | null, T = list.current;
      if (!stage || !T.length) return;
      const t = n % T.length, side = T[t].side ?? (n % 2 ? "r" : "l"); n++;
      /* the free floor, under what's on screen across the stretch it walks (its side to a third of the way in) */
      const S = stage.getBoundingClientRect(), k = S.height / STAGE_H || 1;
      const x0 = side === "l" ? 0 : STAGE_W * 0.62, x1 = side === "l" ? STAGE_W * 0.38 : STAGE_W;
      /* (they walk at the corners' height, over the bottom strip where "Waiting for … to tap Next" sits) */
      const floor = STAGE_H - 58;
      let low = 0;
      stage.querySelectorAll<HTMLElement>("*").forEach((el) => {
        if (el.closest(".msc, .msc-walk, .msc-corner, .op-curtains, .op-lights")) return;
        const own = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent || "").trim()) || /^(IMG|svg|CANVAS|VIDEO|BUTTON)$/.test(el.tagName);
        if (!own) return;
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        const l = (r.left - S.left) / k, rr = (r.right - S.left) / k, b = (r.bottom - S.top) / k, tp = (r.top - S.top) / k;
        if (rr > x0 && l < x1 && tp < floor) low = Math.max(low, b);
      });
      const room = floor - low - 10, w = Math.min(96, Math.floor(room * 112 / 128));
      if (w >= 48) {
        const h = w * 128 / 112;
        setWalker({ t, w, top: floor - h, side, from: side === "l" ? -w - 20 : STAGE_W + 20, to: side === "l" ? STAGE_W * 0.24 : STAGE_W * 0.76 - w, n });
      }
      timer = window.setTimeout(go, every);
    };
    timer = window.setTimeout(go, first);
    return () => { clearTimeout(timer); setWalker(null); away.current?.(null); };
  }, [on, first, every]);
  /* the walk: out to its spot, a hop, a big hop with a spin, then back the way it came */
  useEffect(() => {
    const el = box.current; if (!walker || !el) return;
    let dead = false;
    away.current?.(walker.t);
    const at = (x: number, y = 0, r = 0) => `translate(${x}px, ${walker.top + y}px) rotate(${r}deg)`;
    const run = async () => {
      el.classList.toggle("face-l", walker.side === "r");
      await el.animate([{ transform: at(walker.from) }, { transform: at(walker.to) }], { duration: 2200, easing: "linear", fill: "forwards" }).finished;
      if (dead) return; el.classList.add("hop");
      await el.animate([{ transform: at(walker.to) }, { transform: at(walker.to, -46), offset: .5 }, { transform: at(walker.to) }], { duration: 520, easing: "ease-in-out", fill: "forwards" }).finished;
      if (dead) return;
      await el.animate([{ transform: at(walker.to) }, { transform: at(walker.to, -92, walker.side === "l" ? 180 : -180), offset: .5 }, { transform: at(walker.to, 0, walker.side === "l" ? 360 : -360) }], { duration: 760, easing: "cubic-bezier(.3,0,.4,1)", fill: "forwards" }).finished;
      if (dead) return; el.classList.remove("hop"); el.classList.toggle("face-l", walker.side === "l");
      await el.animate([{ transform: at(walker.to) }, { transform: at(walker.from) }], { duration: 2200, easing: "linear", fill: "forwards" }).finished;
      if (dead) return; setWalker(null); away.current?.(null);
    };
    void run().catch(() => {});
    return () => { dead = true; el.getAnimations().forEach((a) => a.cancel()); };
  }, [walker]);
  const T = walker ? list.current[walker.t] : null;
  return (<span ref={anchor} hidden>{stageEl && createPortal(
    <div ref={box} className="msc-walk" aria-hidden style={{ visibility: walker ? "visible" : "hidden" }}>{T && walker && <Mascot key={walker.n} kind={T.kind} color={T.color} mood="idle" size={walker.w} />}</div>, stageEl)}</span>);
}

/* the room's picks, for a list of teams */
export const useMascotPicks = () => useContext(Picks);
/* a mascot that waits (thinking) and takes its mood at a set time after it comes up: at a reveal, when its team's stamp
   lands */
export function MascotAt({ kind, color, mood, at, size, delay }: { kind: number; color: string; mood: Mood; at: number; size: number; delay?: number }) {
  const [now, setNow] = useState<Mood>("think");
  useEffect(() => { setNow("think"); const t = window.setTimeout(() => setNow(mood), at * 1000); return () => clearTimeout(t); }, [mood, at]);
  return <Mascot kind={kind} color={color} mood={now} size={size} delay={delay} />;
}

/* the captain's phone, in the lobby: the team's mascot, eight to tap (the one picked hops, with a tick) */
export function MascotPick({ value, color, busy, onPick, taken }: { value: number; color: string; busy?: boolean; onPick: (k: number) => void; taken?: Set<number> }) {
  return (<>
    <div className="field-label !mb-0">Pick your team&rsquo;s mascot</div>
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Your team’s mascot">
      {Array.from({ length: MASCOT_COUNT }, (_, k) => { const on = value === k, gone = !on && !!taken?.has(k); return (
        <button key={k} type="button" className={"msc-pick" + (gone ? " taken" : "")} aria-pressed={on} aria-label={gone ? `Mascot ${k + 1}, taken` : `Mascot ${k + 1}`} disabled={busy || gone} onClick={() => onPick(k)}>
          <Mascot kind={k} color={color} mood={on ? "sent" : "idle"} size={46} delay={k * 0.3} key={on ? "on" : "off"} /></button>); })}
    </div>
  </>);
}

/* a team's mascot wearing its team's letter (the lobby's boxes, the phones' team buttons) */
export function MascotLetter({ kind, color, letter, size, delay }: { kind: number; color: string; letter: string; size: number; delay?: number }) {
  return (<span className="msc-letter" style={{ width: size }}><Mascot kind={kind} color={color} size={size} delay={delay} />
    <span className="ml" style={{ background: color, fontSize: Math.max(9, Math.round(size * 0.3)) }}>{letter}</span></span>);
}
