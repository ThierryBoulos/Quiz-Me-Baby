import Link from "next/link";
import { Rules } from "@/components/Rules";
import { MqPage, MqTop } from "@/components/Marquee";

export default function HowToPlay() {
  return (
    <MqPage wide>
      <MqTop href="/" eyebrow="How to play" title="How the night works" />

      <p className="text-13 text-[var(--color-ink-2)] -mt-2">Times below are the defaults. Change any of them in <Link href="/settings#timers" className="underline underline-offset-4 inline-block py-3 -my-3">Settings &rarr; Timers</Link> on the screen that will be the TV.</p>

      <Rules fixing={false} />

      <section className="card flex flex-col gap-2">
        <h2 className="display text-26" style={{ color: "var(--color-gold)" }}>Something to fix?</h2>
        <p className="text-15 text-[var(--color-ink-2)]">Contesting a call, the captains agreeing to new scores or a new question, a phone that died: it&rsquo;s all on one page.</p>
        <Link className="btn btn-block" href="/how-to-play/fixing-a-call">Fixing a call</Link>
      </section>

      <Link className="btn btn-gold btn-lg btn-block" href="/">Right, start a game</Link>
    </MqPage>
  );
}
