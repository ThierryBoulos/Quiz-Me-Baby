"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureSession, rpc } from "@/lib/supabase";
import { friendly } from "@/lib/errors";

/* A new laptop takes over as the TV (29 Oct, B9): the room code and the 6-digit code from the host's phone.
   The server makes this device the room's TV and hands back the TV's last save; the TV page picks it up
   from there exactly as it does after a reload. */
export default function TakeOver() {
  const router = useRouter();
  const [room, setRoom] = useState(""), [code, setCode] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      await ensureSession();
      const r = await rpc<{ ok?: boolean; room?: string; save?: unknown; error?: string }>("qmb_take_tv", { r: room.trim().toUpperCase(), c: code.trim() });
      if (!r?.ok || !r.room) throw new Error(r?.error || "bad_code");
      try { localStorage.setItem("qmb.tv." + r.room + ".game", JSON.stringify(r.save)); } catch { /* the TV page asks the room instead */ }
      router.push("/tv/" + r.room);
    } catch (e) { setErr(friendly(e)); setBusy(false); }
  };
  return (
    <main className="screen !max-w-[520px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>The TV died?</div><h1 className="display text-40">Take over as the TV</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/join">Back</Link>
      </header>
      <p className="text-15 text-[var(--color-ink-2)]">On the host&rsquo;s phone: <b>their name (top left) → The TV died? → Get a code</b>. Type it here with the room code, and this laptop becomes the TV. The night carries on where the old TV last saved it.</p>
      <label className="field-label" htmlFor="room">Room code</label>
      <input id="room" className="input !text-22 uppercase tracking-[.2em]" maxLength={4} value={room} onChange={(e) => setRoom(e.target.value)} placeholder="ABCD" autoComplete="off" />
      <label className="field-label" htmlFor="tvcode">The host&rsquo;s 6-digit code</label>
      <input id="tvcode" className="input !text-22 tracking-[.3em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoComplete="off" />
      <button className="btn btn-gold btn-lg btn-block" disabled={busy || room.trim().length !== 4 || code.length !== 6} onClick={() => void go()}>{busy ? "Taking over…" : "Become the TV"}</button>
      {err && <p className="text-14" style={{ color: "var(--color-bad)" }} role="alert">{err}</p>}
    </main>);
}
