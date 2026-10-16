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

      <Rules />

      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </main>
  );
}
