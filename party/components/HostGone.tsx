"use client";
import { useSecondsLeft } from "./Clock";

/* The host gone quiet mid-game (8 Nov, the owner). With 3-8 teams only the host moves the night on, so every phone says
   the night is waiting; with two teams the captains carry it meanwhile, and the teams sheet says so. Either way: the
   host can come back (open the game again, or join again with the same name), and 90 s after they were last heard
   anyone in the room can take over as the host (the server checks the same wait: qmb_claim). info.openAt is TV time. */
export function HostGone({ info, many, onClaim, busy, onTeam }: {
  info: { name: string | null; openAt: number }; many: boolean; onClaim: () => void; busy: boolean; onTeam: boolean }) {
  const left = useSecondsLeft(info.openAt), who = info.name;
  return (
    <div className="card flex flex-col gap-2 text-center enter" role="alert" style={{ borderColor: "rgba(245,197,24,.6)", background: "rgba(245,197,24,.06)" }}>
      <div className="display text-26 leading-tight" style={{ color: "var(--color-gold)" }}>{many ? "The night is waiting for a host" : "The host has gone quiet"}</div>
      <p className="text-14 text-[var(--color-ink-2)]">
        {who ? <><bdi>{who}</bdi>&rsquo;s phone has gone quiet. </> : "The night has no host. "}
        {many ? "With three teams or more, only the host can move the night on." : "The captains carry the night meanwhile, and the app checks the answers."}</p>
      {who && <p className="text-13 text-[var(--color-ink-3)]"><bdi>{who}</bdi>: open the game again, or join again with the same name.</p>}
      {left > 0 ? <p className="text-14 font-bold" role="status">Not coming back? In {left} s, anyone here can take over as the host.</p> : (<>
        <button className="btn btn-gold btn-block" disabled={busy} onClick={onClaim}>Be the host</button>
        <p className="text-12 text-[var(--color-ink-3)]">You&rsquo;ll see every answer and run the night{onTeam ? ", and you leave your team" : ""}.</p>
      </>)}
    </div>);
}
