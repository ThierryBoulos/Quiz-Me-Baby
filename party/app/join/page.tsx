"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FacePicker } from "@/components/Face";
import { FACES } from "@/lib/faces";
import { cap1, cleanCode } from "@/lib/room";
import { ensureSession, rpc } from "@/lib/supabase";
import { friendly } from "@/lib/errors";

/* JOIN — SNAKED's one screen: room code, name, a face, "Take my seat".
   Errors sit beside the thing that's wrong; a taken name offers a fix. */
function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(cleanCode(params.get("code") ?? ""));
  const [name, setName] = useState("");
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
      if (state === "done") { setCodeErr(friendly("game_over")); setBusy(false); return; }
      if (state === "gone") { setCodeErr(friendly("no_room")); setBusy(false); return; }
      /* the server seats one phone at a time and hands out the next free face if this one just went */
      const res = await rpc<{ ok?: boolean; error?: string; suggestion?: string; playing?: boolean; face?: string }>("qmb_join", { r: code, nm: cap1(useName.trim()), face });
      if (res.error === "no_room" || res.error === "game_over") { setCodeErr(friendly(res.error)); setBusy(false); return; }
      if (res.error === "name_taken") { setSuggest(res.suggestion ?? null); setCanRejoin(!!res.playing); setBusy(false); return; }
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

  return (
    <main className="screen justify-between" onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) void join(name); }}>
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 min-h-[44px] pr-3 text-[var(--color-ink-2)] text-[14px] font-bold">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back</Link>
        <div className="eyebrow">Join a game</div>
        <span className="w-10" />
      </div>
      <div>
        <div className="flex items-baseline justify-between min-h-[18px]">
          <label className="field-label !mb-0" htmlFor="room-code">Room code</label>
          {codeErr && <span className="field-error">{codeErr}</span>}
        </div>
        <div className="h-2" />
        <input id="room-code" className="input input-code" value={code} placeholder="Enter 4-letter code" autoComplete="off"
          autoCapitalize="characters" autoFocus={code.length === 0}
          onChange={(e) => { setCode(cleanCode(e.target.value)); setCodeErr(null); }} />
      </div>
      <div>
        <div className="flex items-baseline justify-between"><label className="field-label" htmlFor="name">Name</label>
          <span className="text-[12px] text-[var(--color-ink-3)] tabular-nums" aria-live="polite">{name.length}/12</span></div>
        <input id="name" className="input" value={name} maxLength={12} placeholder="Enter your name" autoComplete="off"
          autoFocus={code.length === 4} onChange={(e) => { setName(e.target.value); setSuggest(null); setCanRejoin(false); }} />
      </div>
      <div>
        <div className="field-label">Pick a face</div>
        <FacePicker value={face} taken={taken} onPick={setFace} />
      </div>
      {suggest && (
        <button disabled={busy} onClick={() => { setName(suggest); void join(suggest); }}
          className="flex items-center gap-3 w-full text-left rounded-[18px] px-4 py-3.5"
          style={{ background: "rgba(245,197,24,.09)", border: "1px solid rgba(245,197,24,.4)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          <span className="flex-1 text-[14.5px] font-bold">
            <span className="text-[var(--color-ink-3)]">{name} is already at this table — </span>
            <span style={{ color: "var(--color-gold)" }}>{suggest}?</span>
          </span>
        </button>
      )}
      {suggest && canRejoin && (
        <button disabled={busy} onClick={() => void rejoin()} className="btn btn-block">I&rsquo;m {name.trim()}: take my seat back</button>
      )}
      {err && <p className="field-error not-italic">{err}</p>}
      <button className="btn btn-gold btn-lg btn-block" disabled={!ready || busy} onClick={() => join(name)}>
        {busy ? "Taking your seat…" : "Take my seat"}
      </button>
    </main>
  );
}
export default function JoinPage() { return <Suspense><JoinForm /></Suspense>; }
