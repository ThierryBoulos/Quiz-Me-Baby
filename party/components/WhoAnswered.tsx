"use client";
/* The host's card while a question is on: a count, then each team ticked green as it locks in (the owner, 31 Oct).
   One card for every setup (22 Nov, the owner): with 2 teams, under each team, what its captain has typed. */
import type { ReactNode } from "react";

export type WhoRow = { key: number; name: string; color: string; dot: ReactNode; lit: boolean; status: ReactNode; statusColor: string; typed?: ReactNode };

export function WhoAnswered({ head, rows, oneCol }: { head: ReactNode; rows: WhoRow[]; oneCol?: boolean }) {
  return (
    <div className="card !py-2 flex flex-col gap-1.5" role="status" aria-label="Who has answered">
      <p className="text-center text-14 font-bold">{head}</p>
      <div className={"who-grid grid gap-x-3 gap-y-1 " + (oneCol ? "grid-cols-1" : "grid-cols-2")}>
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col min-w-0">
            <span className="flex items-center gap-2 min-w-0 text-14 font-bold" style={{ color: r.lit ? r.color : "var(--color-ink-3)" }}>
              {r.dot}<span className="truncate flex-1"><bdi>{r.name}</bdi></span>
              <span className="shrink-0 font-bold" style={{ color: r.statusColor }}>{r.status}</span>
            </span>
            {r.typed}
          </div>))}
      </div>
    </div>);
}
