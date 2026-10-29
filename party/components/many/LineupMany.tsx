"use client";
/* MANY TEAMS: the lobby's line-up, N columns (4 per row), each in its colour, with its captain. */
import type { Member, Room } from "@/lib/room";
import { useState } from "react";
import { LETTERS, MANY_COLORS, MANY_MINIS, MANY_TITLES } from "@/lib/many/logic";
import { manyNames } from "@/lib/many/useTvMany";

export function LineupMany({ room, members, k, big }: { room: Room; members: Member[]; k: number; big?: boolean }) {
  const names = manyNames(room, k);
  return (
    <div className={"grid gap-3 " + (big ? "grid-cols-4" : "grid-cols-2")}>
      {names.map((name, t) => {
        const team = members.filter((m) => (m.team as number) === t), cap = team.find((m) => m.role === "captain");
        return (
          <div key={t} className="team-card !p-3" style={{ borderColor: MANY_COLORS[t] }}>
            <div className="flex items-center gap-2"><span className="inline-grid place-items-center rounded-full font-bold" style={{ background: MANY_COLORS[t], color: "#04050e", width: 26, height: 26, fontSize: 14 }}>{LETTERS[t]}</span>
              <b className={"truncate " + (big ? "text-22" : "text-16")} style={{ color: MANY_COLORS[t] }}>{name}</b><span className="ml-auto text-13 text-[var(--color-ink-3)]">{team.length}</span></div>
            <div className={"flex flex-wrap gap-1.5 " + (big ? "text-16" : "text-13")}>
              {team.map((m) => <span key={m.user_id} className="chip !py-1 !px-2"><span className="face">{m.avatar || "🙂"}</span><bdi>{m.name}</bdi>{m === cap && <b className="text-11 ml-1" style={{ color: "var(--color-gold)" }}>CAPTAIN</b>}</span>)}
              {!cap && <span className="text-13 text-[var(--color-no)]">needs a captain</span>}
            </div>
          </div>);
      })}
    </div>);
}

/* the phone's team buttons when there are more than two */
export function PickMany({ room, k, busy, pick, current }: { room: Room; k: number; busy: boolean; pick: (t: number | null) => void; current?: number | null }) {
  const names = manyNames(room, k);
  return (
    <div className="grid grid-cols-2 gap-2">
      {names.map((name, t) => (
        <button key={t} className="btn btn-lg truncate" disabled={busy || current === t} onClick={() => pick(t)}
          style={{ borderColor: MANY_COLORS[t], color: MANY_COLORS[t], background: current === t ? `color-mix(in srgb, ${MANY_COLORS[t]} 18%, transparent)` : undefined }}>{LETTERS[t]} · {name}</button>))}
    </div>);
}

/* the host's setup when there are more than two teams: the four games, on or off */
export function SetupMany({ busy, why, onStart }: { busy: boolean; why: string; onStart: (cfg: { minis: string[] }) => void }) {
  return <SetupManyInner busy={busy} why={why} onStart={onStart} />;
}
function SetupManyInner({ busy, why, onStart }: { busy: boolean; why: string; onStart: (cfg: { minis: string[] }) => void }) {
  const [on, setOn] = useState<string[]>([...MANY_MINIS]);
  const flip = (k: string) => setOn((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...MANY_MINIS.filter((y) => x.includes(y) || y === k)]));
  return (
    <div className="card flex flex-col gap-3">
      <div className="display text-26">Tonight&rsquo;s games</div>
      <p className="text-13 text-[var(--color-ink-2)]">More than two teams: mini-games only, all at once, the app checks the answers. The winner of each takes 2 points.</p>
      {MANY_MINIS.map((k) => (
        <label key={k} className="flex items-center justify-between gap-3 min-h-[44px]">
          <span className="font-bold">{MANY_TITLES[k]}</span>
          <input type="checkbox" className="w-6 h-6" checked={on.includes(k)} onChange={() => flip(k)} />
        </label>))}
      <button className="btn btn-gold btn-lg btn-block" disabled={busy || !!why || !on.length} onClick={() => onStart({ minis: on })}>Start the game</button>
      {why && <p className="text-13 text-center text-[var(--color-ink-2)]">{why}</p>}
    </div>);
}
