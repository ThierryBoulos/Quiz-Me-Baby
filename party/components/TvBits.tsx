"use client";
/* TV pieces every setup uses, one copy each (27 Nov, the merge): the winner at the night's end, the award cards under
   the night's chart, and the Paused cover. */
import type { CSSProperties, ReactNode } from "react";
import { Confetti } from "./GameParts";
import { WinName } from "./Motion";

/* a delay after the beat, for the pieces of a reveal that land one after another */
export const d = (s: number) => ({ ["--d" as string]: s + "s" }) as CSSProperties;

/* the winner: "The winner", a beat, then the name slams down with a flash and a shockwave, and the confetti bursts.
   eyebrow: over it ("The winner", "Tied at the top"); tag: on the sign; label: the name read out; lift: drawn over the
   standings (3 to 8 teams) */
export function WinSign({ color, eyebrow, tag, label, recap, lift, children }: { color: string; eyebrow: string; tag: string; label: string; recap: boolean; lift?: boolean; children: ReactNode }) {
  const z = lift ? " relative z-10" : "";
  return (<>
    <div className="win-flash" style={{ ["--c" as string]: color }} aria-hidden />
    <div className="confetti-late"><Confetti n={140} /></div>
    <div className={"eyebrow text-22 enter" + z + " win-eyebrow"}>{eyebrow}</div>
    <div className={"win-sign" + (lift ? z : " relative") + " grid place-items-center"}>
      <span className="win-tag" aria-hidden>{tag}</span>
      <span className="win-ring" style={{ ["--c" as string]: color }} aria-hidden />
      <span className="win-ring r2" style={{ ["--c" as string]: color }} aria-hidden />
      <WinName recap={recap} color={color} label={label}>{children}</WinName>
    </div>
  </>);
}

export type AwardCard = { t: string; who: string; note?: string; spoon?: boolean; team?: number | null };
/* the night's award cards. rows: up to eight in two rows, every card the same size, a short last row centred (2 teams:
   the owner, 11 Nov); else one row. solid: the confetti behind them stays behind them. name: the winner's line's size */
export function AwardCards({ awards, color, rows, solid, name }: { awards: AwardCard[]; color: (team: number) => string; rows?: boolean; solid?: boolean; name: string }) {
  const A = awards, cols = rows ? (A.length <= 4 ? A.length : Math.ceil(A.length / 2)) : A.length, rem = rows ? A.length % cols : 0, last = A.length - rem;
  return (
    <div className="grid gap-3 enter w-full max-w-[1168px]" style={rows ? { gridTemplateColumns: `repeat(${cols * 2}, minmax(0, 1fr))`, gridAutoRows: "1fr", position: "relative", zIndex: 60 }
      : { gridTemplateColumns: `repeat(${A.length}, minmax(0, 1fr))`, position: "relative", zIndex: 60 }}>
      {A.map((a, i) => (
        <div key={a.t} className="card !p-2 !px-3 text-left min-w-0" style={{ ...(rows ? { gridColumn: rem && i === last ? `${cols - rem + 1} / span 2` : "span 2" } : {}),
          borderColor: a.team != null ? color(a.team) : undefined, ...(solid ? { background: "linear-gradient(180deg, #151a3c, #0c1028)" } : {}) }}>
          <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>{a.spoon ? "🥄" : "🏆"} {a.t}</div>
          <div className={name + " font-bold leading-snug"} style={{ color: a.team != null ? color(a.team) : undefined }}><bdi>{a.who}</bdi></div>
          {a.note && <div className="text-18 text-[var(--color-ink-2)] italic line-clamp-2">{a.note}</div>}
        </div>))}
    </div>);
}

/* the Paused cover: the question hides until the clock restarts. who: who paused it, said first (none: the TV's own
   screen went out of sight, or nobody to name) */
export function PausedTv({ who }: { who?: ReactNode }) {
  return (<>
    <div className="display" style={{ fontSize: 140, color: "var(--color-gold)" }}>Paused</div>
    <div className="text-26 text-[var(--color-ink-2)] mt-2">{who}The question comes back when the clock restarts.</div>
  </>);
}
