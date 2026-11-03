"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FacePicker } from "@/components/Face";
import { FACES } from "@/lib/faces";
import { cap1, cleanCode } from "@/lib/room";
import { ensureSession, rpc } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { CodeTiles, MqStage, Sign, useLights } from "@/components/Marquee";

/* JOIN — one card in the marquee's look (the owner, 1 Nov): the room code in lit letter tiles, your name
   under it, a face, "Take my seat". Errors sit beside the thing that's wrong; a taken name offers a fix. */
/* (no TV: nobody has a TV to read a new code from) */
const GAME_OVER_NO_TV = "That game is over. Ask whoever made it for the new code.";

export function JoinForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [code, setCode] = useState(cleanCode(initial));
  const [name, setName] = useState("");
  /* The page arrives before the app does (it's drawn on the server), so the two boxes are left to the
     browser: whatever someone typed before the app loaded stays put, and is picked up here. */
  const codeRef = useRef<HTMLInputElement>(null), nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (codeRef.current && codeRef.current.value !== code) setCode(cleanCode(codeRef.current.value));
    if (nameRef.current?.value) setName(nameRef.current.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const putName = (v: string) => { setName(v); if (nameRef.current) nameRef.current.value = v; };
  const [face, setFace] = useState(FACES[0]);
  /* each phone starts on its own random face, so a room scanning the QR together doesn't all reach for the first one */
  useEffect(() => { setFace(FACES[Math.floor(Math.random() * FACES.length)]); }, []);
  const [taken, setTaken] = useState<string[]>([]);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<string | null>(null);
  const [canRejoin, setCanRejoin] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadTaken = useCallback(async () => {
    if (code.length !== 4) { setTaken([]); return []; }
    try { await ensureSession(); const t = await rpc<string[]>("qmb_taken_faces", { r: code }); setTaken(t); return t; } catch { setTaken([]); return []; }
  }, [code]);
  /* the fourth letter in: is there a game with this code? ("Found it", or what's wrong, under the tiles) */
  const [found, setFound] = useState<string | null>(null);
  /* a game with no TV (Play without TV): nothing here points at a TV (3 Nov) */
  const [noTv, setNoTv] = useState<string | null>(null);
  const tvless = noTv === code && code.length === 4;
  useEffect(() => {
    setFound(null);
    if (code.length !== 4) return;
    let live = true;
    void (async () => {
      try {
        await ensureSession();
        const [st, nt] = await Promise.all([rpc<string>("qmb_room_state", { r: code }), rpc<boolean>("qmb_room_notv", { r: code }).catch(() => false)]);
        if (!live) return;
        setNoTv(nt ? code : null);
        if (st === "done") setCodeErr(nt ? GAME_OVER_NO_TV : friendly("game_over")); else if (st === "gone") setCodeErr(friendly("no_room")); else setFound(code);
      } catch { /* offline: Take my seat says so */ }
    })();
    return () => { live = false; };
  }, [code]);
  const [codeFocus, setCodeFocus] = useState(false);
  const lights = useLights(80);
  useEffect(() => { void loadTaken(); }, [loadTaken]);
  /* don't sit on a face somebody already has */
  const freeFace = (t: string[]) => { const free = FACES.filter((f) => !t.includes(f)); return free.length ? free[Math.floor(Math.random() * free.length)] : null; };
  useEffect(() => { if (taken.includes(face)) setFace(freeFace(taken) || face); }, [taken, face]);

  async function join(useName: string) {
    setErr(null); setCodeErr(null);
    if (useName.trim().length > 12) { setErr("Names can be 1 to 12 characters."); return; }
    setBusy(true);
    try {
      await ensureSession();
      /* is this a game you can join? (an old QR on the fridge, a mistyped code) */
      const state = await rpc<string>("qmb_room_state", { r: code });
      if (state === "done") { setCodeErr(tvless ? GAME_OVER_NO_TV : friendly("game_over")); setBusy(false); return; }
      if (state === "gone") { setCodeErr(friendly("no_room")); setBusy(false); return; }
      /* the server seats one phone at a time and hands out the next free face if this one just went */
      const res = await rpc<{ ok?: boolean; error?: string; suggestion?: string; playing?: boolean; face?: string }>("qmb_join", { r: code, nm: cap1(useName.trim()), face });
      if (res.error === "no_room" || res.error === "game_over") { setCodeErr(friendly(res.error)); setBusy(false); return; }
      if (res.error === "name_taken") { setSuggest(res.suggestion ?? null); setCanRejoin(true);   /* the lobby too: a phone that died can take its seat back */ setBusy(false); return; }
      if (res.error === "face_taken") { setErr(friendly("face_taken")); void loadTaken(); setBusy(false); return; }
      if (res.error) { setErr(friendly(res.error)); setBusy(false); return; }
      if (res.face) setFace(res.face);
      router.push("/room/" + code);
    } catch (e) { setErr(friendly(e)); setBusy(false); }
  }
  /* mid-game, a taken name may be you on a new phone: take the seat back (team, captaincy and all) */
  async function rejoin() {
    setBusy(true); setErr(null);
    try {
      await ensureSession();
      const res = await rpc<{ ok?: boolean; error?: string }>("qmb_rejoin", { r: code, nm: name.trim() });
      if (res.error) { setErr(friendly(res.error)); setBusy(false); return; }
      router.push("/room/" + code);
    } catch (e) { setErr(friendly(e)); setBusy(false); }
  }
  const ready = code.length === 4 && name.trim().length > 0;

  const back = (
    <Link href="/" className="inline-flex items-center gap-1 min-h-[44px] pr-3 text-[var(--color-ink-2)] text-14 font-bold justify-self-start">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back</Link>);
  return (
    <main className={"mq mq-join" + lights} onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) void join(name); }}>
      <MqStage floor={false} />
      <div className="top">{back}<Sign size={30}>Quiz Me Baby!</Sign><span /></div>
      <Sign className="big-sign">Quiz Me Baby!</Sign>
      {/* one card: the code, your name, a face (the owner, 1 Nov: fewer screens, fewer taps; no name, no seat) */}
      <section className="card">
        <h1>Join a game</h1>
        <div>
          <div className="flex items-baseline justify-between min-h-[18px]">
            <label className="field-label !mb-0" htmlFor="room-code">Room code</label>
            {codeErr ? <span className="field-error">{codeErr}</span>
              : found === code && code.length === 4 ? <span className="text-13 font-bold" style={{ color: "var(--color-ok)" }}>✓ Found it</span>
              : <span className="text-12 text-[var(--color-ink-3)]">{tvless ? "The room\u2019s 4 letters" : "The 4 letters on the TV"}</span>}
          </div>
          <div className="code-box mt-2">
            <CodeTiles code={code} cur={codeFocus && code.length < 4 ? code.length : null} />
            <input id="room-code" ref={codeRef} defaultValue={code} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={8}
              aria-describedby="code-help" autoFocus={code.length === 0} onFocus={() => setCodeFocus(true)} onBlur={() => setCodeFocus(false)}
              onChange={(e) => { const v = cleanCode(e.target.value); e.target.value = v; setCode(v); setCodeErr(null); }} />
            <span id="code-help" className="sr-only">{tvless ? "Type the 4-letter room code" : "Type the 4-letter room code shown on the TV"}</span>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between"><label className="field-label" htmlFor="name">Your name</label>
            <span className="text-12 text-[var(--color-ink-3)] tabular-nums" aria-live="polite">{name.length}/12</span></div>
          <input id="name" ref={nameRef} className="input" defaultValue="" maxLength={12} placeholder="Enter your name" autoComplete="off"
            autoFocus={code.length === 4} onChange={(e) => { setName(e.target.value); setSuggest(null); setCanRejoin(false); }} />
        </div>
        <div>
          <div className="field-label">Pick a face</div>
          <FacePicker value={face} taken={taken} onPick={setFace} />
        </div>
        {suggest && (
          <button disabled={busy} onClick={() => { putName(suggest); void join(suggest); }}
            className="flex items-center gap-3 w-full text-left rounded-[18px] px-4 py-3.5"
            style={{ background: "rgba(245,197,24,.09)", border: "1px solid rgba(245,197,24,.4)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            <span className="flex-1 text-14 font-bold">
              <span className="text-[var(--color-ink-3)]">{name} is already at this table — </span>
              <span style={{ color: "var(--color-gold)" }}>{suggest}?</span>
            </span>
          </button>
        )}
        {suggest && canRejoin && (
          <button disabled={busy} onClick={() => void rejoin()} className="btn btn-block">I&rsquo;m {name.trim()}: take my seat back</button>
        )}
        {err && <p className="field-error not-italic">{err}</p>}
      </section>
      <div className="bottom">
        <button className="btn btn-gold btn-lg btn-block" disabled={!ready || busy} onClick={() => join(name)}>
          {busy ? "Taking your seat…" : "Take my seat"}
        </button>
        {/* quiet, at the very bottom: a new laptop taking over a game whose TV died */}
        {!tvless && <Link href="/take-over" className="text-12 text-center text-[var(--color-ink-3)] underline underline-offset-4 py-2">The TV died? Take over as the TV</Link>}
      </div>
    </main>
  );
}
