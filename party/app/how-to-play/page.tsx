import Link from "next/link";
import { Rules } from "@/components/Rules";

export default function HowToPlay() {
  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>How to Play</div><h1 className="display text-40">How the night works</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/">Back</Link>
      </header>

      <p className="text-13 text-[var(--color-ink-2)] -mt-2">Times below are the defaults. Change any of them in <Link href="/settings#timers" className="underline underline-offset-4 inline-block py-3 -my-3">Settings &rarr; Timers</Link> on the screen that will be the TV.</p>

      <Rules fixing={false} />

      <section className="card flex flex-col gap-2">
        <h2 className="display text-26" style={{ color: "var(--color-gold)" }}>Something to fix?</h2>
        <p className="text-15 text-[var(--color-ink-2)]">Contesting a call, the captains agreeing to new scores or a new question, a phone that died: it&rsquo;s all on one page.</p>
        <Link className="btn btn-block" href="/how-to-play/fixing-a-call">Fixing a call</Link>
      </section>

      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </main>
  );
}
