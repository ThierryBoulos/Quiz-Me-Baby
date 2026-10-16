"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureSession, rpc } from "@/lib/supabase";
import { BUILD } from "@/lib/build";
import { friendly } from "@/lib/errors";

/* HOME — Classic's home screen (index.html, SCREENS.home): Imad beside the
   wordmark, a short menu, How to Play as a quiet link, the colophon.
   Create game turns this device into the TV and opens a room; whether it's hosted
   or not sorts itself out from who joins. */
export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function play() {
    setBusy(true); setErr(null);
    try {
      await ensureSession();
      const c = await rpc<string>("qmb_create_room");
      router.push("/tv/" + c);
    } catch (e) {
      setErr(friendly(e));
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="home-main">
        <div className="logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mascot" src="/imad.webp" alt="Imad, your host" draggable={false} />
          <h1 className="logo">Quiz Me<br />Baby</h1>
        </div>
        <div className="home-menu">
          <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={play}>{busy ? "Opening the room…" : "Create game"}</button>
          <Link className="btn btn-block" href="/join">Join a game</Link>
          <Link className="btn btn-ghost btn-block" href="/settings">Settings</Link>
          {err && <p className="field-error" role="alert">Couldn&rsquo;t open a room. {err}</p>}
          <Link className="howto" href="/how-to-play">How to Play</Link>
        </div>
        <p className="colophon">
          Built by {BUILD.author} <span className="sep">·</span> © {BUILD.year} <span className="sep">·</span> {BUILD.date} <span className="sep">·</span> {BUILD.code}
        </p>
      </div>
    </main>
  );
}
