"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Lineup } from "@/components/Lineup";
import { ShareButton } from "@/components/Share";
import { ANSWERING, AwayLog, CaptainGame, HostGame, PlayerGame, ScoreFix, TvTakeover, useSecret } from "@/components/PhoneGame";
import { Confetti, Hud, usePreload } from "@/components/GameParts";
import { noteTvTime } from "@/components/Clock";
import { Rules } from "@/components/Rules";
import { Setup } from "@/components/Setup";
import { iso, type Pub } from "@/lib/game";
import { ensureSession, rpc, sb, sendAction } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { LineupMany, PickMany, SetupMany } from "@/components/many/LineupMany";
import { PhoneMany } from "@/components/many/PhoneMany";
import { NightIntroPhone } from "@/components/NightIntro";
import { HudMany, ScoresMany } from "@/components/many/PartsMany";
import { SideSlot, ToSide, useSideways } from "@/components/Side";
import { manyNames, manyNotReady, teamCountOf } from "@/lib/many/useTvMany";
import { MANY_MAX } from "@/lib/many/logic";
import { MANY_COLORS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { useFreshBuild } from "@/lib/fresh";
import { CodeTiles, MqStage, MqTop, Sign, useLights } from "@/components/Marquee";
import { NoTv, isNoTv } from "@/components/NoTv";
import { useTvGame } from "@/lib/tvGame";
import { useTvMany } from "@/lib/many/useTvMany";
import { useTabLock } from "@/lib/tabLock";
import { useLiveRoom } from "@/lib/liveCount";
import { useWakeLock } from "@/lib/wakeLock";
import { cap1, useAwayWatch, notReadyWhy, readyToStart, starter, teamName, usePresence, useRoom, type Member } from "@/lib/room";

const TEAM_MAX = 14;                                  // as the TV keeps them (lib/tvGame.ts)

/* THE PHONE. In the lobby: pick a side, take the captaincy (one per team),
   name the team, or be the host. The colour of your team fills the screen. */
export default function PhoneRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { room, members, missing, refresh } = useRoom(code);
  const [me, setMe] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);        // the team name being typed (null: not touched)
  const [nameState, setNameState] = useState<null | "saving" | "saved" | "late">(null);
  const [panel, setPanel] = useState(false);          // mid-game, behind your name: the teams (and their scores), changing captain, leaving
  const [rules, setRules] = useState(false);          // the lobby: How to Play over the room, so nobody leaves it
  const [invite, setInvite] = useState<string | null>(null);   // the room code tapped: its QR code and Share, over the screen (the join link)
  useEffect(() => { if (!invite) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setInvite(null); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [invite]);
  /* Between a tap and the TV's reply (a second or two): a bar along the top,
     and the buttons stay off, so nobody taps twice wondering if it worked. */
  /* It lasts until the TV has actually answered (its next update), not until this phone's own refresh;
     if nothing comes back in 8 s the phone says so (and takes it back if the reply comes after all), and a tap that couldn't even leave says so at once. */
  const [waiting, setWaiting] = useState(false);
  const noTvRef = useRef(false);
  /* the tap on its way to the server (before it waits for the reply). The half second in which the buttons still look
     lit counts from the tap, not from when it reached the server: counted from there, a button dimmed while the tap
     went, lit up again, then dimmed with the bar (3 Nov, on a phone: "turning on and off") */
  const [inFlight, setInFlight] = useState(false);
  const busyAny = waiting || inFlight;
  const [waitLong, setWaitLong] = useState(false);
  useEffect(() => { if (!busyAny) { setWaitLong(false); return; } const t = setTimeout(() => setWaitLong(true), 450); return () => clearTimeout(t); }, [busyAny]);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [tapErr, setTapErr] = useState<string | null>(null);
  /* where the failed tap was: the message sits just under that button (above it when the button is docked at the bottom) */
  const [tapAt, setTapAt] = useState<{ top?: number; bottom?: number } | null>(null);
  const lastBtn = useRef<Element | null>(null);
  const waitRef = useRef({ on: false, key: "" }), viewKey = useRef(""), sendKey = useRef(""), lateKey = useRef<string | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined, again: ReturnType<typeof setTimeout>[] = [];
    const stop = () => { clearTimeout(t); again.forEach(clearTimeout); again = []; waitRef.current.on = false; setWaiting(false); };
    /* the TV's latest update just before the tap went: any newer one is its reply, even one that beat the send back */
    const sending = (e: Event) => { sendKey.current = viewKey.current; if (!(e as CustomEvent<{ quick?: boolean }>).detail?.quick) setInFlight(true); };
    const landed = () => setInFlight(false);
    const on = () => {
      clearTimeout(t); setTapErr(null); lateKey.current = null;
      if (viewKey.current !== sendKey.current) { stop(); return; }   // the reply is already here
      waitRef.current = { on: true, key: sendKey.current }; setWaiting(true);
      /* the TV usually answers within half a second, by push; if that push is slow (or the feed is
         down), read the room again rather than wait for the next poll */
      again.forEach(clearTimeout);
      again = [1200, 3000, 5500].map((ms) => setTimeout(() => { if (waitRef.current.on) void refreshRef.current(); }, ms));
      /* 8 s with no reply (slow Wi-Fi at a party): say so; a reply that comes after all takes the message away */
      t = setTimeout(() => { if (waitRef.current.on) { const key = waitRef.current.key; stop(); lateKey.current = key; window.dispatchEvent(new Event("qmb:late")); setTapErr(noTvRef.current ? "The game hasn't answered. If nothing changes, tap again." : "The TV hasn't answered. If nothing changes, tap again."); } }, 8000);
    };
    const place = () => {
      const r = lastBtn.current?.isConnected ? lastBtn.current.getBoundingClientRect() : null;
      if (!r) return setTapAt(null);
      setTapAt(window.innerHeight - r.bottom > 90 ? { top: r.bottom + 8 } : { bottom: window.innerHeight - r.top + 8 });
    };
    const failed = (e: Event) => {
      stop(); place(); setInFlight(false);
      const said = (e as CustomEvent<string>).detail;
      setTapErr(!said || /^No connection/.test(said) ? "No connection. Tap again." : said);
    };
    const tapped = (e: Event) => { const b = (e.target as Element | null)?.closest?.("button"); if (b) lastBtn.current = b; };
    const late = () => { place(); };
    document.addEventListener("pointerdown", tapped, true);
    document.addEventListener("keydown", tapped, true);
    window.addEventListener("qmb:late", late);
    window.addEventListener("qmb:sending", sending);
    window.addEventListener("qmb:sent", on);
    window.addEventListener("qmb:failed", failed);
    window.addEventListener("qmb:landed", landed);
    return () => {
      window.removeEventListener("qmb:sending", sending); window.removeEventListener("qmb:sent", on); window.removeEventListener("qmb:failed", failed); window.removeEventListener("qmb:late", late); window.removeEventListener("qmb:landed", landed);
      document.removeEventListener("pointerdown", tapped, true); document.removeEventListener("keydown", tapped, true); clearTimeout(t); again.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => { if (!tapErr) return; const t = setTimeout(() => setTapErr(null), 6000); return () => clearTimeout(t); }, [tapErr]);

  useEffect(() => { void ensureSession().then(setMe); }, []);
  /* No TV (3 Nov): the phone of whoever created the room (the room's "TV" in the database) runs the game for
     everyone, as the TV would: the same game, nothing drawn for it. One tab at a time; the screen stays awake. */
  const noTv = isNoTv(room?.state);
  noTvRef.current = noTv;
  const referee = noTv && !!room && !!me && room.tv_id === me;
  const report = usePresence(code, me, referee);
  useLiveRoom(code);
  const mine = useMemo(() => members.find((m) => m.user_id === me) || null, [members, me]);

  /* not in this room (yet): to the join screen with the code filled in. But only once sure: a phone waking
     up (back from another app) can read with a sign-in a few seconds out of date, and the room then looks
     empty or gone (28 Oct: a player was sent to the join screen mid-game). So it renews the sign-in, reads
     the room again, and goes only if it still isn't there. */
  const gone = !!missing || !!(room && me && members.length && !mine);
  const goneRef = useRef(gone);
  goneRef.current = gone;
  useEffect(() => {
    if (!gone) return;
    let live = true;
    /* (1 Nov: back from another app, the owner was sent to the join screen anyway: the phone's connection can take
       longer than that to wake up.) So up to three tries, each with a fresh sign-in, about ten seconds in all, and
       never while the page is out of sight */
    const t = setTimeout(async () => {
      for (let i = 0; i < 3 && live; i++) {
        try {
          const { data } = await sb().auth.getSession();
          if (!data.session || (data.session.expires_at ?? 0) * 1000 < Date.now() + 60000) await sb().auth.refreshSession();
          await refreshRef.current();
        } catch { /* try again */ }
        await new Promise((r) => setTimeout(r, 2500));
        if (!goneRef.current) return;
      }
      if (live && goneRef.current && document.visibilityState === "visible") router.replace("/join?code=" + code);
    }, 2500);
    return () => { live = false; clearTimeout(t); };
  }, [gone, code, router]);

  const host = members.find((m) => m.role === "host") || null;
  const refName = noTv ? members.find((m) => m.user_id === room?.tv_id)?.name ?? null : null;
  const side = mine?.team === 0 ? "a" : mine?.team === 1 ? "b" : null;
  /* more than two teams (3 to 8): their own lobby buttons and game screens */
  const teamCount = teamCountOf(room), many = teamCount > 2 || room?.mode === "many";
  const pubM = many ? (room?.state?.pub as PubMany | null | undefined) : null;
  /* a phone on its side: the left column's slot for the question, the clock and your team's card (components/Side) */
  const sideways = useSideways();
  const [sideSlot, setSideSlot] = useState<HTMLDivElement | null>(null);
  const manyColor = many && mine?.team != null ? MANY_COLORS[mine.team as number] : null;
  useEffect(() => { document.documentElement.style.setProperty("--tint", manyColor || (side ? `var(--color-${side})` : "var(--color-gold)")); }, [side, manyColor]);
  const refLock = useTabLock(code, referee);
  /* (taking over: the room says so the moment the server does, a beat before this phone has stored the save it
     carries on from, so the game waits for the save; started without it, it would start empty) */
  const [taking, setTaking] = useState(false);
  const runs = referee && refLock.state === "mine" && !taking;
  useTvGame(code, runs && !many, room, members, true);
  useTvMany(code, runs && many, room, members, true);
  useWakeLock(runs);
  /* the phone running the game says it's still here, every 5 s while it's on screen */
  useEffect(() => {
    if (!runs) return;
    const beat = () => { if (document.visibilityState === "visible") void sb().rpc("qmb_ref_beat", { r: code }).then(() => {}, () => {}); };
    beat();
    const t = setInterval(beat, 5000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [runs, code]);
  /* ...and if it goes quiet for 20 s (asleep, another app, a flat battery), the host's or a captain's phone takes
     the game over from its last save (the server picks one; the others carry on as they were). That phone then
     runs the game as above. Nothing to tap: the night pauses, then carries on. */
  const takerRole = mine?.role === "host" || mine?.role === "captain";
  const [tookOver, setTookOver] = useState(false);
  useEffect(() => {
    if (!noTv || referee || !takerRole || !me || room?.status === "done") return;
    let live = true;
    const tryTake = async () => {
      if (!live || document.visibilityState !== "visible") return;
      setTaking(true);
      try {
        const r = await rpc<{ ok?: boolean; taken?: boolean; save?: Record<string, unknown> | null }>("qmb_take_game", { r: code });
        if (!r?.taken) return;                       // (taken: stored even if this loop has just stopped, as this phone became the game's)
        const sv = r.save;
        try {
          if (sv) {
            const { inboxLast, many: isMany, settings, ...rest } = sv as { inboxLast?: number; many?: boolean; settings?: unknown } & Record<string, unknown>;
            /* the night's settings (its timers, its rules) come with it: this phone plays it as it was set up */
            if (settings) localStorage.setItem("qmb.party.settings", JSON.stringify(settings));
            localStorage.setItem("qmb.tv." + code + (isMany ? ".many" : ".game"), JSON.stringify(rest));
            if (inboxLast) localStorage.setItem("qmb.tv." + code + ".last", String(inboxLast));
          }
        } catch { /* in memory only: the room carries the lobby, and a game starts afresh */ }
        setTookOver(true);
        void refreshRef.current();
      } catch { /* the next try */ }
      finally { setTaking(false); }
    };
    const t = setInterval(() => void tryTake(), 6000 + Math.floor(Math.random() * 2000));
    return () => { live = false; clearInterval(t); };
  }, [noTv, referee, takerRole, me, code, room?.status]);
  useEffect(() => { if (!tookOver) return; const t = setTimeout(() => setTookOver(false), 12000); return () => clearTimeout(t); }, [tookOver]);

  /* a call to the server in the lobby (claim, team, leave): it answers "ok" or a reason, then the room is read again */
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (typeof r === "string" && r !== "ok") setMsg(friendly(r)); await refresh(); }
    catch (e) { if (!(e as { announced?: boolean }).announced) setMsg(friendly(e)); }
    setBusy(false);
  }
  /* a tap for the TV: the TV answers with its next update (the bar along the top waits for that), so
     nothing is read back here. (Through act, the tap's tag it returns read as an error: every host tap
     put "Something went wrong. Try again." up, and the buttons stayed off until a slow re-read was back.) */
  async function tell(fn: () => Promise<unknown>) {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { if (!(e as { announced?: boolean }).announced) setMsg(friendly(e)); }
    setBusy(false);
  }
  const pickTeam = (t: number | null) => act(() => rpc<string>("qmb_update_me", { r: code, nm: mine?.name ?? "", tm: t }));
  const self = useRef(0);                              // when I last changed my own role
  const claim = (want: "captain" | "host" | "player") => { self.current = Date.now(); return act(() => rpc<string>("qmb_claim", { r: code, want })); };
  const move = (m: Member, to: 0 | 1) => act(async () => {
    const { error } = await sb().from("members").update({ team: to, role: "player" }).eq("room", code).eq("user_id", m.user_id);
    if (error) throw new Error(error.message);
  });
  /* the host: a ghost or a prankster off the line-up (they can join again with the code) */
  const remove = (m: Member) => window.confirm(`Remove ${m.name} from the game?`) && act(async () => {
    const { error } = await sb().from("members").delete().eq("room", code).eq("user_id", m.user_id);
    if (error) throw new Error(error.message);
  });
  const leave = () => (room?.status === "lobby" || window.confirm("Leave the game? You can come back with the same name.")) && act(async () => { await sb().from("members").delete().eq("room", code).eq("user_id", me!); router.replace("/"); });

  /* the armband moved without me asking (a captain's phone was away): say so, once */
  const [note, setNote] = useState<string | null>(null);
  const was = useRef<{ role?: string; team?: number | null }>({});
  useEffect(() => {
    if (!mine) return;
    const w = was.current, mid = room?.status === "playing", mineSelf = Date.now() - self.current < 8000;
    if (mid && w.role && w.team === mine.team && w.role !== mine.role && !mineSelf) {
      const cap = members.find((m) => m.team === mine.team && m.role === "captain");
      if (mine.role === "captain") setNote("You're your team's captain now: their phone was away. You type the answers.");
      else if (w.role === "captain" && cap) setNote(`Your phone was away, so ${iso(cap.name)} took over as captain. They can step down to hand it back.`);
    }
    was.current = { role: mine.role, team: mine.team };
  }, [mine, members, room?.status]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 9000); return () => clearTimeout(t); }, [note]);

  /* a captain names the team: the TV writes it; we wait to see it land */
  const saveTeamName = () => {
    const name = cap1((draft ?? "").trim());
    if (!mine || mine.team == null || !name || name.length > TEAM_MAX) return;
    setNameState("saving"); setMsg(null);
    void sendAction(code, "team_name", { team: mine.team, name }).catch(() => { setNameState(null); /* the phone already says so */ });
    (document.activeElement as HTMLElement | null)?.blur?.();
  };
  const shownName = mine?.team != null ? teamName(room, mine.team) : "";
  useEffect(() => {
    if (nameState !== "saving") return;
    if (draft != null && shownName === cap1(draft.trim())) { setNameState("saved"); setDraft(null); return; }
    const t = setTimeout(() => setNameState("late"), 8000);
    return () => clearTimeout(t);
  }, [nameState, shownName, draft]);
  useEffect(() => { if (nameState !== "saved") return; const t = setTimeout(() => setNameState(null), 4000); return () => clearTimeout(t); }, [nameState]);

  const playing = room?.status === "playing" || room?.status === "done";
  const pub = (room?.state?.pub || null) as Pub | null;
  usePreload(pub);
  /* the TV's reply has landed: the game moved on (a new update from the TV, or the game started) */
  /* in the lobby the TV answers by changing the room itself (a team name, who's away), not a game view */
  /* (and by writing why a Start didn't start: that note is the reply, and the phone that tapped shows it) */
  const lobbyNote = room?.status === "lobby" ? (room.state?.note as { text: string; at: number } | undefined) : undefined;
  const lobbyKey = room?.status === "lobby" ? JSON.stringify([room.state?.teamNames, room.state?.away, lobbyNote?.at]) : "";
  viewKey.current = `${room?.status}|${pub?.at ?? ""}|${lobbyKey}`;
  useEffect(() => {
    if (waitRef.current.on && viewKey.current !== waitRef.current.key) {
      waitRef.current.on = false; setWaiting(false);
      setTapErr(lobbyNote && Date.now() - lobbyNote.at < 15000 ? lobbyNote.text : null);
    }
    if (lateKey.current != null && viewKey.current !== lateKey.current) { lateKey.current = null; setTapErr(null); }
  }, [room?.status, pub?.at, lobbyKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { noteTvTime(pub?.at); }, [pub?.at]);
  /* an old copy of the app (left open across a deploy) reloads when nothing is being answered */
  useFreshBuild(!pub || (!ANSWERING.includes(pub.screen) && !pub.deadline && !pub.pending && !pub.lifeline), room?.status === "playing");
  /* the night is over and somebody tapped Exit: everyone back to the home screen */
  useEffect(() => { if (pub?.exit) router.replace("/"); }, [pub?.exit, router]);
  /* (in the lobby too: the TV shares its settings and its own questions with the host there) */
  const secret = useSecret(code, !!mine && mine.role === "host" && (playing || room?.status === "lobby"));
  /* a question is live on this phone: leaving the screen now gets flagged on the TV */
  const live = !!pub && !!mine && mine.role !== "host" && ANSWERING.includes(pub.screen) && !pub.paused
    && !(pub.lifeline?.key === "friend" && pub.lifeline.team === mine.team);
  useAwayWatch(report, live, pub?.qid);
  const sendMove = (move: Record<string, unknown>) => tell(() => sendAction(code, "judge", { move, step: pub?.step }));
  /* quick taps (+1, Undo, pausing a call): straight out, the buttons never wait for them */
  const fireMove = (move: Record<string, unknown>) => { void sendAction(code, "judge", { move, step: pub?.step }).catch(() => { /* the phone already says so */ }); };

  /* the lobby in the marquee's look (the owner, 2 Nov): the stage behind, the sign small at the top */
  const lights = useLights(120, room?.status === "lobby" && !!mine);
  if (!room || !mine) return <main className="screen justify-center items-center gap-4" aria-busy="true"><div className="spinner" /><div className="eyebrow">Finding your seat…</div></main>;

  const myCaptain = mine.team != null ? members.find((m) => m.team === mine.team && m.role === "captain") : null;
  const who = starter(members);
  const canStart = who?.user_id === me;
  const ready = readyToStart(members);
  const tooLong = (draft ?? "").trim().length > TEAM_MAX;
  const lobby = room.status === "lobby";
  const awayIds = (room.state?.away as string[] | undefined) || [];
  /* a side to pick: a ticket in the team's colour, with who's on it so far */
  const onTeam = (t: number) => members.filter((m) => m.team === t && m.role !== "host");
  const sideInfo = (t: number) => { const l = onTeam(t), c = l.find((m) => m.role === "captain");
    return l.length === 0 ? "Nobody yet" : <>{l.length} {l.length === 1 ? "player" : "players"}{c && <> · Captain <bdi>{c.name}</bdi></>}</>; };
  const twoSides = (
    <>
      <button className="mq-pick" style={{ ["--c" as string]: "var(--color-a)" }} disabled={busy} onClick={() => pickTeam(0)}><span className="tn"><bdi>{teamName(room, 0)}</bdi></span><small>{sideInfo(0)}</small></button>
      <span className="mq-vs" aria-hidden>vs</span>
      <button className="mq-pick" style={{ ["--c" as string]: "var(--color-b)" }} disabled={busy} onClick={() => pickTeam(1)}><span className="tn"><bdi>{teamName(room, 1)}</bdi></span><small>{sideInfo(1)}</small></button>
    </>);

  return (<NoTv.Provider value={noTv}>
    <main className={"screen split" + (lobby ? " mq mq-room" + lights : "")} data-soft={busyAny && !waitLong ? "" : undefined}>
      {lobby && <MqStage />}
      {busyAny && waitLong && <div className="sending" role="progressbar" aria-label="Sending" />}
      {tapErr && <div className="fixed left-4 right-4 enter text-center font-bold rounded-[16px]" role="alert" data-taperr
        style={{ zIndex: 50, ...(tapAt ?? { top: "calc(12px + env(safe-area-inset-top))" }), fontSize: 15, padding: "12px 16px", background: "#2a0d16", border: "1px solid var(--color-no)", color: "#ffd5dc",
          boxShadow: "0 12px 30px rgba(0,0,0,.6)" }}>{tapErr}</div>}
      {pub?.screen === "final" && !panel && <div className="confetti-back"><Confetti n={60} /></div>}
      {/* a phone held sideways: who you are, the room and the scores in a column on the left, the game on the right
          (phase 4, 2 Nov). Upright, both wrappers fold away (display: contents) and nothing moves */}
      <div className="side">
      <header className="flex items-center justify-between gap-3">
        {/* in a game, your name is the one button up here (the owner, 31 Oct): it opens the teams, their scores and
            players, your captaincy and Leave, in place of a Scores and a Team button; in the lobby it's just your name */}
        {room.status !== "lobby"
          ? <button type="button" className={"chip me-chip" + (panel ? " chip-on" : "")} aria-expanded={panel} aria-label={`${mine.name}: teams and scores`} onClick={() => setPanel(!panel)}>
              <span className="face">{mine.avatar || "🙂"}</span><span className="truncate"><bdi>{mine.name}</bdi></span>
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0 opacity-70" style={{ transform: panel ? "rotate(180deg)" : undefined, transition: "transform .2s" }}><path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          : <span className="chip me-flat"><span className="face">{mine.avatar || "🙂"}</span><span className="truncate"><bdi>{mine.name}</bdi></span></span>}
        {/* the room code opens its QR code and Share, so a late friend can scan this phone (the owner, 31 Oct) */}
        <button type="button" className="eyebrow whitespace-nowrap inline-flex items-center gap-1.5 min-h-[44px] px-2 -mx-2 rounded-[12px]" aria-haspopup="dialog" aria-label={`Room ${code}: show the QR code to join`}
          onClick={() => setInvite(`${window.location.origin}/join?code=${code}`)}>
          {lobby ? <CodeTiles code={code} className="mini" /> : <><span className="code-txt">{code}</span><CodeTiles code={code} className="mini code-game" /></>}
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="currentColor"><path d="M1 1h6v6H1V1Zm1.5 1.5v3h3v-3h-3ZM9 1h6v6H9V1Zm1.5 1.5v3h3v-3h-3ZM1 9h6v6H1V9Zm1.5 1.5v3h3v-3h-3ZM9 9h2v2H9V9Zm4 0h2v2h-2V9Zm-2 2h2v2h-2v-2Zm-2 2h2v2H9v-2Zm4 0h2v2h-2v-2Z" /></svg>
        </button>
        {room.status === "lobby" && <button className="btn btn-sm btn-ghost" onClick={leave} aria-label="Leave the room">Leave</button>}
      </header>

      {/* the lobby: the logo, small, while everyone waits */}
      {lobby && <div className="mq-room-sign" aria-hidden><Sign size={30}>Quiz Me Baby!</Sign></div>}

      {/* the tracker, as on the TV: scores, where we are, the night's progress */}
      {/* (two teams: it stays over the teams sheet too, so the scores and the players are on one screen) */}
      {room.status !== "lobby" && pub && !many && (mine.team != null || mine.role === "host") && <Hud pub={pub} size="phone" />}
      {/* (3-8 teams: over the game, not over the teams sheet) */}
      {room.status !== "lobby" && many && !panel && pubM?.many && !pubM.intro && (mine.team != null || mine.role === "host")
        && <HudMany pub={pubM} size="phone" me={mine.team as number | null} host={mine.role === "host"} />}
      {sideways && <div className="side-slot" ref={setSideSlot} />}
      </div>
      <SideSlot.Provider value={sideways ? sideSlot : null}>
      <div className="main">

      {note && <p className="text-center text-14 font-bold enter" role="status" style={{ color: "var(--color-gold)" }}>{note}</p>}

      {pub?.tvAway && room.status !== "lobby" && (
        <p className="text-center text-14 font-bold enter" role="status" style={{ color: "var(--color-gold)" }}>
          {noTv ? <>{refName ? <><bdi>{refName}</bdi>&rsquo;s phone runs the game, and it&rsquo;s</> : "The phone running the game is"} asleep or on another app. Everything is paused until it&rsquo;s back.</>
            : <>The TV has gone to sleep or out of sight. Everything is paused until it&rsquo;s back.</>}</p>)}
      {/* this phone runs the game: keep it on, in this app */}
      {runs && tookOver && <p className="text-center text-14 font-bold enter" role="status" style={{ color: "var(--color-gold)" }}>The phone running the game went quiet, so this one runs it now. Keep it on, on this screen.</p>}
      {runs && !tookOver && room.status !== "lobby" && <p className="text-center text-12 text-[var(--color-ink-3)]">This phone runs the game: keep it on, on this screen.</p>}
      {referee && refLock.state === "other" && (
        <div className="card flex flex-col gap-2 text-center"><p className="text-14">This game runs in another tab of this browser.</p>
          <button className="btn btn-sm self-center" onClick={refLock.takeOver}>Run it here instead</button></div>)}

      {room.status !== "lobby" ? (
        /* joined after the start: pick a side first */
        mine.team == null && mine.role !== "host" ? (
          <section className="flex flex-col gap-3 enter">
            <h1 className="display text-40 text-center">Pick a side</h1>
            <p className="text-center text-14 text-[var(--color-ink-2)]">The game&rsquo;s on. Join a team and help your captain.</p>
            {many ? <PickMany room={room} k={teamCount} busy={busy} pick={pickTeam} members={members} /> : twoSides}
          </section>
        ) : panel ? (
          /* mid-game, behind your name: the teams (many: in order, with their scores and players), a new captain when one is needed */
          <section className="flex flex-col gap-3 enter">
            {many && (room.state?.pub as PubMany | null)?.many && <ScoresMany pub={room.state.pub as PubMany} me={mine.team as number | null} members={members} />}
            {mine.role === "captain" && (
              <div className="card flex flex-col gap-2">
                <div className="eyebrow" style={{ color: "var(--color-gold)" }}>You&rsquo;re the captain</div>
                <p className="text-14 text-[var(--color-ink-2)]">Hand over to a teammate: step down, and they tap &ldquo;Make me captain&rdquo; on their phone.</p>
                <button className="btn" disabled={busy} onClick={() => claim("player")}>Step down as captain</button>
              </div>)}
            {mine.role === "player" && !myCaptain && (
              <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => claim("captain")}>Make me captain</button>)}
            {mine.role === "player" && myCaptain && <div className="card text-center text-14">{myCaptain.name} is your captain. If they step down, you can take over here.</div>}
            {mine.role === "host" && !many && <p className="text-14 text-[var(--color-ink-2)]">Tap an arrow to move a player across. A moved captain becomes a player, and their team picks a new one.</p>}
            {many ? (!(room.state?.pub as PubMany | null)?.many && <LineupMany room={room} members={members} k={teamCount} />) : <Lineup room={room} members={members} onMove={mine.role === "host" ? move : undefined} onRemove={mine.role === "host" ? remove : undefined} />}
            {mine.role === "host" && <AwayLog pub={pub} />}
            <button className="btn btn-gold btn-block" onClick={() => setPanel(false)}>Back to the game</button>
            {mine.role === "host" && pub && !many && <ScoreFix pub={pub} send={sendMove} busy={busy || waiting} />}
            {mine.role === "host" && pub && !noTv && <TvTakeover code={code} />}
            {/* no host: either captain asks for new scores; the other captain agrees, or not (back on the game screen) */}
            {mine.role === "captain" && pub?.mode === "nohost" && <ScoreFix pub={pub} ask busy={busy || waiting}
              send={(move) => { void tell(() => sendAction(code, "next", { move, step: pub.step })); setPanel(false); }} />}
            {/* leaving is kept away from everyday buttons, and asks first */}
            <button className="btn btn-sm btn-ghost self-center mt-6" style={{ color: "var(--color-no)", borderColor: "color-mix(in srgb, var(--color-no) 45%, transparent)" }} onClick={leave}>Leave the game</button>
          </section>
        ) : many ? ((room.state?.pub as PubMany | null)?.many ? ((room.state.pub as PubMany).intro
              ? <NightIntroPhone intro={(room.state.pub as PubMany).intro!} busy={busy || waiting} who="The host starts the game."
                  go={mine.role === "host" ? () => void sendMove({ type: "m/go" }) : undefined} />
              : <PhoneMany pub={room.state.pub as PubMany} me={mine} code={code} />)
            : <section className="card text-center enter flex-1 grid place-items-center"><div><div className="eyebrow">Game on</div><h1 className="display text-44 mt-2">{noTv ? "Get ready" : "Eyes on the TV"}</h1></div></section>
        ) : !pub ? (
          <section className="card text-center enter flex-1 grid place-items-center">
            <div><div className="eyebrow">Game on</div><h1 className="display text-44 mt-2">{noTv ? "Get ready" : "Eyes on the TV"}</h1></div>
          </section>
        ) : pub.intro ? (() => { const I = pub.intro, lead = I.go != null && mine.role === "captain" && mine.team === I.go;
            const capGo = () => void tell(() => sendAction(code, "next", { move: { type: "ui/introGo" }, step: pub.step }));
            return <NightIntroPhone intro={I} busy={busy || waiting}
              who={I.go != null ? `${pub.captains?.[I.go as 0 | 1] || "The captain"} starts the game.` : "The host starts the game."}
              go={mine.role === "host" ? () => void sendMove({ type: "ui/introGo" }) : mine.role === "captain" && I.go != null ? capGo : undefined}
              goAt={mine.role === "captain" && !lead && pub.nextOpenAt ? pub.nextOpenAt : undefined} />; })()
        : mine.role === "host" ? <HostGame pub={pub} secret={secret} send={sendMove} fire={fireMove} busy={busy || waiting} />
          : mine.role === "captain" ? <CaptainGame pub={pub} me={mine} members={members} code={code} hold={waiting} />
          : <>
              {!myCaptain && <button className="btn btn-gold btn-block" disabled={busy} onClick={() => claim("captain")}>Your team has no captain. Make me captain</button>}
              <PlayerGame pub={pub} me={mine} members={members} code={code} />
            </>
      ) : mine.role === "host" ? (
        <>
          <section className="mq-host enter">
            <div className="eyebrow">You&rsquo;re the host</div>
            <h1 className="mq-h1">Run the night</h1>
            <p>You&rsquo;ll see every answer.</p>
          </section>
          {/* the line-up on one line, so Setup is right here (13 players used to push it 1,400 px down) */}
          <button type="button" className="card flex items-center justify-between gap-3 text-left" aria-expanded={lineupOpen} onClick={() => setLineupOpen((v) => !v)}>
            <span className="text-14">{many ? <><b>{members.filter((m) => m.role !== "host").length} in</b>, {teamCount} teams, {manyNotReady(members, teamCount) || "every captain set"}</>
              : <><b>{members.filter((m) => m.role !== "host").length} in</b> · {[0, 1].map((t) => members.filter((m) => m.team === t).length).join(" v ")} · {notReadyWhy(members) || "both captains set"}</>}</span>
            <span className="text-12 font-bold text-[var(--color-ink-2)]">{lineupOpen ? "Hide" : "Show"}</span>
          </button>
          {lineupOpen && <>
            <p className="text-14 text-[var(--color-ink-2)]">Tap an arrow to move a player across. A moved captain becomes a player, and their team picks a new one.</p>
            {many ? <LineupMany room={room} members={members} k={teamCount} /> : <Lineup room={room} members={members} onMove={move} onRemove={remove} />}
          </>}
          <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => claim("player")}>Stop hosting</button>
        </>
      ) : mine.team == null ? (
        <section className="flex flex-col gap-3 enter">
          <h1 className="mq-h1 text-center">Pick a side</h1>
          {many ? <PickMany room={room} k={teamCount} busy={busy} pick={pickTeam} members={members} /> : twoSides}
          <div className="h-2" />
          {!host && <button className="btn btn-block btn-ghost" disabled={busy} onClick={() => claim("host")}>I&rsquo;m the host</button>}
        </section>
      ) : (
        <section className="flex flex-col gap-3 enter">
          {/* your team's card, lit in its colour, with who's on it (the captain first, with the armband); a phone on its
              side shows it in the left column, under the sign */}
          <ToSide order={3}>
          <div className="mq-team" style={{ ["--c" as string]: manyColor || `var(--color-${side})` }}>
            <div className="eyebrow">You&rsquo;re on</div>
            <div className="tn"><bdi>{many ? manyNames(room, teamCount)[mine.team as number] : teamName(room, mine.team)}</bdi></div>
            <ul className="mq-mates" aria-label="Your team">
              {onTeam(mine.team as number).sort((x, y) => (x.role === "captain" ? -1 : 0) - (y.role === "captain" ? -1 : 0)).map((m) => {
                const gone = m.role === "captain" && awayIds.includes(m.user_id);
                return (
                  <li key={m.user_id} className={(m.role === "captain" ? "capt" : "") + (gone ? " away" : "") + (m.user_id === me ? " me" : "")}>
                    {m.role === "captain" && <b className="arm-c" aria-label="Captain">C</b>}
                    <i aria-hidden>{gone ? "💤" : m.avatar || "🙂"}</i><bdi className="truncate">{m.name}</bdi>{m.user_id === me && <span className="you">You</span>}
                  </li>); })}
            </ul>
          </div>
          </ToSide>
          {mine.role === "captain" ? (
            <div className="card flex flex-col gap-3">
              <div className="flex items-center gap-2"><b className="arm-c lg" aria-hidden>C</b><span className="eyebrow" style={{ color: "var(--color-gold)" }}>You&rsquo;re the captain</span></div>
              <div className="flex items-baseline justify-between"><label className="field-label !mb-0" htmlFor="tname">Name your team</label>
                <span className="text-12 tabular-nums" aria-live="polite" style={{ color: tooLong ? "var(--color-no)" : "var(--color-ink-3)", fontWeight: tooLong ? 700 : 400 }}>
                  {(draft ?? teamName(room, mine.team)).trim().length}/{TEAM_MAX}</span></div>
              {/* a form, so the keyboard's Done/Go saves it too; Save keeps the keyboard's focus so the tap never misses */}
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveTeamName(); }}>
                <input id="tname" className="input" maxLength={40} enterKeyHint="done" aria-invalid={tooLong} autoComplete="off" value={draft ?? teamName(room, mine.team)}
                  onChange={(e) => { setDraft(e.target.value); setNameState(null); }} onFocus={(e) => e.currentTarget.select()} />
                <button type="submit" className="btn shrink-0" onPointerDown={(e) => e.preventDefault()}
                  disabled={busy || nameState === "saving" || tooLong || !(draft ?? "").trim() || (draft ?? "").trim() === teamName(room, mine.team)}>{nameState === "saving" ? "Saving…" : "Save"}</button>
              </form>
              {tooLong && <p className="field-error" role="alert">Team names can be up to {TEAM_MAX} characters. Try a shorter one.</p>}
              {nameState === "saved" && <p className="text-13 font-bold" role="status" style={{ color: "var(--color-ok)" }}>Saved.{noTv ? "" : <> It&rsquo;s on the TV.</>}</p>}
              {nameState === "late" && <p className="field-error" role="alert">{noTv ? "That didn\u2019t go through. Try again." : <>The TV didn&rsquo;t pick it up. Is the TV screen still open? Try again.</>}</p>}
              <button className="btn btn-sm btn-ghost self-start" disabled={busy} onClick={() => claim("player")}>Step down</button>
            </div>
          ) : myCaptain ? (
            ((room.state.away as string[] | undefined) || []).includes(myCaptain.user_id) ? (
              <button className="btn btn-gold btn-block" disabled={busy} onClick={() => tell(() => sendAction(code, "setup", { takeCaptain: true }))}>
                <bdi>{myCaptain.name}</bdi> seems away. Make me captain</button>
            ) : <p className="text-center text-16 text-[var(--color-ink-2)] py-2"><b style={{ color: "var(--color-ink)" }}><bdi>{myCaptain.name}</bdi></b> is your captain</p>
          ) : (
            <button className="btn btn-gold btn-block shine" disabled={busy} onClick={() => claim("captain")}>Make me captain</button>
          )}
          {many ? <><div className="eyebrow text-center mt-2">Change team</div><PickMany room={room} k={teamCount} busy={busy} pick={pickTeam} current={mine.team as number} members={members} /></>
            : <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => pickTeam(mine.team === 0 ? 1 : 0)}>Switch to {teamName(room, mine.team === 0 ? 1 : 0)}</button>}
        </section>
      )}

      {msg && <p className="field-error text-center">{msg}</p>}

      {/* the room code, tapped: the QR code to scan, the code, and Share; a tap outside or Close puts it away */}
      {invite && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 enter" style={{ background: "rgba(3,4,10,.82)" }} role="dialog" aria-modal="true" aria-label="Join this game" onClick={() => setInvite(null)}>
          <div className="card w-full max-w-[360px] flex flex-col items-center gap-3 text-center" style={{ background: "#10142e" }} onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Join this game</div>
            <div className="rounded-[18px] p-3 bg-[#f4f6ff]"><QRCodeSVG value={invite} size={220} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
            <CodeTiles code={code} className="w-[240px]" /><span className="sr-only">{code}</span>
            <p className="text-14 text-[var(--color-ink-2)]">Scan it with the camera, or open <b>{invite.replace(/^https?:\/\//, "").replace(/\/join.*$/, "")}</b> and type the code.</p>
            <ShareButton code={code} big />
            <button className="btn btn-gold btn-block" autoFocus onClick={() => setInvite(null)}>Close</button>
          </div>
        </div>)}

      {rules && room.status === "lobby" && (
        <div className="fixed inset-0 z-40 overflow-y-auto mq-over" role="dialog" aria-modal="true" aria-label="How to play">
          <MqStage />
          <div className="screen !max-w-[720px]">
            <MqTop onBack={() => setRules(false)} eyebrow="How to play" title="How the night works" />
            <p className="text-13 text-[var(--color-ink-2)] -mt-2">Times below are the defaults; the {noTv ? "host" : "TV"}&rsquo;s Settings can change them.</p>
            <Rules noTv={noTv} />
            <button className="btn btn-gold btn-lg btn-block" onClick={() => setRules(false)}>Back to the lobby</button>
          </div>
        </div>)}

      {room.status === "lobby" && (
        <footer className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2">
            <button type="button" className="text-14 font-bold underline underline-offset-4 text-[var(--color-ink-2)] min-h-[44px] px-3" onClick={() => setRules(true)}>How to play</button>
            <ShareButton code={code} />
          </div>
          {/* the host can add or take away a team from here, as the TV's own stepper does */}
          {mine.role === "host" && (
            <div className="card flex items-center justify-between gap-3 !py-2" role="group" aria-label="How many teams">
              <span className="font-bold text-15">Teams</span>
              <span className="flex items-center gap-1 shrink-0">
                <button className="btn btn-sm !px-0 w-11" aria-label="One team fewer" disabled={busy || teamCount <= 2} onClick={() => tell(() => sendAction(code, "setup", { teams: teamCount - 1 }))}>−</button>
                <b className="display text-26 w-8 text-center" aria-live="polite">{teamCount}</b>
                <button className="btn btn-sm !px-0 w-11" aria-label="One team more" disabled={busy || teamCount >= MANY_MAX} onClick={() => tell(() => sendAction(code, "setup", { teams: teamCount + 1 }))}>+</button>
              </span>
            </div>)}
          {many && mine.role === "host" ? (
            <SetupMany busy={busy} k={teamCount} why={manyNotReady(members, teamCount)} onStart={(cfg) => tell(() => sendAction(code, "setup", { start: true, cfg }))} />
          ) : canStart && !many ? (
            <Setup code={code} ready={ready} why={notReadyWhy(members)} busy={busy} isHost={mine.role === "host"} tv={mine.role === "host" ? secret.lobby : undefined} onStart={(cfg) => tell(() => sendAction(code, "setup", { start: true, cfg }))} />
          ) : (
            <p className="text-center text-14 text-[var(--color-ink-2)]">
              You&rsquo;re in.{" "}
              {host && who?.user_id === host.user_id ? <>Hosted by <b style={{ color: "var(--color-gold)" }}><bdi>{host.name}</bdi></b>, who starts the game.</>
                : <>{host && <>Hosted by <b style={{ color: "var(--color-gold)" }}><bdi>{host.name}</bdi></b>. </>}{who ? <><b style={{ color: "var(--color-gold)" }}><bdi>{who.name}</bdi></b> starts the game.</> : "The host, or Team A's captain, starts the game."}</>}
              <br /><span className="text-12 text-[var(--color-ink-3)]">Heads up: leaving this screen during a question (another app, a search) is flagged{noTv ? "" : " on the TV"}.</span>
            </p>
          )}
        </footer>
      )}
      </div>
      </SideSlot.Provider>
    </main>
  </NoTv.Provider>);
}
