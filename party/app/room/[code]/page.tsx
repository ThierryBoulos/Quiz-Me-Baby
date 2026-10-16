"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Lineup } from "@/components/Lineup";
import { ANSWERING, AwayLog, CaptainGame, HostGame, PlayerGame, useSecret } from "@/components/PhoneGame";
import { Confetti, Hud } from "@/components/GameParts";
import { noteTvTime } from "@/components/Clock";
import { Rules } from "@/components/Rules";
import { Setup } from "@/components/Setup";
import { iso, type Pub } from "@/lib/game";
import { ensureSession, rpc, sb, sendAction } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { useFreshBuild } from "@/lib/fresh";
import { cap1, useAwayWatch, notReadyWhy, readyToStart, starter, teamName, usePresence, useRoom, type Member } from "@/lib/room";

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
  const [panel, setPanel] = useState(false);          // mid-game: the line-up, and changing captain
  const [rules, setRules] = useState(false);          // the lobby: How to Play over the room, so nobody leaves it
  /* Between a tap and the TV's reply (a second or two): a bar along the top,
     and the buttons stay off, so nobody taps twice wondering if it worked. */
  /* It lasts until the TV has actually answered (its next update), not until this phone's own refresh;
     if nothing comes back in 4 s the phone says so, and a tap that couldn't even leave says so at once. */
  const [waiting, setWaiting] = useState(false);
  const [tapErr, setTapErr] = useState<string | null>(null);
  /* where the failed tap was: the message sits just under that button (above it when the button is docked at the bottom) */
  const [tapAt, setTapAt] = useState<{ top?: number; bottom?: number } | null>(null);
  const lastBtn = useRef<Element | null>(null);
  const waitRef = useRef({ on: false, key: "" }), viewKey = useRef("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(t); waitRef.current.on = false; setWaiting(false); };
    const on = () => {
      waitRef.current = { on: true, key: viewKey.current }; setWaiting(true); setTapErr(null); clearTimeout(t);
      t = setTimeout(() => { if (waitRef.current.on) { stop(); window.dispatchEvent(new Event("qmb:late")); setTapErr("The TV didn't get that. Tap again."); } }, 4000);
    };
    const place = () => {
      const r = lastBtn.current?.isConnected ? lastBtn.current.getBoundingClientRect() : null;
      if (!r) return setTapAt(null);
      setTapAt(window.innerHeight - r.bottom > 90 ? { top: r.bottom + 8 } : { bottom: window.innerHeight - r.top + 8 });
    };
    const failed = (e: Event) => {
      stop(); place();
      const said = (e as CustomEvent<string>).detail;
      setTapErr(!said || /^No connection/.test(said) ? "No connection. Tap again." : said);
    };
    const tapped = (e: Event) => { const b = (e.target as Element | null)?.closest?.("button"); if (b) lastBtn.current = b; };
    const late = () => { place(); };
    document.addEventListener("pointerdown", tapped, true);
    document.addEventListener("keydown", tapped, true);
    window.addEventListener("qmb:late", late);
    window.addEventListener("qmb:sent", on);
    window.addEventListener("qmb:failed", failed);
    return () => {
      window.removeEventListener("qmb:sent", on); window.removeEventListener("qmb:failed", failed); window.removeEventListener("qmb:late", late);
      document.removeEventListener("pointerdown", tapped, true); document.removeEventListener("keydown", tapped, true); clearTimeout(t);
    };
  }, []);
  useEffect(() => { if (!tapErr) return; const t = setTimeout(() => setTapErr(null), 6000); return () => clearTimeout(t); }, [tapErr]);

  useEffect(() => { void ensureSession().then(setMe); }, []);
  const report = usePresence(code, me);
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
    try { const r = await fn(); if (typeof r === "string" && r !== "ok") setMsg(friendly(r)); await refresh(); }
    catch (e) { if (!(e as { announced?: boolean }).announced) setMsg(friendly(e)); }
    setBusy(false);
  }
  const pickTeam = (t: 0 | 1 | null) => act(() => rpc<string>("qmb_update_me", { r: code, nm: mine?.name ?? "", tm: t }));
  const self = useRef(0);                              // when I last changed my own role
  const claim = (want: "captain" | "host" | "player") => { self.current = Date.now(); return act(() => rpc<string>("qmb_claim", { r: code, want })); };
  const move = (m: Member, to: 0 | 1) => act(async () => {
    const { error } = await sb().from("members").update({ team: to, role: "player" }).eq("room", code).eq("user_id", m.user_id);
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
    if (!mine || mine.team == null || !name) return;
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
  /* the TV's reply has landed: the game moved on (a new update from the TV, or the game started) */
  viewKey.current = `${room?.status}|${pub?.at ?? ""}`;
  useEffect(() => {
    if (waitRef.current.on && viewKey.current !== waitRef.current.key) { waitRef.current.on = false; setWaiting(false); setTapErr(null); }
  }, [room?.status, pub?.at]);
  useEffect(() => { noteTvTime(pub?.at); }, [pub?.at]);
  /* an old copy of the app (left open across a deploy) reloads when nothing is being answered */
  useFreshBuild(!pub || (!ANSWERING.includes(pub.screen) && !pub.deadline && !pub.pending && !pub.lifeline));
  /* the night is over and somebody tapped Exit: everyone back to the home screen */
  useEffect(() => { if (pub?.exit) router.replace("/"); }, [pub?.exit, router]);
  const secret = useSecret(code, !!mine && mine.role === "host" && playing);
  /* a question is live on this phone: leaving the screen now gets flagged on the TV */
  const live = !!pub && !!mine && mine.role !== "host" && ANSWERING.includes(pub.screen) && !pub.paused
    && !(pub.lifeline?.key === "friend" && pub.lifeline.team === mine.team);
  useAwayWatch(report, live, pub?.qid);
  const sendMove = (move: Record<string, unknown>) => act(() => sendAction(code, "judge", { move, step: pub?.step }));
  /* quick taps (+1, Undo, pausing a call): straight out, the buttons never wait for them */
  const fireMove = (move: Record<string, unknown>) => { void sendAction(code, "judge", { move, step: pub?.step }).catch(() => { /* the phone already says so */ }); };

  if (!room || !mine) return <main className="screen justify-center items-center gap-4" aria-busy="true"><div className="spinner" /><div className="eyebrow">Finding your seat…</div></main>;

  const myCaptain = mine.team != null ? members.find((m) => m.team === mine.team && m.role === "captain") : null;
  const who = starter(members);
  const canStart = who?.user_id === me;
  const ready = readyToStart(members);

  return (
    <main className="screen">
      {waiting && <div className="sending" role="progressbar" aria-label="Sending to the TV" />}
      {tapErr && <div className="fixed left-4 right-4 enter text-center font-bold rounded-[16px]" role="alert" data-taperr
        style={{ zIndex: 50, ...(tapAt ?? { top: "calc(12px + env(safe-area-inset-top))" }), fontSize: 15, padding: "12px 16px", background: "#2a0d16", border: "1px solid var(--color-no)", color: "#ffd5dc",
          boxShadow: "0 12px 30px rgba(0,0,0,.6)" }}>{tapErr}</div>}
      {pub?.screen === "final" && !panel && <Confetti n={60} />}
      <header className="flex items-center justify-between">
        <span className="chip"><span className="face">{mine.avatar || "🙂"}</span>{mine.name}</span>
        <span className="eyebrow whitespace-nowrap">{room.status === "lobby" ? `Room ${code}` : code}</span>
        <div className="flex gap-2">
          {room.status !== "lobby"
            ? <button className="btn btn-sm btn-ghost" aria-expanded={panel} onClick={() => setPanel(!panel)}>{panel ? "Back" : mine.role === "host" ? "Players" : "Team Members"}</button>
            : <button className="btn btn-sm btn-ghost" onClick={leave} aria-label="Leave the room">Leave</button>}
        </div>
      </header>

      {/* the lobby: the logo, small, while everyone waits */}
      {room.status === "lobby" && <div className="logo text-center pointer-events-none select-none -mt-1" style={{ fontSize: 34 }} aria-hidden>Quiz Me Baby</div>}

      {note && <p className="text-center text-[14px] font-bold enter" role="status" style={{ color: "var(--color-gold)" }}>{note}</p>}

      {pub?.tvAway && room.status !== "lobby" && (
        <p className="text-center text-[14px] font-bold enter" role="status" style={{ color: "var(--color-gold)" }}>
          The TV has gone to sleep or out of sight. Everything is paused until it&rsquo;s back.</p>)}

      {/* the tracker, as on the TV: scores, where we are, the night's progress */}
      {room.status !== "lobby" && pub && !panel && (mine.team != null || mine.role === "host") && <Hud pub={pub} size="phone" />}

      {room.status !== "lobby" ? (
        /* joined after the start: pick a side first */
        mine.team == null && mine.role !== "host" ? (
          <section className="flex flex-col gap-3 enter">
            <h1 className="display text-[40px] text-center">Pick a side</h1>
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
            {mine.role === "host" && <AwayLog pub={pub} />}
            <button className="btn btn-gold btn-block" onClick={() => setPanel(false)}>Back to the game</button>
            {/* leaving is kept away from everyday buttons, and asks first */}
            <button className="btn btn-sm btn-ghost self-center mt-6" style={{ color: "var(--color-no)", borderColor: "color-mix(in srgb, var(--color-no) 45%, transparent)" }} onClick={leave}>Leave the game</button>
          </section>
        ) : !pub ? (
          <section className="card text-center enter flex-1 grid place-items-center">
            <div><div className="eyebrow">Game on</div><h1 className="display text-[44px] mt-2">Eyes on the TV</h1></div>
          </section>
        ) : mine.role === "host" ? <HostGame pub={pub} secret={secret} send={sendMove} fire={fireMove} busy={busy || waiting} />
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
          <h1 className="display text-[44px] text-center">Pick a side</h1>
          <button className="btn btn-a btn-lg" disabled={busy} onClick={() => pickTeam(0)}>{teamName(room, 0)}</button>
          <button className="btn btn-b btn-lg" disabled={busy} onClick={() => pickTeam(1)}>{teamName(room, 1)}</button>
          <div className="h-2" />
          {!host && <button className="btn btn-block" disabled={busy} onClick={() => claim("host")}>I&rsquo;m the host</button>}
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
              <div className="flex items-baseline justify-between"><label className="field-label !mb-0" htmlFor="tname">Name your team</label>
                <span className="text-[12px] text-[var(--color-ink-3)] tabular-nums" aria-live="polite">{(draft ?? teamName(room, mine.team)).length}/18</span></div>
              {/* a form, so the keyboard's Done/Go saves it too; Save keeps the keyboard's focus so the tap never misses */}
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveTeamName(); }}>
                <input id="tname" className="input" maxLength={18} enterKeyHint="done" autoComplete="off" value={draft ?? teamName(room, mine.team)}
                  onChange={(e) => { setDraft(e.target.value); setNameState(null); }} onFocus={(e) => e.currentTarget.select()} />
                <button type="submit" className="btn shrink-0" onPointerDown={(e) => e.preventDefault()}
                  disabled={busy || nameState === "saving" || !(draft ?? "").trim() || (draft ?? "").trim() === teamName(room, mine.team)}>{nameState === "saving" ? "Saving…" : "Save"}</button>
              </form>
              {nameState === "saved" && <p className="text-[13px] font-bold" role="status" style={{ color: "var(--color-ok)" }}>Saved. It&rsquo;s on the TV.</p>}
              {nameState === "late" && <p className="field-error" role="alert">The TV didn&rsquo;t pick it up. Is the TV screen still open? Try again.</p>}
              <button className="btn btn-sm btn-ghost self-start" disabled={busy} onClick={() => claim("player")}>Step down</button>
            </div>
          ) : myCaptain ? (
            <p className="text-center text-[16px] text-[var(--color-ink-2)] py-2"><b style={{ color: "var(--color-ink)" }}><bdi>{myCaptain.name}</bdi></b> is your captain</p>
          ) : (
            <button className="btn btn-gold btn-block" disabled={busy} onClick={() => claim("captain")}>Make me captain</button>
          )}
          <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => pickTeam(mine.team === 0 ? 1 : 0)}>Switch to {teamName(room, mine.team === 0 ? 1 : 0)}</button>
        </section>
      )}

      {msg && <p className="field-error text-center">{msg}</p>}

      {rules && room.status === "lobby" && (
        <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="How to play">
          <div className="screen !max-w-[720px]">
            <header className="flex items-end justify-between gap-3">
              <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>How to Play</div><h1 className="display text-[40px]">How the night works</h1></div>
              <button className="btn btn-sm btn-ghost" onClick={() => setRules(false)}>Back</button>
            </header>
            <p className="text-[13px] text-[var(--color-ink-2)] -mt-2">Times below are the defaults; the TV&rsquo;s Settings can change them.</p>
            <Rules />
            <button className="btn btn-gold btn-lg btn-block" onClick={() => setRules(false)}>Back to the lobby</button>
          </div>
        </div>)}

      {room.status === "lobby" && (
        <footer className="mt-auto flex flex-col gap-2">
          <button type="button" className="self-center text-[14px] font-bold underline underline-offset-4 text-[var(--color-ink-2)] min-h-[44px] px-3" onClick={() => setRules(true)}>How to play</button>
          {canStart ? (
            <Setup ready={ready} why={notReadyWhy(members)} busy={busy} isHost={mine.role === "host"} onStart={(cfg) => act(() => sendAction(code, "setup", { start: true, cfg }))} />
          ) : (
            <p className="text-center text-[14px] text-[var(--color-ink-2)]">
              You&rsquo;re in.{" "}
              {host && who?.user_id === host.user_id ? <>Hosted by <b style={{ color: "var(--color-gold)" }}><bdi>{host.name}</bdi></b>, who starts the game.</>
                : <>{host && <>Hosted by <b style={{ color: "var(--color-gold)" }}><bdi>{host.name}</bdi></b>. </>}{who ? <><b style={{ color: "var(--color-gold)" }}><bdi>{who.name}</bdi></b> starts the game.</> : "The host, or Team A's captain, starts the game."}</>}
              <br /><span className="text-[12px] text-[var(--color-ink-3)]">Heads up: leaving this screen during a question (another app, a search) is flagged on the TV.</span>
            </p>
          )}
        </footer>
      )}
    </main>
  );
}
