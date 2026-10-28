"use client";
import type { Member, Room } from "@/lib/room";
import { teamName } from "@/lib/room";

/* Both teams, every face, the captains marked. The host's phone and the TV
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
              <div className="display" style={{ color: `var(--color-${side})`, fontSize: big ? 44 : 24 }}>{teamName(room, t as 0 | 1)}</div>
              <div className="eyebrow">{list.length} {list.length === 1 ? "player" : "players"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {list.length === 0 && <span className="text-[var(--color-ink-3)]" style={{ fontSize: big ? 22 : 14 }}>Nobody yet</span>}
              {list.map((m) => (
                <span key={m.user_id} className={"chip pop-in " + side} style={big ? { fontSize: 22, padding: "8px 18px 8px 8px" } : undefined}>
                  <span className="face" style={big ? { width: 44, height: 44, fontSize: 28 } : undefined}>{m.avatar || "🙂"}</span>
                  {m.name}
                  {m.role === "captain" && <span className="cap">Captain</span>}
                  {m.role === "captain" && room?.status === "lobby" && away.includes(m.user_id) && <span className="cap" style={{ background: "var(--color-no)" }}>away</span>}
                  {onMove && (
                    <button className="ml-1 -mr-1 w-11 h-11 -my-2 grid place-items-center rounded-full text-[var(--color-ink-2)] active:bg-white/10" aria-label={`Move ${m.name} to ${teamName(room, t === 0 ? 1 : 0)}`} onClick={() => onMove(m, t === 0 ? 1 : 0)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: t === 0 ? undefined : "scaleX(-1)" }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </button>)}
                  {onRemove && (
                    <button className="-mr-1 w-11 h-11 -my-2 grid place-items-center rounded-full text-[var(--color-ink-3)] active:bg-white/10" aria-label={`Remove ${m.name}`} onClick={() => onRemove(m)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
