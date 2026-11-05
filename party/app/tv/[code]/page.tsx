"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePreload } from "@/components/GameParts";
import { ShareButton } from "@/components/Share";
import { TvGame } from "@/components/TvGame";
import { TvStage } from "@/components/TvStage";
import { useTvGame } from "@/lib/tvGame";
import { ensureSession } from "@/lib/supabase";
import { notReadyWhy, readyToStart, starter, useRoom } from "@/lib/room";
import { thinLine, type Pub } from "@/lib/game";
import { Snd } from "@/lib/sound";
import { useWakeLock } from "@/lib/wakeLock";
import { useTabLock } from "@/lib/tabLock";
import { sb } from "@/lib/supabase";
import { useFreshBuild } from "@/lib/fresh";
import { ANSWERING } from "@/components/PhoneGame";
import { TvLobby } from "@/components/LobbyTv";
import { TvMany } from "@/components/many/TvMany";
import { manyNotReady, teamCountOf, useTvMany } from "@/lib/many/useTvMany";
import { MANY_MAX } from "@/lib/many/logic";
import { isNoTv } from "@/components/NoTv";
import { useLiveRoom } from "@/lib/liveCount";
import type { PubMany } from "@/lib/many/view";

/* THE TV. No buttons: it shows the room and runs the night. Phones send it
   actions (a team name, "start", later buzzes and answers); the TV checks the
   sender is allowed to and writes the result back for every phone to see. */
export default function TvRoom() {
  const { code } = useParams<{ code: string }>();
  const { room, members } = useRoom(code);
  useLiveRoom(code);
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => { void ensureSession().then(setMe); setOrigin(window.location.origin); }, []);
  const owner = !!room && room.tv_id === me;
  /* this browser's TV, but only in one tab at a time */
  const lock = useTabLock(code, owner);
  const isTv = owner && lock.state === "mine";

  /* more than two teams (the lobby's Teams stepper, 3 to 8) runs its own game: the two-team one stands aside */
  const teamCount = teamCountOf(room), many = teamCount > 2 || room?.mode === "many";
  const { pub: own, exit, again, banner, lobbyNote, thin, resetPlayed } = useTvGame(code, isTv && !many, room, members);
  const M = useTvMany(code, isTv && many, room, members);
  /* the bank is getting thin: a pop-up in the lobby. "Not now" hides it until the next game */
  const [notNow, setNotNow] = useState(false);
  const status = room?.status;
  useEffect(() => { if (status && status !== "lobby") setNotNow(false); }, [status]);
  /* the lobby: someone takes a seat (their face pops into the team), with a soft pop on the TV */
  const seats = members.length, lastSeats = useRef(seats);
  useEffect(() => { if (isTv && status === "lobby" && seats > lastSeats.current) Snd.soft(); lastSeats.current = seats; }, [seats, isTv, status]);
  /* the laptop must not doze off mid-game */
  const awake = useWakeLock(isTv);
  const pub = many ? null : own || ((room?.state?.pub || null) as Pub | null);
  const pubMany = many ? (M.pub || ((room?.state?.pub as PubMany | null)?.many ? (room?.state?.pub as PubMany) : null)) : null;
  usePreload(pub);
  /* an old copy of the app (left open across a deploy) reloads between questions */
  useFreshBuild(!pub || (!ANSWERING.includes(pub.screen) && !pub.deadline && !pub.pending && !pub.lifeline), room?.status === "playing");
  /* the night is over and somebody tapped Exit: home (a moment later, so every phone hears it first) */
  useEffect(() => { if (!pub?.exit && !pubMany?.exit) return; const t = setTimeout(() => router.replace("/"), 1500); return () => clearTimeout(t); }, [pub?.exit, pubMany?.exit, router]);
  /* No TV (3 Nov): this screen hands the game to the phones. The room is marked as having no TV, and this
     browser goes to the join screen: its owner takes a seat, and their phone runs the game from there
     (app/room). Back here in the lobby (the browser's Back), it's the TV again. */
  const leaving = useRef(false);
  const [noTvErr, setNoTvErr] = useState(false);
  const goNoTv = async () => {
    if (!room || leaving.current) return;
    leaving.current = true; setNoTvErr(false);
    const { error } = await sb().from("rooms").update({ state: { ...room.state, notv: true } }).eq("code", code);
    if (error) { leaving.current = false; setNoTvErr(true); return; }
    /* a first "still here" at once, so the other phones know whose game it is while its owner takes a seat; and if
       they never do, the host's or a captain's phone can take it over after a while (the 4 Nov audit, 1.1) */
    await sb().rpc("qmb_ref_beat", { r: code, away: true }).then(() => {}, () => {});
    router.push("/join?code=" + code);
  };
  const noTvNow = room?.status === "lobby" && isNoTv(room.state);
  useEffect(() => {
    if (!isTv || !noTvNow || leaving.current || !room) return;
    const rest = { ...room.state }; delete rest.notv;
    void sb().from("rooms").update({ state: rest }).eq("code", code).then(() => {}, () => {});
  }, [isTv, noTvNow]);   // eslint-disable-line react-hooks/exhaustive-deps
  const noTvBtn = (cls: string) => <button type="button" className={cls} onClick={() => void goNoTv()}>Play without TV</button>;

  /* for the end-to-end tests: what the TV is showing */
  useEffect(() => { (window as unknown as { __qmb?: Pub | null }).__qmb = pub; }, [pub]);

  /* sound needs one tap on this screen after a refresh; any tap does it */
  const [blocked, setBlocked] = useState(false), [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    setSoundOn(Snd.on);
    const t = setInterval(() => setBlocked(Snd.on && Snd.blocked()), 1000);
    const wake = () => { Snd.resume(); setBlocked(false); };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => { clearInterval(t); window.removeEventListener("pointerdown", wake); window.removeEventListener("keydown", wake); };
  }, []);
  const SoundNote = () => blocked ? <div className="absolute left-6 bottom-6 chip" style={{ fontSize: 18, padding: "10px 20px", zIndex: 30 }}>Tap the screen to turn the sound on</div> : null;

  const joinUrl = origin + "/join?code=" + code;
  const host = members.find((m) => m.role === "host");
  const who = starter(members);

  if (!room) return <TvStage><div className="m-auto flex flex-col items-center gap-4"><div className="spinner" style={{ width: 48, height: 48, borderWidth: 5 }} /><div className="eyebrow text-20">Opening the room…</div></div></TvStage>;

  return (<>
    <TvStage>
      {/* not in the lobby: the first tap there (anywhere) turns the sound on anyway */}
      {room.status !== "lobby" && <SoundNote />}
      {/* notices for the room, stacked under the scores so they never sit on each other */}
      <div className="absolute left-1/2 top-[104px] -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none" style={{ zIndex: 30 }}>
        {banner === "offline" && <div className="chip" style={{ fontSize: 18, padding: "10px 20px", borderColor: "var(--color-no)" }} role="status">Reconnecting… the clocks wait, the phones are a step behind</div>}
        {banner === "noBank" && <div className="chip" style={{ fontSize: 18, padding: "10px 20px", borderColor: "var(--color-no)" }} role="status">Loading the questions… if this stays, check the TV&rsquo;s internet</div>}
        {banner === "cantSave" && <div className="chip" style={{ fontSize: 18, padding: "10px 20px", borderColor: "var(--color-no)" }} role="status">This browser can&rsquo;t save the game, so don&rsquo;t refresh this page</div>}
        {room.status !== "lobby" && isTv && !many && [0, 1].filter((t) => !members.some((m) => m.team === t && m.role === "captain")).map((t) => (
          <div key={t} className="chip" style={{ fontSize: 18, padding: "10px 20px", borderColor: `var(--color-${t === 0 ? "a" : "b"})` }}>
            {(room.state.teamNames || ["Team A", "Team B"])[t]} needs a captain: tap &ldquo;Make me captain&rdquo; on a phone</div>))}
      </div>
      {owner && lock.state === "other" && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", zIndex: 40 }}>
          <div className="text-center flex flex-col items-center gap-5">
            <div className="display" style={{ fontSize: 64, color: "var(--color-gold)" }}>Open in another tab</div>
            <div className="text-24 text-[var(--color-ink-2)] max-w-[760px]">This game is already running in another tab of this browser. One TV at a time keeps the night in step.</div>
            <button className="btn btn-gold" style={{ fontSize: 22, padding: "14px 30px" }} onClick={lock.takeOver}>Use this tab instead</button>
          </div>
        </div>)}
      {banner === "oldSave" && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", zIndex: 40 }}>
          <div className="text-center flex flex-col items-center gap-5">
            <div className="display" style={{ fontSize: 64, color: "var(--color-gold)" }}>The app was updated</div>
            <div className="text-24 text-[var(--color-ink-2)] max-w-[760px]">This game was saved by an older version and can&rsquo;t carry on. Sorry! Exit, then start a new game from the home screen.</div>
            <button className="btn btn-gold" style={{ fontSize: 22, padding: "14px 30px" }}
              onClick={() => { void sb().from("rooms").update({ status: "done" }).eq("code", code).then(() => router.replace("/")); }}>Exit this game</button>
          </div>
        </div>)}
      {room.status === "lobby" && isTv && thin.length > 0 && !notNow && lock.state === "mine" && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.93)", zIndex: 35 }} role="dialog" aria-modal="true" aria-labelledby="thin-title">
          <div className="card text-center flex flex-col items-center gap-5" style={{ maxWidth: 880, padding: "40px 48px", background: "var(--color-bg-2)" }}>
            <div id="thin-title" className="display" style={{ fontSize: 56, color: "var(--color-gold)" }}>The bank is getting thin</div>
            <div className="text-22 text-[var(--color-ink-2)]">This TV has played most of these. Their games will bring back questions you&rsquo;ve already played:</div>
            <ul className="text-20 text-left flex flex-col gap-1" style={{ listStyle: "disc", paddingLeft: 28 }}>
              {thin.map((t) => <li key={t.key}>{thinLine(t)}</li>)}
            </ul>
            <div className="text-20 text-[var(--color-ink-2)]">Reset, and every question counts as new again.</div>
            <div className="flex gap-4">
              <button className="btn btn-gold" style={{ fontSize: 22, padding: "14px 30px" }} onClick={resetPlayed}>Reset played questions</button>
              <button className="btn btn-ghost" style={{ fontSize: 22, padding: "14px 30px" }} onClick={() => setNotNow(true)}>Not now</button>
            </div>
          </div>
        </div>)}
      {room.status === "lobby" ? (
        <TvLobby room={room} members={members} code={code} k={teamCount} joinUrl={joinUrl} site={origin.replace(/^https?:\/\//, "")}
          status={<>
            <Link href="/" className="btn btn-sm btn-ghost shrink-0" aria-label="Back to the home screen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back</Link>
            {isTv && noTvBtn("btn btn-sm btn-ghost shrink-0")}
            <div className="min-w-0">
              {host ? <>Hosted by <b style={{ color: "var(--color-gold)" }}><bdi>{host.name}</bdi></b>. </> : "No host yet: the app will check answers. "}
              {many ? (manyNotReady(members, teamCount) || <>Ready: <b><bdi>{host?.name}</bdi></b> starts the game.</>)
                : readyToStart(members) ? <>Ready: <b><bdi>{who?.name}</bdi></b> starts the game.</> : notReadyWhy(members)}
              {noTvErr && <><br /><span className="font-bold" style={{ color: "var(--color-no)" }} role="alert">That didn&rsquo;t go through. Check the internet, then tap Play without TV again.</span></>}
              {lobbyNote && <><br /><span className="font-bold" style={{ color: "var(--color-no)" }} role="status">Start didn&rsquo;t go through: {lobbyNote}</span></>}
              {awake === false && <><br /><span className="text-14 text-[var(--color-no)]">This browser can&rsquo;t keep the screen awake: switch off sleep in the laptop&rsquo;s settings, or use Chrome.</span></>}
            </div></>}
          controls={<>
            {/* how many teams, 2 to 8: [−] 3 teams [+] */}
            {isTv && (
              <div className="flex items-center gap-2 rounded-full px-1 h-[42px]" style={{ border: "2px solid var(--line-2)", background: "rgba(255,255,255,.04)" }} role="group" aria-label="How many teams">
                <button className="btn btn-sm btn-ghost !px-0 w-8 !min-h-8 h-8 !border-0" style={{ background: "rgba(255,255,255,.07)" }} aria-label="One team fewer" disabled={teamCount <= 2} onClick={() => void M.setTeamCount(teamCount - 1)}>−</button>
                <span className="eyebrow text-12 whitespace-nowrap" aria-live="polite"><b className="display text-26 align-middle mr-1.5" style={{ color: "var(--color-gold)" }}>{teamCount}</b>teams</span>
                <button className="btn btn-sm btn-ghost !px-0 w-8 !min-h-8 h-8 !border-0" style={{ background: "rgba(255,255,255,.07)" }} aria-label="One team more" disabled={teamCount >= MANY_MAX} onClick={() => void M.setTeamCount(teamCount + 1)}>+</button>
              </div>)}
            <button className="btn btn-sm btn-ghost" onClick={() => { Snd.set(!soundOn); setSoundOn(!soundOn); if (!soundOn) Snd.soft(); }}>Sound: {soundOn ? "on" : "off"}</button>
            <ShareButton code={code} />
          </>} />
      ) : pubMany ? <TvMany pub={pubMany} join={{ url: joinUrl, code }} sound={isTv} host={host?.name} seats={Array.from({ length: pubMany.teams.length }, (_, t) => members.filter((m) => m.role !== "host" && (m.team as number) === t).length)} /> : pub ? <TvGame pub={pub} onExit={isTv ? exit : undefined} onAgain={isTv ? again : undefined} join={{ url: joinUrl, code }} sound={isTv} /> : (
        <div className="m-auto text-center enter">
          <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>Let&rsquo;s play</div>
        </div>
      )}
    </TvStage>
    {/* opened on a phone, the TV's lobby is tiny: the same choice, phone-sized, along the bottom */}
    {isTv && room.status === "lobby" && (
      <div className="notv-bar">{noTvBtn("btn btn-gold btn-lg btn-block")}<p>No TV? Everyone plays on their phones. Share the code on WhatsApp, or read it out.</p></div>)}
  </>);
}
