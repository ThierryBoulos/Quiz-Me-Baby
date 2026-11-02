import Link from "next/link";
import { FixingACall } from "@/components/Rules";
import { MqPage, MqTop } from "@/components/Marquee";

/* the manual for when something needs changing: contests, agreements, corrections, dead phones */
export default function FixingACallPage() {
  return (
    <MqPage wide>
      <MqTop href="/how-to-play" eyebrow="How to play" title="Fixing a call" />
      <p className="text-13 text-[var(--color-ink-2)] -mt-2">A call that went wrong, a question nobody wants, scores to put right, a phone that died: who taps what, and what happens if they don&rsquo;t.</p>
      <FixingACall standalone />
      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </MqPage>
  );
}
