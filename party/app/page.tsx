"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureSession, rpc } from "@/lib/supabase";
import { cleanCode } from "@/lib/room";

/* HOME — one big button. PLAY turns this device into the TV and opens a room;
   the mode (with a host, without, or Classic on this screen) sorts itself out
   from who joins. A phone that opened the site by hand gets the code box. */
export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function play() {
    setBusy(true); setErr(null);
    try {
      await ensureSession();
      const c = await rpc<string>("qmb_create_room");
      router.push("/tv/" + c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="screen justify-between text-center">
      <div className="flex flex-col items-center gap-3 pt-10 enter">
        <div className="eyebrow">Party night</div>
        <h1 className="display text-[64px] leading-[0.9]" style={{ color: "var(--color-gold)" }}>Quiz Me<br />Baby</h1>
        <p className="text-[15px] text-[var(--color-ink-2)] max-w-[30ch]">The TV is the show. Your phone is the buzzer.</p>
      </div>

      <div className="flex flex-col gap-4">
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={play}>{busy ? "Opening the room…" : "PLAY"}</button>
        <p className="text-[13px] text-[var(--color-ink-3)]">Tap PLAY on the screen everyone can see.</p>
        {err && <p className="field-error">{err}</p>}
      </div>

      <form className="card flex flex-col gap-3 text-left" onSubmit={(e) => { e.preventDefault(); if (code.length === 4) router.push("/join?code=" + code); }}>
        <label className="field-label !mb-0" htmlFor="code">Got a code?</label>
        <div className="flex gap-2">
          <input id="code" className="input input-code !text-[28px] !min-h-[52px]" value={code} placeholder="ABCD"
            autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(cleanCode(e.target.value))} />
          <button className="btn" disabled={code.length !== 4} type="submit">Join</button>
        </div>
      </form>
    </main>
  );
}
