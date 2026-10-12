"use client";
import { useEffect, useState } from "react";
import type { Pub } from "@/lib/game";
import { Clock } from "./Clock";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");

/* The TV during the game: no buttons, no answers before the reveal. */
export function TvGame({ pub }: { pub: Pub }) {
  const T = pub.teams;
  /* a pop-up shows for three seconds, then goes */
  const [shown, setShown] = useState<number | null>(null);
  const tid = pub.toast?.id ?? null;
  useEffect(() => { if (tid == null) return; setShown(tid); const t = setTimeout(() => setShown(null), 3000); return () => clearTimeout(t); }, [tid]);
  return (
    <div className="flex flex-col h-full">
      {/* the scores, always */}
      <div className="flex items-center justify-between">
        {[0, 1].map((t) => (
          <div key={t} className={"flex items-center gap-4 " + (t === 1 ? "flex-row-reverse" : "")}>
            <div className="display text-[34px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
            <div className="display text-[64px]">{T[t].score}</div>
          </div>
        ))}
      </div>
      <div className="eyebrow text-center text-[16px] -mt-6">{pub.screen === "final" ? "Final" : pub.screen === "sudden" ? "Sudden death" : `Round ${Math.min(pub.r + 1, pub.N)} of ${pub.N}`}</div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 enter" key={pub.screen + pub.r + (pub.turn ?? "")}>
        {pub.screen === "roundIntro" && (<>
          <div className="eyebrow text-[20px]">Theme</div>
          <div className="display" style={{ fontSize: 130, color: "var(--color-gold)" }}>{pub.theme}</div>
          <div className="text-[28px] text-[var(--color-ink-2)]"><b style={{ color: tc(pub.first) }}>{T[pub.first ?? 0].name}</b> answers first</div>
          <div className="flex gap-4">{[0, 1].map((t) => pub.dbl?.[t] ? <span key={t} className="chip" style={{ fontSize: 20, color: tc(t as 0 | 1) }}>⭐ {T[t].name}: double points</span> : null)}</div>
        </>)}

        {(pub.screen === "ask" || pub.screen === "steal") && (<>
          <div className="display" style={{ fontSize: 40, color: tc(pub.turn) }}>{pub.screen === "steal" ? "Steal! " : ""}{T[pub.turn ?? 0].name}{pub.screen === "ask" ? " answers" : ""}</div>
          <div className="font-bold max-w-[1000px]" style={{ fontSize: (pub.question || "").length > 110 ? 40 : 52, lineHeight: 1.15 }}>{pub.question}</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={150} />
        </>)}

        {pub.screen === "answer" && pub.result && (<>
          <div className="text-[28px] text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
          <div className="eyebrow text-[18px]">The answer</div>
          <div className="display" style={{ fontSize: 96, color: "var(--color-gold)" }}>{pub.result.answer}</div>
          {pub.result.notes && <div className="text-[22px] text-[var(--color-ink-2)] max-w-[900px]">{pub.result.notes}</div>}
          <div className="display text-[44px]" style={{ color: tc(pub.result.by) }}>
            {pub.result.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? " — stolen!" : ""}`}
          </div>
        </>)}

        {pub.screen === "roundScore" && (<>
          <div className="eyebrow text-[20px]">End of round {pub.r + 1}</div>
          <div className="flex gap-24">{[0, 1].map((t) => (
            <div key={t}><div className="display text-[40px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
              <div className="display text-[120px]">{T[t].score}</div>
              <div className="text-[24px] text-[var(--color-ink-2)]">+{pub.roundPts?.[t] ?? 0} this round</div></div>))}
          </div>
        </>)}

        {pub.screen === "sudden" && pub.sudden && (!pub.sudden.ready ? (<>
          <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>Sudden death</div>
          <div className="text-[28px] text-[var(--color-ink-2)] max-w-[900px]">Scores are level. One question, captains only — first hand up answers. First right answer wins the night.</div>
        </>) : (<>
          <div className="eyebrow text-[20px]">Sudden death · question {pub.sudden.n}</div>
          <div className="font-bold text-[52px] max-w-[1000px] leading-tight">{pub.question}</div>
          {pub.sudden.shown && <div className="display text-[80px]" style={{ color: "var(--color-gold)" }}>{pub.sudden.answer}</div>}
        </>))}

        {pub.screen === "final" && (<>
          <div className="eyebrow text-[22px]">The winner</div>
          <div className="display" style={{ fontSize: 150, color: tc(pub.winner) }}>{pub.winner == null ? "A draw" : T[pub.winner].name}</div>
          <div className="display text-[60px]">{T[0].score} – {T[1].score}</div>
        </>)}
      </div>

      {pub.lifeline && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", backdropFilter: "blur(12px)", zIndex: 20 }}>
          <div className="text-center">
            <div className="eyebrow text-[20px]">Lifeline · {T[pub.lifeline.team].name}</div>
            <div className="display mt-3" style={{ fontSize: 110, color: "var(--color-gold)" }}>{pub.lifeline.key === "friend" ? "Calling a friend" : "Double Dip"}</div>
            {pub.lifeline.key === "friend" && <div className="mt-6 grid place-items-center"><Clock deadline={pub.lifeline.deadline} size={150} timeUp={!pub.lifeline.deadline} /></div>}
            {pub.lifeline.key === "dip" && <div className="text-[28px] text-[var(--color-ink-2)] mt-4">Two answers this time. Either one right counts.</div>}
          </div>
        </div>
      )}
      {pub.toast && shown === pub.toast.id && <div key={pub.toast.id} className="enter absolute left-1/2 bottom-8 -translate-x-1/2 chip" style={{ fontSize: 22, padding: "12px 26px" }}>{pub.toast.text}</div>}
    </div>
  );
}
