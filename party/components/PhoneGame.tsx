"use client";
import { useEffect, useState } from "react";
import type { Pub, Secret } from "@/lib/game";
import type { Member } from "@/lib/room";
import { sb } from "@/lib/supabase";
import { Clock } from "./Clock";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");

/* The answer for the current question. Only the host's phone can read it —
   the database refuses everyone else, so a player can't peek even with the
   browser's developer tools. */
export function useSecret(code: string, on: boolean) {
  const [s, setS] = useState<Secret>({});
  useEffect(() => {
    if (!on) return;
    const pull = async () => { const { data } = await sb().from("secrets").select("data").eq("room", code).maybeSingle(); if (data) setS((data.data || {}) as Secret); };
    void pull();
    const ch = sb().channel("secret:" + code).on("postgres_changes", { event: "*", schema: "public", table: "secrets", filter: "room=eq." + code }, () => void pull()).subscribe();
    const t = setInterval(() => void pull(), 2500);
    return () => { clearInterval(t); void sb().removeChannel(ch); };
  }, [code, on]);
  return s;
}

type Send = (move: Record<string, unknown>) => void;

/* THE HOST'S PHONE: the answer always on top, one main button, judging only
   when there's something to judge. */
export function HostGame({ pub, secret, send, busy }: { pub: Pub; secret: Secret; send: Send; busy: boolean }) {
  const T = pub.teams, turn = pub.turn ?? 0;
  const AnswerCard = () => secret.answer ? (
    <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer — only you can see this</div>
      <div className="display text-[34px] mt-1" style={{ color: "var(--color-gold)" }}>{secret.answer}</div>
      {secret.notes && <div className="text-[13px] text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
    </div>) : null;

  if (pub.lifeline) return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="card text-center"><div className="eyebrow">Lifeline</div>
        <div className="display text-[38px]" style={{ color: "var(--color-gold)" }}>{pub.lifeline.key === "friend" ? "Call a Friend" : "Double Dip"}</div>
        {pub.lifeline.key === "friend"
          ? <p className="text-[14px] text-[var(--color-ink-2)] mt-2">Before the captain says a word, read this to the friend: &ldquo;Hi — quick quiz question. No ChatGPT, no Google, no asking anyone else. Straight off the top of your head. Ready?&rdquo;</p>
          : <p className="text-[14px] text-[var(--color-ink-2)] mt-2">The captain gets two goes at this one. Either one right counts.</p>}
        {pub.lifeline.key === "friend" && <div className="grid place-items-center mt-3"><Clock deadline={pub.lifeline.deadline} size={90} timeUp={!pub.lifeline.deadline} /></div>}
      </div>
      <p className="font-bold text-[18px]">{pub.question}</p>
      <AnswerCard />
      <button className="btn btn-gold btn-lg mt-auto" disabled={busy} onClick={() => send({ type: "ui/closeLifeline" })}>Back to the question</button>
    </div>);

  switch (pub.screen) {
    case "roundIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">Round {pub.r + 1} of {pub.N}</div>
          <div className="display text-[44px]" style={{ color: "var(--color-gold)" }}>{pub.theme}</div>
          <div className="text-[14px] text-[var(--color-ink-2)]"><b style={{ color: tc(pub.first) }}>{T[pub.first ?? 0].name}</b> answers first</div></div>
        <div className="eyebrow">Double points? Ask the captains — before the question</div>
        {[0, 1].map((t) => (
          <button key={t} className={"btn btn-block " + (pub.dbl?.[t] ? (t === 0 ? "btn-a" : "btn-b") : "")} disabled={busy || !T[t].ll.dbl}
            onClick={() => send({ type: "round/armDbl", i: t })}>
            {!T[t].ll.dbl ? `${T[t].name}: double already used` : pub.dbl?.[t] ? `${T[t].name}: double armed — tap to undo` : `${T[t].name}: arm double points`}
          </button>))}
        <button className="btn btn-gold btn-lg mt-auto" disabled={busy} onClick={() => send({ type: "round/begin" })}>Start — question for {T[pub.first ?? 0].name}</button>
      </div>);
    case "ask": case "steal": {
      const used = pub.llUsed?.[turn] || [], armed = pub.dbl?.[turn];
      const llOk = (k: "friend" | "dip") => T[turn].ll[k] && !(armed && used.length >= 1);
      return (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between">
            <div className="display text-[26px]" style={{ color: tc(turn) }}>{pub.screen === "steal" ? "Steal — " : ""}{T[turn].name}</div>
            <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={64} />
          </div>
          <p className="font-bold text-[18px] leading-snug">{pub.question}</p>
          <AnswerCard />
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <button className="btn btn-lg" style={{ background: "rgba(255,85,102,.9)", color: "#2b0206", borderColor: "transparent" }} disabled={busy}
              onClick={() => send({ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: false })}>Wrong</button>
            <button className="btn btn-lg" style={{ background: "var(--color-ok)", color: "#04210f", borderColor: "transparent" }} disabled={busy}
              onClick={() => send({ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: true })}>Right</button>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {pub.deadline || pub.left ? <button className="btn btn-sm" disabled={busy} onClick={() => send({ type: "ui/pause" })}>{pub.deadline ? "Pause" : "Resume"}</button> : null}
            {pub.screen === "ask" && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => send({ type: "round/swap" })}>Change question</button>}
            {pub.screen === "ask" && llOk("friend") && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => send({ type: "round/lifeline", key: "friend", i: turn })}>Call a Friend</button>}
            {pub.screen === "ask" && llOk("dip") && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => send({ type: "round/lifeline", key: "dip", i: turn })}>Double Dip</button>}
          </div>
        </div>);
    }
    case "answer": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">The answer</div>
          <div className="display text-[38px]" style={{ color: "var(--color-gold)" }}>{pub.result?.answer}</div>
          <div className="display text-[24px] mt-2" style={{ color: tc(pub.result?.by) }}>{pub.result?.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}`}</div></div>
        <button className="btn btn-gold btn-lg mt-auto" disabled={busy} onClick={() => send({ type: "round/afterAnswer" })}>Next</button>
      </div>);
    case "roundScore": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">End of round {pub.r + 1}</div>
          <div className="display text-[44px]">{T[0].score} – {T[1].score}</div></div>
        <button className="btn btn-gold btn-lg mt-auto" disabled={busy} onClick={() => send({ type: "round/next" })}>Next</button>
      </div>);
    case "sudden": return !pub.sudden?.ready ? (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="display text-[40px]" style={{ color: "var(--color-gold)" }}>Sudden death</div>
          <p className="text-[14px] text-[var(--color-ink-2)] mt-2">One question, captains only. First hand up answers; wrong, and the other captain can have a go.</p></div>
        <button className="btn btn-gold btn-lg mt-auto" disabled={busy} onClick={() => send({ type: "sudden/go" })}>Go</button>
      </div>) : (
      <div className="flex flex-col gap-3 flex-1">
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        <div className="eyebrow mt-auto">Who got it?</div>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-a btn-lg" disabled={busy} onClick={() => send({ type: "sudden/win", w: 0 })}>{T[0].name}</button>
          <button className="btn btn-b btn-lg" disabled={busy} onClick={() => send({ type: "sudden/win", w: 1 })}>{T[1].name}</button>
        </div>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-sm" disabled={busy} onClick={() => send({ type: "sudden/win", w: "none" })}>Neither — next question</button>
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => send({ type: "sudden/swap" })}>Change question</button>
        </div>
      </div>);
    case "final": return (
      <div className="card text-center flex-1 grid place-items-center"><div>
        <div className="eyebrow">The winner</div>
        <div className="display text-[54px]" style={{ color: tc(pub.winner) }}>{pub.winner == null ? "A draw" : T[pub.winner].name}</div>
        <div className="display text-[32px]">{T[0].score} – {T[1].score}</div></div></div>);
    default: return <div className="eyebrow text-center">Eyes on the TV</div>;
  }
}

/* A PLAYER's (or captain's) phone: the question close up, no buttons yet —
   typed answers, the buzzer and suggestions arrive in step 3. */
export function PlayerGame({ pub, me }: { pub: Pub; me: Member }) {
  const T = pub.teams, mine = me.team as 0 | 1;
  const status = (() => {
    if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend" : "Double Dip — two answers") : `${T[pub.lifeline.team].name} used a lifeline`;
    if (pub.screen === "ask") return pub.turn === mine ? (me.role === "captain" ? "Your question — say your answer to the host" : "Your team's question — tell your captain") : `${T[pub.turn ?? 0].name} is answering — get ready to steal`;
    if (pub.screen === "steal") return pub.turn === mine ? (me.role === "captain" ? "Steal! Say your answer to the host" : "Steal! Tell your captain") : `${T[pub.turn ?? 0].name} can steal it`;
    if (pub.screen === "answer") return pub.result?.by == null ? "Nobody scored" : pub.result.by === mine ? `+${pub.result.pts} to your team!` : `${T[pub.result.by].name} scored`;
    if (pub.screen === "roundIntro") return `Round ${pub.r + 1}: ${pub.theme}`;
    if (pub.screen === "roundScore") return `End of round ${pub.r + 1}`;
    if (pub.screen === "sudden") return me.role === "captain" ? "Sudden death — captains only. Hand up to answer." : "Sudden death — captains only. Not a word!";
    if (pub.screen === "final") return pub.winner == null ? "It's a draw" : pub.winner === mine ? "You won the night!" : `${T[pub.winner].name} won the night`;
    return "Eyes on the TV";
  })();
  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="card text-center" style={{ borderColor: tc(pub.turn === mine && ["ask", "steal"].includes(pub.screen) ? mine : null) }}>
        <div className="font-bold text-[17px]">{status}</div>
      </div>
      {pub.question && ["ask", "steal", "answer", "sudden"].includes(pub.screen) && <p className="font-bold text-[20px] leading-snug text-center">{pub.question}</p>}
      {pub.screen === "answer" && pub.result && <div className="display text-[34px] text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
      {(pub.screen === "ask" || pub.screen === "steal") && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={110} /></div>}
      <div className="mt-auto grid grid-cols-2 gap-3">
        {[0, 1].map((t) => (
          <div key={t} className="card text-center !p-3" style={{ borderColor: tc(t as 0 | 1) }}>
            <div className="display text-[18px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
            <div className="display text-[36px]">{T[t].score}</div>
          </div>))}
      </div>
    </div>
  );
}
