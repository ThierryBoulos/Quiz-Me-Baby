import Link from "next/link";
import { Rules } from "@/components/Rules";
import { MqPage, MqTop } from "@/components/Marquee";

/* the owner's words (8 Nov): don't reword, propose the exact change first */
export default function HowToPlay() {
  return (
    <MqPage wide>
      <MqTop href="/" eyebrow="How to play" title="How the night works" />

      <Rules fixing={false} />

      <p className="text-15 text-[var(--color-ink-2)] text-center">Something to fix? See <Link href="/how-to-play/fixing-a-call" className="underline underline-offset-4 inline-block py-3 -my-3 font-bold text-[var(--color-ink)]">When things go wrong</Link>.</p>

      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game.</Link>
    </MqPage>
  );
}
