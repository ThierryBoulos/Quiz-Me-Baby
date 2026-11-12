"use client";
/* What Do You See? on screen (12 Nov, the owner): the picture that clears as the clock runs, for the TV and the
   phones, two teams or eight. A face or a logo starts blurred and sharpens; a close-up starts zoomed right in on one
   spot and pulls back to the whole picture. In steps (lib/see.ts), each easing into the next, worked out from the
   TV's clock, so every screen shows the same step at the same moment; with animations off in Settings, 5 plain steps
   and no easing (the picture still clears: it is the game). The blur is a share of the picture's width, so a phone
   and the TV look the same. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Clock, tvNow } from "./Clock";
import { motionOff } from "./Marquee";
import { seeBlur, seeGone, seeSecs, seeStep, seeZoom, type SePub } from "@/lib/see";

export type SeeTeam = { name: string; color: string; letter: string };
const OK = "var(--color-ok)", NO = "var(--color-no)";

/* the picture itself, 4:3, w wide at most (it shrinks to fit a narrower column). clear: the whole picture, sharp */
export function SeePicture({ see, deadline, left, clear, w, big, alt }: { see: SePub; deadline?: number | null; left?: number; clear?: boolean; w: number; big?: boolean; alt?: string }) {
  const still = motionOff();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(w);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || w));
    ro.observe(el); return () => ro.disconnect();
  }, [w]);
  /* the step from the TV's clock: looked at five times a second, drawn again only when the step changes */
  const [now, setNow] = useState(() => tvNow());
  useEffect(() => {
    if (clear || !deadline) return;
    setNow(tvNow());
    const t = setInterval(() => setNow(tvNow()), 200);
    return () => clearInterval(t);
  }, [deadline, clear]);
  const q = clear ? 1 : seeStep(seeGone(see.total, deadline, left, now), see.total, still);
  let style: CSSProperties;
  if (see.effect === "zoom") {
    const { z, x, y } = seeZoom(q, see.zoom);
    style = { transformOrigin: "0 0", transform: `scale(${z.toFixed(4)}) translate(${(-x * 100).toFixed(3)}%, ${(-y * 100).toFixed(3)}%)` };
  } else {
    const { b, grow } = seeBlur(q, see.kind);
    style = { filter: b > 0.0004 ? `blur(${(b * width).toFixed(1)}px)` : "none", transform: `scale(${grow.toFixed(4)})` };
  }
  return (
    <div ref={ref} className={"see-frame" + (see.kind === "logo" ? " logo" : "") + (still ? " still" : "") + (clear ? " clear" : "")} style={{ width: `min(100%, ${w}px)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/see/${see.photo}${big ? "" : "-s"}.jpg`} alt={clear && alt ? alt : "The picture"} draggable={false} style={style} />
    </div>);
}

/* the credit, under the clear picture (each licence asks for it) */
export const SeeCredit = ({ see, size = 13 }: { see: SePub; size?: number }) => see.rev ? (
  <div className="see-credit" style={{ fontSize: size }}>Picture: <bdi>{see.rev.credit}</bdi> · {see.rev.licence} · Wikimedia Commons</div>) : null;

/* the line under the answer: who took it, and how fast */
/* right: how many teams got it (3 to 8: the fastest is named, "first" when others got it too) */
export function seeWho(see: SePub, teams: SeeTeam[], right?: number): { text: string; color: string } {
  const r = see.rev;
  if (!r || r.who == null) return { text: "Nobody got it", color: "var(--color-ink-2)" };
  return { text: `${teams[r.who]?.name ?? ""} got it ${(right ?? 0) > 1 ? "first, " : ""}in ${seeSecs(r.ms)}`, color: teams[r.who]?.color ?? "var(--color-gold)" };
}

/* every team's state while the picture clears: thinking, buzzed (it has its 10 seconds), or out of this picture (a
   wrong answer, or none in time: everyone heard it) */
export function SeeTicks({ teams, out, buzz, size = 22, column }: { teams: SeeTeam[]; out?: boolean[]; buzz?: number | null; size?: number; column?: boolean }) {
  const many = teams.length > 2;
  return (
    <div className={"flex flex-wrap justify-center " + (column ? "flex-col items-center gap-1" : many ? "gap-x-5 gap-y-2" : "gap-x-10 gap-y-2")} role="status" aria-live="polite">
      {teams.map((t, i) => (
        <span key={i} className="flex items-center gap-2 font-bold" style={{ fontSize: size }}>
          <span className="dot ltr shrink-0" aria-hidden style={{ background: t.color, width: size * 1.25, height: size * 1.25, fontSize: size * 0.7 }}>{t.letter}</span>
          {!many && <bdi style={{ color: t.color }}>{t.name}</bdi>}
          <span style={{ color: out?.[i] ? NO : buzz === i ? OK : "var(--color-ink-3)" }}>{out?.[i] ? "✗ out" : buzz === i ? "buzzed!" : many ? "…" : "thinking…"}</span>
        </span>))}
    </div>);
}

/* what the team that buzzed does now (the TV says it to the room): whoever hit BUZZ says it, the captain types it */
export const SeeSay = ({ see }: { see: SePub }) => (
  <div className="text-24 font-bold leading-snug text-balance">{see.by ? <><bdi>{see.by}</bdi> buzzed. </> : null}Say it out loud! Captain, type it!</div>);

/* ---- the TV, two teams ---- */
export function SeeTv({ see, screen, teams, clock, deadline, left, rows }: {
  see: SePub; screen: "seeQ" | "seeReveal"; teams: SeeTeam[]; clock?: ReactNode; deadline?: number | null; left?: number; rows?: ReactNode }) {
  /* (12 Nov, the owner: a buzzer. A buzz stops the picture where it is; the team that buzzed says it out loud and
     types it, with its own 10 seconds on the clock) */
  if (screen === "seeQ") { const b = see.buzz != null ? teams[see.buzz] : null; return (
    <div className="flex gap-12 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex justify-center"><SeePicture see={see} deadline={deadline} left={left} w={720} big /></div>
      <div className="w-[360px] shrink-0 flex flex-col items-center gap-5">
        {b ? (<>
          <div className="display text-44 leading-tight text-balance" role="status" style={{ color: b.color }}><bdi>{b.name}</bdi> buzzed!</div>
          {see.typeBy ? <Clock deadline={see.typeBy} size={130} /> : clock}
          <SeeSay see={see} />
        </>) : (<>
          <div className="display text-44 leading-tight" style={{ color: "var(--color-gold)" }}>What do you see?</div>
          {clock}
          <div className="text-24 font-bold leading-snug">Know it? Buzz!</div>
        </>)}
        <SeeTicks teams={teams} out={see.out} buzz={see.buzz} column />
        <div className="text-20 text-[var(--color-ink-2)] leading-snug text-balance">{b ? "Wrong, and you’re out of this picture." : "Buzz, say it out loud and type it. Wrong, and you’re out of this picture."}</div>
      </div>
    </div>); }
  const who = seeWho(see, teams), A = see.rev?.answer || "";
  return (
    <div className="flex gap-12 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <SeePicture see={see} clear w={620} big alt={A} />
        <SeeCredit see={see} size={14} />
      </div>
      <div className="w-[440px] shrink-0 flex flex-col items-center gap-4">
        <div className="eyebrow text-18">It&rsquo;s</div>
        <div className="ans-board display beat slam leading-none" style={{ fontSize: A.length > 22 ? 44 : A.length > 14 ? 56 : 70, color: "var(--color-gold)" }}>{A}</div>
        {rows}
        <div className="display text-36 beat" style={{ color: who.color }}>{who.text}</div>
      </div>
    </div>);
}
