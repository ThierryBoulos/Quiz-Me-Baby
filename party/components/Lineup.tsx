"use client";
import { Zzz } from "./Zzz";
import { Mascot, mascotOf } from "./Mascot";
import { MANY_COLORS } from "@/lib/many/logic";
import type { Member, Room } from "@/lib/room";
import { teamName } from "@/lib/room";
import type { ReactNode } from "react";

/* a player on a team's card in the lobby, every setup (27 Nov, the merge): the name, Captain, and "away" (asleep) for a
   captain the TV hasn't heard from. side: the 2-team look (a or b); color: a team of 3 to 8; size: the TV's (big, dense) or
   the phone's; children: the host's buttons (move, remove) */
export function PlayerChip({ m, side, color, size, away, children }: { m: Member; side?: "a" | "b"; color?: string; size: "phone" | "big" | "dense"; away: boolean; children?: ReactNode }) {
  const big = size !== "phone", dense = size === "dense";
  return (
    <span className={side ? "chip pop-in " + side : "chip team pop-in"} style={{ ...(color ? { ["--c" as string]: color } : {}), ...(big ? { fontSize: dense ? 15 : 22, padding: dense ? "6px 12px" : "8px 18px" } : {}) }}>
      {/* (no faces for players any more, 28 Nov: anyone away sleeps, our own Zzz) */}
      {away && <span className="face zzf"><Zzz size={big ? (dense ? 20 : 28) : 18} /></span>}
      <bdi>{m.name}</bdi>
      {m.role === "captain" && <span className="cap">Captain</span>}
      {m.role === "captain" && away && <span className="cap" style={{ background: "var(--color-no)" }}>away</span>}
      {children}
    </span>);
}

/* Both teams, every player, the captains marked. The host's phone and the TV
   both draw this; only the host gets the "move" arrows. */
/* away: captains the TV hasn't heard from (the lobby); onRemove: the host's "remove" (ghosts, pranksters) */
export function Lineup({ room, members, onMove, onRemove, big }: { room: Room | null; members: Member[]; onMove?: (m: Member, to: 0 | 1) => void; onRemove?: (m: Member) => void; big?: boolean }) {
  const away = ((room?.state?.away as string[] | undefined) || []);
  return (
    <div className={big ? "grid grid-cols-2 gap-8" : "grid grid-cols-1 gap-3"}>
      {[0, 1].map((t) => {
        const side = t === 0 ? "a" : "b";
        const list = members.filter((m) => m.team === t).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0));
        return (
          <div key={t} className="card" style={{ borderColor: `color-mix(in srgb, var(--color-${side}) 45%, transparent)` }}>
            <div className="flex items-baseline justify-between mb-3">
              <div className="display flex items-center gap-2" style={{ color: `var(--color-${side})`, fontSize: big ? 44 : 24 }}><Mascot kind={mascotOf(room?.state?.teamMascots, t)} color={MANY_COLORS[t]} size={big ? 52 : 30} delay={t * 0.6} />{teamName(room, t as 0 | 1)}</div>
              <div className="eyebrow">{list.length} {list.length === 1 ? "player" : "players"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {list.length === 0 && <span className="text-[var(--color-ink-3)]" style={{ fontSize: big ? 22 : 14 }}>Nobody yet</span>}
              {list.map((m) => (
                <PlayerChip key={m.user_id} m={m} side={side} size={big ? "big" : "phone"} away={room?.status === "lobby" && away.includes(m.user_id)}>
                  {onMove && (
                    <button className="ml-1 -mr-1 w-11 h-11 -my-2 grid place-items-center rounded-full text-[var(--color-ink-2)] active:bg-white/10" aria-label={`Move ${m.name} to ${teamName(room, t === 0 ? 1 : 0)}`} onClick={() => onMove(m, t === 0 ? 1 : 0)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: t === 0 ? undefined : "scaleX(-1)" }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </button>)}
                  {onRemove && (
                    <button className="-mr-1 w-11 h-11 -my-2 grid place-items-center rounded-full text-[var(--color-ink-3)] active:bg-white/10" aria-label={`Remove ${m.name}`} onClick={() => onRemove(m)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>)}
                </PlayerChip>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
