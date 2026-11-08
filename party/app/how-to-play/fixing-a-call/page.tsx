import Link from "next/link";
import { FixingACall } from "@/components/Rules";
import { MqPage, MqTop } from "@/components/Marquee";

/* when things go wrong, in the owner's words (8 Nov): don't reword, propose the exact change first */
export default function FixingACallPage() {
  return (
    <MqPage wide>
      <MqTop href="/how-to-play" eyebrow="How to play" title="When things go wrong" />
      <p className="text-15 text-[var(--color-ink-2)] -mt-2">Disagree with an answer? Need to change a score? Someone&rsquo;s phone died? Here&rsquo;s how to sort things out and keep the game moving.</p>
      <FixingACall standalone />
      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game.</Link>
    </MqPage>
  );
}
