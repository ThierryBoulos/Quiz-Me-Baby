import Link from "next/link";
import { FixingACall } from "@/components/Rules";

/* the manual for when something needs changing: contests, agreements, corrections, dead phones */
export default function FixingACallPage() {
  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>How to Play</div><h1 className="display text-40">Fixing a call</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/how-to-play">Back</Link>
      </header>
      <p className="text-13 text-[var(--color-ink-2)] -mt-2">A call that went wrong, a question nobody wants, scores to put right, a phone that died: who taps what, and what happens if they don&rsquo;t.</p>
      <FixingACall standalone />
      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </main>
  );
}
