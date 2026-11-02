"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureSession, rpc } from "@/lib/supabase";
import { BUILD } from "@/lib/build";
import { friendly } from "@/lib/errors";
import { MqStage, SLOGAN, Sign, useLights } from "@/components/Marquee";

/* HOME — the marquee (the owner, 1 Nov): the name lit up on a theatre sign with the slogan on its letter
   board, Create game and Join a game saying what they do, How to play and Settings as quiet links, the colophon.
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

  const lights = useLights(150);
  return (
    <main className={"mq mq-home" + lights}>
      <MqStage floor />
      <h1 className="sr-only">Quiz Me Baby: quiz night done right</h1>
      <Sign slogan={SLOGAN} neon className="mq-hero">Quiz Me<br className="mq-br" /><span className="mq-sp"> </span>Baby!</Sign>
      <div className="mq-menu mq-rise">
        <button className="btn btn-gold btn-lg btn-block btn-two shine" disabled={busy} onClick={play}>
          {busy ? "Opening the room…" : <>Create game<small>This screen becomes the TV</small></>}</button>
        <Link className="btn btn-lg btn-block btn-two" href="/join">Join a game<small>Got a code? Play on your phone</small></Link>
        {err && <p className="field-error text-center" role="alert">Couldn&rsquo;t open a room. {err}</p>}
      </div>
      <div className="mq-foot mq-rise">
        <div className="mq-links"><Link href="/how-to-play"><span>How to play</span></Link><Link href="/settings"><span>Settings</span></Link></div>
        <p className="colophon">
          Built by {BUILD.author} <span className="sep">·</span> © {BUILD.year} <span className="sep">·</span> {BUILD.date} <span className="sep">·</span> {BUILD.code}
        </p>
      </div>
    </main>
  );
}
