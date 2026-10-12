"use client";
import type { Member, Room } from "@/lib/room";
import { teamName } from "@/lib/room";

/* Both teams, every face, the captains marked. The host's phone and the TV
   both draw this; only the host gets the "move" arrows. */
export function Lineup({ room, members, onMove, big }: { room: Room | null; members: Member[]; onMove?: (m: Member, to: 0 | 1) => void; big?: boolean }) {
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
                <span key={m.user_id} className={"chip " + side} style={big ? { fontSize: 22, padding: "8px 18px 8px 8px" } : undefined}>
                  <span className="face" style={big ? { width: 44, height: 44, fontSize: 28 } : undefined}>{m.avatar || "🙂"}</span>
                  {m.name}
                  {m.role === "captain" && <span className="cap">Captain</span>}
                  {onMove && <button className="ml-1 text-[var(--color-ink-3)]" aria-label={"Move " + m.name} onClick={() => onMove(m, t === 0 ? 1 : 0)}>{t === 0 ? "→" : "←"}</button>}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
