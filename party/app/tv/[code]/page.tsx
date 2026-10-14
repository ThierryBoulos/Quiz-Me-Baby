"use client";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Lineup } from "@/components/Lineup";
import { TvGame } from "@/components/TvGame";
import { TvStage } from "@/components/TvStage";
import { useTvGame } from "@/lib/tvGame";
import { ensureSession } from "@/lib/supabase";
import { notReadyWhy, readyToStart, starter, useRoom } from "@/lib/room";
import type { Pub } from "@/lib/game";
import { Snd } from "@/lib/sound";
import { useWakeLock } from "@/lib/wakeLock";
import { useFreshBuild } from "@/lib/fresh";
import { ANSWERING } from "@/components/PhoneGame";

/* Classic lives on this same site, at /classic (copied in at build time) */
const CLASSIC = "/classic";

/* THE TV. No buttons: it shows the room and runs the night. Phones send it
   actions (a team name, "start", later buzzes and answers); the TV checks the
   sender is allowed to and writes the result back for every phone to see. */
export default function TvRoom() {
  const { code } = useParams<{ code: string }>();
  const { room, members } = useRoom(code);
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => { void ensureSession().then(setMe); setOrigin(window.location.origin); }, []);
  const isTv = !!room && room.tv_id === me;

  const { pub: own, exit } = useTvGame(code, isTv, room, members);
  /* the laptop must not doze off mid-game */
  const awake = useWakeLock(isTv);
  const pub = own || ((room?.state?.pub || null) as Pub | null);
  /* an old copy of the app (left open across a deploy) reloads between questions */
  useFreshBuild(!pub || (!ANSWERING.includes(pub.screen) && !pub.deadline && !pub.pending && !pub.lifeline));
  /* the night is over and somebody tapped Exit: home (a moment later, so every phone hears it first) */
  useEffect(() => { if (!pub?.exit) return; const t = setTimeout(() => router.replace("/"), 1500); return () => clearTimeout(t); }, [pub?.exit, router]);
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
  const SoundNote = () => blocked ? <div className="fixed left-6 bottom-6 chip" style={{ fontSize: 15, padding: "8px 16px", zIndex: 30 }}>Tap the screen to turn the sound on</div> : null;

  const joinUrl = origin + "/join?code=" + code;
  const host = members.find((m) => m.role === "host");
  const who = starter(members);

  if (!room) return <TvStage><div className="m-auto flex flex-col items-center gap-4"><div className="spinner" style={{ width: 48, height: 48, borderWidth: 5 }} /><div className="eyebrow text-[20px]">Opening the room…</div></div></TvStage>;

  return (
    <TvStage>
      {/* not in the lobby: the first tap there (anywhere) turns the sound on anyway */}
      {room.status !== "lobby" && <SoundNote />}
      {room.status !== "lobby" && [0, 1].filter((t) => !members.some((m) => m.team === t && m.role === "captain")).map((t) => (
        <div key={t} className="fixed left-1/2 top-4 -translate-x-1/2 chip" style={{ fontSize: 18, padding: "10px 20px", zIndex: 30, borderColor: `var(--color-${t === 0 ? "a" : "b"})` }}>
          {(room.state.teamNames || ["Team A", "Team B"])[t]} needs a captain: tap &ldquo;Make me captain&rdquo; on a phone</div>))}
      {room.status === "lobby" ? (
        <>
          <div className="flex items-start justify-between gap-10">
            <div>
              {/* the Back row sits above the code: the code's tall letters overhang their box and used to swallow the tap */}
              <div className="relative z-10 flex items-center gap-5">
                <a href="/" className="btn btn-sm btn-ghost" aria-label="Back to the home screen">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back</a>
                <div className="eyebrow text-[16px]">Join on your phone · scan or type</div>
              </div>
              <div className="display mt-2 pointer-events-none select-none" style={{ fontSize: 150, lineHeight: 0.85, color: "var(--color-gold)", textShadow: "6px 6px 0 rgba(49,201,247,.55)", letterSpacing: "0.08em" }}>{code}</div>
              <div className="text-[22px] text-[var(--color-ink-2)] mt-1">{origin.replace(/^https?:\/\//, "")}/join</div>
            </div>
            <div className="rounded-[22px] p-4 bg-[#f4f6ff] shrink-0">
              <QRCodeSVG value={joinUrl} size={200} bgColor="#f4f6ff" fgColor="#04050e" />
            </div>
          </div>
          <div className="mt-8"><Lineup room={room} members={members} big /></div>
          <div className="mt-auto flex items-end justify-between text-[20px] text-[var(--color-ink-2)]">
            <div>
              {host ? <>Hosted by <b style={{ color: "var(--color-gold)" }}>{host.name}</b></> : "No host yet — the app will check answers."}
              <br />
              {readyToStart(members) ? <>Ready. <b>{who?.name}</b> starts the game.</> : notReadyWhy(members)}
              {awake === false && <><br /><span className="text-[16px] text-[var(--color-no)]">This browser can&rsquo;t keep the screen awake: switch off sleep in the laptop&rsquo;s settings, or use Chrome.</span></>}
            </div>
            <div className="flex gap-3">
              <button className="btn btn-sm btn-ghost" onClick={() => { Snd.set(!soundOn); setSoundOn(!soundOn); if (!soundOn) Snd.soft(); }}>Sound: {soundOn ? "on" : "off"}</button>
              {members.length === 0 && <a href={CLASSIC} className="btn btn-sm">Just play on this screen</a>}
            </div>
          </div>
        </>
      ) : pub ? <TvGame pub={pub} onExit={isTv ? exit : undefined} /> : (
        <div className="m-auto text-center enter">
          <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>Let&rsquo;s play</div>
        </div>
      )}
    </TvStage>
  );
}
