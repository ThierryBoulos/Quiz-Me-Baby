"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Lineup } from "@/components/Lineup";
import { CaptainGame, HostGame, PlayerGame, useSecret } from "@/components/PhoneGame";
import { Setup } from "@/components/Setup";
import type { Pub } from "@/lib/game";
import { ensureSession, rpc, sb, sendAction } from "@/lib/supabase";
import { notReadyWhy, readyToStart, starter, teamName, useRoom, type Member } from "@/lib/room";

/* THE PHONE. In the lobby: pick a side, take the captaincy (one per team),
   name the team, or be the host. The colour of your team fills the screen. */
export default function PhoneRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { room, members, missing, refresh } = useRoom(code);
  const [me, setMe] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState(false);          // mid-game: the line-up, and changing captain
  /* Between a tap and the TV's reply (a second or two): a bar along the top,
     and the buttons stay off, so nobody taps twice wondering if it worked. */
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { setWaiting(true); clearTimeout(t); t = setTimeout(() => setWaiting(false), 4000); };
    window.addEventListener("qmb:sent", on);
    return () => { window.removeEventListener("qmb:sent", on); clearTimeout(t); };
  }, []);

  useEffect(() => { void ensureSession().then(setMe); }, []);
  const mine = useMemo(() => members.find((m) => m.user_id === me) || null, [members, me]);

  /* not in this room (yet): to the join screen with the code filled in */
  useEffect(() => {
    if (missing) router.replace("/join?code=" + code);
    else if (room && me && members.length && !mine) router.replace("/join?code=" + code);
  }, [missing, room, me, members.length, mine, code, router]);

  const host = members.find((m) => m.role === "host") || null;
  const side = mine?.team === 0 ? "a" : mine?.team === 1 ? "b" : null;
  useEffect(() => { document.documentElement.style.setProperty("--tint", side ? `var(--color-${side})` : "var(--color-gold)"); }, [side]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (typeof r === "string" && r !== "ok") setMsg(r); await refresh(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  const pickTeam = (t: 0 | 1 | null) => act(() => rpc<string>("qmb_update_me", { r: code, nm: mine?.name ?? "", tm: t }));
  const claim = (want: "captain" | "host" | "player") => act(() => rpc<string>("qmb_claim", { r: code, want }));
  const move = (m: Member, to: 0 | 1) => act(async () => {
    const { error } = await sb().from("members").update({ team: to, role: "player" }).eq("room", code).eq("user_id", m.user_id);
    if (error) throw new Error(error.message);
  });
  const leave = () => (room?.status === "lobby" || window.confirm("Leave the game? You can come back with the same name.")) && act(async () => { await sb().from("members").delete().eq("room", code).eq("user_id", me!); router.replace("/"); });

  /* the TV's reply has landed: whatever changed in the room */
  useEffect(() => { setWaiting(false); }, [room]);
  const playing = room?.status === "playing" || room?.status === "done";
  const pub = (room?.state?.pub || null) as Pub | null;
  const secret = useSecret(code, !!mine && mine.role === "host" && playing);
  const sendMove = (move: Record<string, unknown>) => act(() => sendAction(code, "judge", { move, step: pub?.step }));

  if (!room || !mine) return <main className="screen justify-center items-center gap-4" aria-busy="true"><div className="spinner" /><div className="eyebrow">Finding your seat…</div></main>;

  const myCaptain = mine.team != null ? members.find((m) => m.team === mine.team && m.role === "captain") : null;
  const who = starter(members);
  const canStart = who?.user_id === me;
  const ready = readyToStart(members);

  return (
    <main className="screen">
      {waiting && <div className="sending" role="progressbar" aria-label="Sending to the TV" />}
      <header className="flex items-center justify-between">
        <span className="chip"><span className="face">{mine.avatar || "🙂"}</span>{mine.name}</span>
        <span className="eyebrow whitespace-nowrap">{room.status === "lobby" ? `Room ${code}` : code}</span>
        <div className="flex gap-2">
          {room.status !== "lobby"
            ? <button className="btn btn-sm btn-ghost" aria-expanded={panel} onClick={() => setPanel(!panel)}>{panel ? "Back" : mine.role === "host" ? "Players" : "Team"}</button>
            : <button className="btn btn-sm btn-ghost" onClick={leave} aria-label="Leave the room">Leave</button>}
        </div>
      </header>

      {room.status !== "lobby" ? (
        /* joined after the start: pick a side first */
        mine.team == null && mine.role !== "host" ? (
          <section className="flex flex-col gap-3 enter">
            <h1 className="display text-[40px] text-center">Pick your side</h1>
            <p className="text-center text-[14px] text-[var(--color-ink-2)]">The game&rsquo;s on. Join a team and help your captain.</p>
            <button className="btn btn-a btn-lg" disabled={busy} onClick={() => pickTeam(0)}>{teamName(room, 0)}</button>
            <button className="btn btn-b btn-lg" disabled={busy} onClick={() => pickTeam(1)}>{teamName(room, 1)}</button>
          </section>
        ) : panel ? (
          /* mid-game: who's where, and a new captain when one is needed */
          <section className="flex flex-col gap-3 enter">
            {mine.role === "captain" && (
              <div className="card flex flex-col gap-2">
                <div className="eyebrow" style={{ color: "var(--color-gold)" }}>You&rsquo;re the captain</div>
                <p className="text-[14px] text-[var(--color-ink-2)]">Hand over to a teammate: step down, and they tap &ldquo;Make me captain&rdquo; on their phone.</p>
                <button className="btn" disabled={busy} onClick={() => claim("player")}>Step down as captain</button>
              </div>)}
            {mine.role === "player" && !myCaptain && (
              <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => claim("captain")}>Make me captain</button>)}
            {mine.role === "player" && myCaptain && <div className="card text-center text-[14px]">{myCaptain.name} is your captain. If they step down, you can take over here.</div>}
            {mine.role === "host" && <p className="text-[14px] text-[var(--color-ink-2)]">Tap an arrow to move a player across. A moved captain becomes a player, and their team picks a new one.</p>}
            <Lineup room={room} members={members} onMove={mine.role === "host" ? move : undefined} />
            <button className="btn btn-gold btn-block" onClick={() => setPanel(false)}>Back to the game</button>
            {/* leaving is kept away from everyday buttons, and asks first */}
            <button className="btn btn-sm btn-ghost self-center mt-6" style={{ color: "var(--color-no)", borderColor: "color-mix(in srgb, var(--color-no) 45%, transparent)" }} onClick={leave}>Leave the game</button>
          </section>
        ) : !pub ? (
          <section className="card text-center enter flex-1 grid place-items-center">
            <div><div className="eyebrow">Game on</div><h1 className="display text-[44px] mt-2">Eyes on the TV</h1></div>
          </section>
        ) : mine.role === "host" ? <HostGame pub={pub} secret={secret} send={sendMove} busy={busy || waiting} />
          : mine.role === "captain" ? <CaptainGame pub={pub} me={mine} members={members} code={code} hold={waiting} />
          : <>
              {!myCaptain && <button className="btn btn-gold btn-block" disabled={busy} onClick={() => claim("captain")}>Your team has no captain. Make me captain</button>}
              <PlayerGame pub={pub} me={mine} members={members} code={code} />
            </>
      ) : mine.role === "host" ? (
        <>
          <section className="card enter text-center">
            <div className="eyebrow">You&rsquo;re the host</div>
            <h1 className="display text-[40px] mt-1" style={{ color: "var(--color-gold)" }}>Run the night</h1>
            <p className="text-[14px] text-[var(--color-ink-2)] mt-1">You&rsquo;ll see every answer. Tap an arrow to move a player across.</p>
          </section>
          <Lineup room={room} members={members} onMove={move} />
          <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => claim("player")}>Stop hosting</button>
        </>
      ) : mine.team == null ? (
        <section className="flex flex-col gap-3 enter">
          <h1 className="display text-[44px] text-center">Pick your side</h1>
          <button className="btn btn-a btn-lg" disabled={busy} onClick={() => pickTeam(0)}>{teamName(room, 0)}</button>
          <button className="btn btn-b btn-lg" disabled={busy} onClick={() => pickTeam(1)}>{teamName(room, 1)}</button>
          <div className="h-2" />
          {host
            ? <button className="btn btn-block" disabled>{host.name} is the host</button>
            : <button className="btn btn-block" disabled={busy} onClick={() => claim("host")}>I&rsquo;m the host</button>}
        </section>
      ) : (
        <section className="flex flex-col gap-3 enter">
          <div className="card text-center" style={{ borderColor: `var(--color-${side})` }}>
            <div className="eyebrow">You&rsquo;re on</div>
            <div className="display text-[48px] mt-1" style={{ color: `var(--color-${side})` }}>{teamName(room, mine.team)}</div>
          </div>
          {mine.role === "captain" ? (
            <div className="card flex flex-col gap-3">
              <div className="eyebrow" style={{ color: "var(--color-gold)" }}>You&rsquo;re the captain</div>
              <label className="field-label !mb-0" htmlFor="tname">Name your team</label>
              <div className="flex gap-2">
                <input id="tname" className="input" maxLength={18} value={draft} placeholder={teamName(room, mine.team)} onChange={(e) => setDraft(e.target.value)} />
                <button className="btn" disabled={!draft.trim() || busy} onClick={() => act(async () => { await sendAction(code, "team_name", { team: mine.team, name: draft.trim() }); setDraft(""); })}>Save</button>
              </div>
              <button className="btn btn-sm btn-ghost self-start" disabled={busy} onClick={() => claim("player")}>Step down</button>
            </div>
          ) : myCaptain ? (
            <button className="btn btn-block" disabled>{myCaptain.name} is your captain</button>
          ) : (
            <button className="btn btn-gold btn-block" disabled={busy} onClick={() => claim("captain")}>Make me captain</button>
          )}
          <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => pickTeam(mine.team === 0 ? 1 : 0)}>Switch to {teamName(room, mine.team === 0 ? 1 : 0)}</button>
        </section>
      )}

      {msg && <p className="field-error text-center">{msg}</p>}

      {room.status === "lobby" && (
        <footer className="mt-auto flex flex-col gap-2">
          {canStart ? (
            <Setup ready={ready} why={notReadyWhy(members)} busy={busy} onStart={(cfg) => act(() => sendAction(code, "setup", { start: true, cfg }))} />
          ) : (
            <p className="text-center text-[14px] text-[var(--color-ink-2)]">
              You&rsquo;re in. {who ? <><b>{who.name}</b> starts the game.</> : "The host — or Team A's captain — starts the game."}
            </p>
          )}
        </footer>
      )}
    </main>
  );
}
