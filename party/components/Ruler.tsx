"use client";
/* Closest To Wins: the ruler, for two teams or for eight. The answer's gold marker in the middle; a guess under
   the answer sits to its left, over it to its right, the farthest one near the end. Each guess is a dot on the
   track with a card on a lane above or below it, joined by a line; then a band in the team's colour runs from the
   answer out to the dot: the longer the band, the further off. A team that sent nothing sits on the line too,
   at the far right end, past the last tick ("off the scale"), side by side when there are several: a hollow dot and a card that says No answer.
   Two teams: A's card above, B's below, as the two-team TV always drew it. More: the cards are packed on two
   lanes a side, as near their dot as the others let them, a size smaller, and the dots carry the team's letter. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { offBy, showNum } from "@/lib/game";

export type RulerTeam = { name: string; color: string; letter?: string; guess: number | null; win: boolean };
const d = (s: number) => ({ ["--d" as string]: s + "s" });
const GAP = 10;

export function Ruler({ teams, ans, width }: { teams: RulerTeam[]; ans: number; width?: number }) {
  const two = teams.length <= 2, W = width ?? (two ? 1040 : 1120);
  /* the scale: the farthest guess sits 42% (two teams) or 40% out from the middle; no answer at 97% */
  const far = Math.max(0, ...teams.map((t) => (t.guess == null ? 0 : Math.abs(t.guess - ans))));
  /* no answer: the hatched end of the track, wide enough for each of them side by side; the scale stops short of it */
  const nones = teams.map((t, i) => (t.guess == null ? i : -1)).filter((i) => i >= 0), none = nones.length > 0;
  const zone = Math.max(W * 0.06, nones.length * 16 + 22);
  const span = Math.min(two ? 42 : 40, ((W / 2 - zone - 24) / W) * 100);
  const xOf = (t: RulerTeam) => {
    if (t.guess == null) { const j = nones.indexOf(teams.indexOf(t)); return W - zone / 2 + (j - (nones.length - 1) / 2) * 16; }
    return (W * (!far ? 50 : 50 + ((t.guess - ans) / far) * span)) / 100;
  };
  /* the order they drop in: the farthest first, the nearest last; no answer before them all */
  const order = useMemo(() => teams.map((_, i) => i).sort((a, b) => {
    const da = teams[a].guess == null ? Infinity : Math.abs(teams[a].guess! - ans), db = teams[b].guess == null ? Infinity : Math.abs(teams[b].guess! - ans);
    return db - da || a - b; }), [teams, ans]);
  const drop = (i: number) => order.indexOf(i);

  /* the cards are measured, then packed (before the first paint, so nothing jumps) */
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [box, setBox] = useState<{ w: number[]; h: number }>({ w: teams.map(() => two ? 300 : 210), h: two ? 54 : 40 });
  const sig = teams.map((t) => `${t.name}|${t.guess}|${t.win}`).join(",");
  useLayoutEffect(() => {
    const w = teams.map((_, i) => refs.current[i]?.offsetWidth || 210), h = Math.max(...teams.map((_, i) => refs.current[i]?.offsetHeight || 40));
    setBox((b) => (b.h === h && b.w.join() === w.join() ? b : { w, h }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, W]);

  const CH = box.h, G = two ? 42 : 36;
  const lay = useMemo(() => {
    /* lanes: 0 above, 1 below (and with more teams 2 above that, 3 below that) */
    const place = (lanes: number) => {
      const right = Array(lanes).fill(-Infinity), at: { x: number; lane: number }[] = teams.map(() => ({ x: 0, lane: 0 }));
      let worst = 0;
      const byX = teams.map((_, i) => i).sort((a, b) => xOf(teams[a]) - xOf(teams[b]) || a - b);
      for (const i of byX) {
        const w = box.w[i], want = Math.min(Math.max(xOf(teams[i]) - w / 2, 0), W - w);
        let best = 0, cost = Infinity, bx = want;
        for (let l = 0; l < lanes; l++) {
          if (two && l !== i) continue;   /* two teams: A above, B below, always */
          const x = Math.max(want, right[l] + GAP), c = x - want + (x + w > W ? 1e6 : 0) + (l >= 2 ? 24 : 0);
          if (c < cost) { cost = c; best = l; bx = x; }
        }
        at[i] = { x: bx, lane: best }; right[best] = bx + w; worst = Math.max(worst, bx - want);
      }
      /* anything pushed past the right end comes back, pushing its neighbours on that lane back too */
      for (let l = 0; l < lanes; l++) {
        let lim = W;
        for (const i of byX.filter((j) => at[j].lane === l).reverse()) { if (at[i].x + box.w[i] > lim) at[i].x = lim - box.w[i]; lim = at[i].x - GAP; }
      }
      return { at, worst };
    };
    if (two) return { ...place(2), lanes: 2 };
    const one = place(2);
    return one.worst <= 60 ? { ...one, lanes: 2 } : { ...place(4), lanes: 4 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, box, W]);

  const deep = lay.lanes > 2;
  const top = (two ? 8 : 4) + (deep ? CH + GAP : 0);              /* where lane 0's card starts */
  const TY = top + CH + G;                                           /* the track's middle */
  const H = TY * 2;
  const th = two ? 14 : 8 + 3 * teams.length;                       /* the track: thicker with a band for each */
  const cardTop = (lane: number) => (lane === 0 ? TY - G - CH : lane === 1 ? TY + G : lane === 2 ? TY - G - 2 * CH - GAP : TY + G + CH + GAP);
  const bandTop = (i: number) => (two ? TY - th / 2 + i * 7 : TY - th / 2 + 4 + i * 3);
  const bandH = two ? 7 : 3;

  return (
    <div className="ruler relative" style={{ width: W, height: H, ["--beat" as string]: ".15s" }} aria-label={`The answer, ${showNum(ans)}: ` + teams.map((t) => `${t.name} ${t.guess == null ? "no answer" : showNum(t.guess)}`).join(", ")}>
      <div className="ruler-track" style={{ top: TY - th / 2, height: th, borderRadius: th / 2 }}><span className="ruler-ticks" style={none ? { right: zone } : undefined} /></div>
      {none && <div className="ruler-off" style={{ top: TY - th / 2, height: th, width: zone }} aria-hidden />}
      {teams.map((t, i) => { if (t.guess == null) return null; const x = xOf(t), mid = W / 2; return (
        <div key={"b" + i} className="ruler-band" style={{ top: bandTop(i), height: bandH, left: Math.min(x, mid), width: Math.abs(x - mid), background: t.color, transformOrigin: x < mid ? "right" : "left", ...d(0.5 + drop(i) * (two ? 0.12 : 0.07)) }} />); })}
      <div className="ruler-mid" style={{ top: TY - th / 2 - 14, height: th + 28 }}>{two && <span className="lbl" style={{ top: th + 34 }}>answer</span>}</div>
      {teams.map((t, i) => {
        const x = xOf(t), a = lay.at[i], w = box.w[i], ct = cardTop(a.lane), up = a.lane % 2 === 0;
        const lx = Math.min(Math.max(x, a.x + 16), a.x + w - 16), ly = up ? ct + CH : ct, dy = up ? TY - 12 : TY + 12;
        const off = t.guess == null ? null : offBy(t.guess, ans);
        return (
          <div key={i} className={"ruler-grp" + (t.win ? " win" : "") + (t.guess == null ? " none" : "")} style={{ ["--c" as string]: t.color, ["--drop" as string]: up ? "-36px" : "36px", ...d(0.12 + drop(i) * (two ? 0.14 : 0.1)) }}>
            <svg className="absolute inset-0 pointer-events-none" width={W} height={H} aria-hidden><line x1={x} y1={dy} x2={lx} y2={ly} stroke={t.color} strokeWidth={2} strokeOpacity={0.8} strokeDasharray={t.guess == null ? "4 4" : undefined} /></svg>
            <span className="ruler-dot" style={{ left: x - 12, top: TY - 12 }}>{!two && t.letter}</span>
            <div ref={(el) => { refs.current[i] = el; }} className={"card-l " + (two ? "" : "sm")} style={{ left: a.x, top: ct }}>
              <span className="nm" style={{ color: t.color }}><bdi>{t.name}</bdi></span>
              {/* who takes it, at a glance, however bunched the cards are */}
              {t.win && <span className="trophy" role="img" aria-label="takes it">🏆</span>}
              {t.guess == null ? <span className="off">no answer</span> : <><span className="v display">{showNum(t.guess)}</span><span className="off">{off === 0 ? "spot on!" : "off by " + showNum(off!)}</span></>}
            </div>
          </div>); })}
    </div>);
}
