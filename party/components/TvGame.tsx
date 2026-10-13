"use client";
import { useEffect, useState } from "react";
import type { Pub } from "@/lib/game";
import { Clock, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { AskHead, Hud, LifelineStrip, MiniIntro, RoundIntro } from "./GameParts";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");

/* The TV during the game: no buttons, no answers before the reveal. */
export function TvGame({ pub }: { pub: Pub }) {
  const T = pub.teams;
  /* a pop-up shows for three seconds, then goes */
  const [shown, setShown] = useState<number | null>(null);
  const tid = pub.toast?.id ?? null;
  useEffect(() => { if (tid == null) return; setShown(tid); const t = setTimeout(() => setShown(null), 3000); return () => clearTimeout(t); }, [tid]);
  return (
    /* nothing on the TV can be selected or copied */
    <div className="flex flex-col h-full noselect" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {/* the tracker, always: Classic's HUD */}
      <Hud pub={pub} size="tv" />

      <div className={"flex-1 flex flex-col items-center justify-center text-center enter " + (pub.screen === "ask" || pub.screen === "steal" ? "gap-4 spot rounded-[32px] " + (pub.turn === 1 ? "b" : "a") : "gap-6")} key={pub.screen + pub.r + (pub.turn ?? "")}>
        {pub.screen === "roundIntro" && <div className="w-full max-w-[1080px]"><RoundIntro pub={pub} size="tv" /></div>}

        {(pub.screen === "ask" || pub.screen === "steal") && (<>
          <AskHead pub={pub} size="tv" />
          <div className="font-bold max-w-[1000px]" style={{ fontSize: (pub.question || "").length > 110 ? 36 : 46, lineHeight: 1.15 }}>{pub.question}</div>
          <div className="flex items-center gap-8">
            <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
            {pub.screen === "ask" && <div className="w-[560px]"><LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="tv" /></div>}
          </div>
          <div className="h-7 text-[22px] font-bold" style={{ color: tc(pub.turn) }}>{pub.sent?.[pub.turn ?? 0] ? `${T[pub.turn ?? 0].name} has answered…` : ""}</div>
        </>)}

        {pub.screen === "answer" && pub.result && (<>
          <div className="text-[28px] text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
          <div className="eyebrow text-[18px]">The answer</div>
          <div className="display" style={{ fontSize: 96, color: "var(--color-gold)" }}>{pub.result.answer}</div>
          {[0, 1].map((t) => pub.result?.typed?.[t] ? <div key={t} className="text-[24px]"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name} said:</b> {pub.result.typed[t]!.join(" / ")}</div> : null)}
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
          <Buzzed pub={pub} />
          {pub.sudden.shown && <div className="display text-[80px]" style={{ color: "var(--color-gold)" }}>{pub.sudden.answer}</div>}
        </>))}

        <TvMini pub={pub} />

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
      {pub.paused && !pub.lifeline && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", backdropFilter: "blur(12px)", zIndex: 20 }}>
          <div className="text-center">
            <div className="display" style={{ fontSize: 140, color: "var(--color-gold)" }}>Paused</div>
            <div className="text-[26px] text-[var(--color-ink-2)] mt-2">The question comes back when the clock restarts.</div>
          </div>
        </div>)}
      {pub.pending && <Pending pub={pub} />}
      {pub.nextBy && !pub.pending && <div className="absolute right-8 bottom-8 text-[18px] text-[var(--color-ink-2)]">Waiting for <b>{pub.nextBy}</b> to tap {/Intro$|^roundIntro$/.test(pub.screen) || pub.screen === "battleHandoff" ? "Start" : pub.screen === "sudden" ? "Go" : "Next"}</div>}
      <ImadBubble imad={pub.imad} />
      {pub.toast && shown === pub.toast.id && <div key={pub.toast.id} className="enter absolute left-1/2 bottom-8 -translate-x-1/2 chip" role="status" aria-live="polite" style={{ fontSize: 24, padding: "12px 28px" }}>{pub.toast.text}</div>}
    </div>
  );
}

const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };

/* who buzzed, and who is out (Cocktail or Dish, sudden death) */
function Buzzed({ pub }: { pub: Pub }) {
  const T = pub.teams;
  if (pub.buzz != null) return <div className="display text-[56px] enter" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed!</div>;
  const out = [0, 1].filter((t) => pub.out?.[t]);
  return <div className="h-10 text-[24px] text-[var(--color-ink-2)]">{out.map((t) => `${T[t].name} is out of this one`).join(" · ")}</div>;
}

function Sent({ pub }: { pub: Pub }) {
  const T = pub.teams;
  return (
    <div className="flex gap-6">{[0, 1].map((t) => (
      <span key={t} className="chip" style={{ fontSize: 22, padding: "10px 22px", color: pub.sent?.[t] ? tc(t as 0 | 1) : "var(--color-ink-3)" }}>
        {T[t].name}: {pub.sent?.[t] ? "locked in" : "thinking…"}</span>))}
    </div>);
}

/* the mini-games on the TV */
function TvMini({ pub }: { pub: Pub }) {
  const T = pub.teams, m = pub.mini, sc = pub.screen;
  if (!m) return null;
  if (/Intro$/.test(sc)) return (<>
    <div className="w-full max-w-[1080px]"><MiniIntro pub={pub} size="tv" /></div>
  </>);
  if (sc === "miniQ") return (<>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 50, lineHeight: 1.15 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={150} />
    <Sent pub={pub} />
  </>);
  if (sc === "closestReveal" && pub.reveal) {
    const ans = Number(pub.reveal.answer), w = pub.reveal.w;
    return (<>
      <div className="text-[26px] text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
      <div className="eyebrow text-[18px]">The answer</div>
      <div className="display" style={{ fontSize: 110, color: "var(--color-gold)" }}>{pub.reveal.answer}</div>
      <div className="flex gap-20">{[0, 1].map((t) => { const gss = pub.reveal?.guesses?.[t]; return (
        <div key={t} style={{ opacity: w === t || w === "tie" ? 1 : 0.55 }}>
          <div className="display text-[30px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
          <div className="display text-[70px]">{gss ?? "—"}</div>
          <div className="text-[20px] text-[var(--color-ink-2)]">{gss == null ? "no answer" : `off by ${Math.abs(gss - ans)}`}</div>
        </div>); })}</div>
      <div className="display text-[44px]" style={{ color: tc(w === 0 || w === 1 ? w : null) }}>{w === "tie" ? "A point each" : w === 0 || w === 1 ? `${T[w].name} takes it` : ""}</div>
    </>);
  }
  if ((sc === "flagQ" || sc === "flagReveal") && pub.flag) return (<>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/flags/${pub.flag}.svg`} alt="The flag" className="rounded-[12px] shadow-2xl" style={{ height: sc === "flagQ" ? 300 : 220, maxWidth: 520, objectFit: "contain", background: "rgba(255,255,255,.04)" }} />
    {sc === "flagQ" ? (<><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} /><Sent pub={pub} /></>) : (<>
      <div className="display" style={{ fontSize: 90, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
      <div className="flex gap-16">{[0, 1].map((t) => (
        <div key={t}><div className="display text-[28px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
          <div className="text-[30px] font-bold">{pub.reveal?.typed?.[t]?.[0] ?? "—"} <span style={{ color: pub.reveal?.ok?.[t] ? "var(--color-ok)" : "var(--color-no)" }}>{pub.reveal?.ok?.[t] ? "right" : "wrong"}</span></div></div>))}</div>
    </>)}
  </>);
  if ((sc === "dishQ" || sc === "dishReveal") && pub.dish) {
    const long = pub.dish.n > 8;
    return (
      <div className="flex gap-14 items-center">
        <ol className="text-left grid gap-2" style={{ fontSize: long ? 22 : 28, minWidth: 560 }}>
          {pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return (
            <li key={i} className="enter flex gap-4 items-baseline"><span className="font-bold">{name}</span>{qty && <span className="text-[var(--color-ink-2)]" style={{ fontSize: "0.8em" }}>{qty}</span>}</li>); })}
        </ol>
        <div className="flex flex-col items-center gap-4 min-w-[340px]">
          {sc === "dishQ" ? (<>
            <div className="display text-[44px]" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}?</div>
            <div className="text-[22px] text-[var(--color-ink-2)]"><b>{pub.dish.ings.length}</b> of {pub.dish.n} ingredients</div>
            <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
            <Buzzed pub={pub} />
          </>) : (<>
            <div className="display" style={{ fontSize: 76, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
            {[0, 1].map((t) => pub.reveal?.typed?.[t] ? <div key={t} className="text-[22px]"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {pub.reveal.typed[t]![0]}</div> : null)}
            <div className="display text-[36px]" style={{ color: tc(pub.reveal?.w === 0 || pub.reveal?.w === 1 ? pub.reveal.w : null) }}>
              {pub.reveal?.w === 0 || pub.reveal?.w === 1 ? `${T[pub.reveal.w].name} got it` : "Nobody got it"}</div>
          </>)}
        </div>
      </div>);
  }
  if ((sc === "mapQ" || sc === "mapReveal") && pub.map) return (
    <div className="flex gap-10 items-center w-full" style={{ fontSize: 22 }}>
      <div className="flex-1 min-w-0"><MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={480} /></div>
      <div className="w-[340px] flex flex-col items-center gap-4">
        {sc === "mapQ" ? (<>
          <div className="display text-[40px]" style={{ color: "var(--color-gold)" }}>What does this map show?</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
          <Sent pub={pub} />
        </>) : (<>
          <div className="eyebrow text-[16px]">The map shows</div>
          <div className="display text-[38px]" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>
          {[0, 1].map((t) => { const ok = pub.map?.ruled?.[t]; return (
            <div key={t} className="text-[20px]"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {pub.reveal?.typed?.[t]?.[0] ?? "nothing"}{" "}
              <span style={{ color: ok == null ? "var(--color-ink-3)" : ok ? "var(--color-ok)" : "var(--color-no)" }}>{ok == null ? (pub.mode === "nohost" ? `· ${T[t === 0 ? 1 : 0].name} rules` : "") : ok ? "· right" : "· wrong"}</span></div>); })}
        </>)}
      </div>
    </div>);
  if (sc === "mapTie") return (<>
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>Level at {m.wins[0]} each</div>
    <div className="text-[28px] text-[var(--color-ink-2)]">Another map to settle it, or a point each.</div>
  </>);
  if (pub.auction && /^auction(Bid|Run|Leg|Result)$/.test(sc)) {
    const A = pub.auction;
    if (sc === "auctionBid") return (<>
      <div className="eyebrow text-[20px]">Category</div>
      <div className="display max-w-[1100px]" style={{ fontSize: 76, color: "var(--color-gold)", lineHeight: 1.05 }}>{A.cat}</div>
      <div className="display text-[60px]">{A.bid ? <>Bid: {A.bid} <span style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</span></> : "No bid yet"}</div>
      <div className="text-[28px]" style={{ color: tc(A.turn) }}><b>{T[A.turn].name}</b>: raise{A.bid ? " or pass" : ""}</div>
    </>);
    if (sc === "auctionRun") return (<>
      <div className="text-[28px] text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display text-[44px]" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}!</div>
      <div className="display" style={{ fontSize: 170, lineHeight: 1 }}>{A.count}<span className="text-[var(--color-ink-3)]" style={{ fontSize: 80 }}> / {A.bid}</span></div>
      <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
    </>);
    if (sc === "auctionLeg" && A.last) return (<>
      <div className="text-[28px] text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display" style={{ fontSize: 90, color: A.last.made ? "var(--color-ok)" : "var(--color-no)" }}>{A.last.made ? "Delivered!" : "Short!"}</div>
      <div className="text-[30px]">{T[A.last.by].name} bid {A.last.bid}, named {A.last.count}.</div>
      <div className="display text-[48px]" style={{ color: tc(A.last.won) }}>{T[A.last.won].name} take{A.last.won === A.last.by ? "" : "s"} the leg</div>
    </>);
    if (sc === "auctionResult") return (<>
      <div className="eyebrow text-[20px]">The Auction</div>
      <div className="display" style={{ fontSize: 120 }}>{A.wins[0]} – {A.wins[1]}</div>
      {A.winner != null && <div className="display text-[54px]" style={{ color: tc(A.winner) }}>{T[A.winner].name} +{A.award?.[A.winner] ?? m.pts}</div>}
    </>);
  }
  if (sc === "sayQ") return (<>
    <div className="eyebrow text-[20px]">Don&rsquo;t say the same as me</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 56, lineHeight: 1.1 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
    <Sent pub={pub} />
  </>);
  if (sc === "sayReveal" && pub.reveal) return (<>
    <div className="text-[26px] text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
    <div className="eyebrow text-[18px]">The app&rsquo;s word</div>
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>{pub.reveal.answer}</div>
    <div className="flex gap-16">{[0, 1].map((t) => (
      <div key={t}><div className="display text-[28px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
        <div className="text-[30px] font-bold">{pub.reveal?.typed?.[t]?.[0] ?? "nothing"} <span style={{ color: pub.reveal?.ok?.[t] ? "var(--color-ok)" : "var(--color-no)" }}>{pub.reveal?.ok?.[t] ? "dodged it" : "said it"}</span></div></div>))}</div>
    <div className="display text-[40px]" style={{ color: tc(pub.reveal.w === 0 || pub.reveal.w === 1 ? pub.reveal.w : null) }}>{pub.reveal.w === "tie" ? "A point each" : pub.reveal.w === 0 || pub.reveal.w === 1 ? `${T[pub.reveal.w].name} take the leg` : ""}</div>
  </>);
  if (pub.battle && sc === "battleQ") { const B = pub.battle; return (<>
    <div className="display text-[40px]" style={{ color: tc(B.cap) }}>{T[B.cap].name}&rsquo;s captain</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: (pub.question || "").length > 100 ? 42 : 54, lineHeight: 1.12 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
    <div className="display text-[34px]"><span style={{ color: tc(0) }}>{B.score[0]}</span> – <span style={{ color: tc(1) }}>{B.score[1]}</span></div>
    {B.last && <div className="text-[20px] text-[var(--color-ink-2)]">Last one: <b>{B.last.answer}</b> <span style={{ color: B.last.got ? "var(--color-ok)" : "var(--color-no)" }}>{B.last.got ? "right" : "wrong"}</span></div>}
  </>); }
  if (pub.battle && sc === "battleHandoff") return (<>
    <div className="eyebrow text-[20px]">Halfway</div>
    <div className="display" style={{ fontSize: 100, color: tc(1) }}>{T[1].name}&rsquo;s captain, you&rsquo;re up</div>
    <div className="text-[30px]">{T[0].name} scored <b>{pub.battle.score[0]}</b> out of {pub.battle.n}. Beat it.</div>
  </>);
  if (pub.battle && sc === "battleTie") return (<>
    <div className="eyebrow text-[20px]">Level at {pub.battle.score[0]}. Tie-breaker{pub.battle.tb && pub.battle.tb > 1 ? ` ${pub.battle.tb}` : ""}: first captain to buzz</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 52, lineHeight: 1.12 }}>{pub.question}</div>
    {pub.deadline && <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={110} />}
    <Buzzed pub={pub} />
  </>);
  if (pub.battle && sc === "battleSummary") { const B = pub.battle; return (<>
    <div className="eyebrow text-[20px]">Battle of the Captains</div>
    <div className="display" style={{ fontSize: 120 }}>{B.score[0]} – {B.score[1]}</div>
    <div className="display text-[54px]" style={{ color: tc(B.winner) }}>{B.winner == null ? (B.note || "Level") : `${T[B.winner].name} +${B.award?.[B.winner] ?? m.pts}`}</div>
  </>); }
  if (sc === "dishTie") return (<>
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>Level at {m.wins[0]} each</div>
    <div className="text-[28px] text-[var(--color-ink-2)]">One more to settle it, or a point each — the host decides.</div>
  </>);
  if (/Summary$/.test(sc) && pub.summary) {
    const S = pub.summary;
    return (<>
      <div className="eyebrow text-[20px]">{m.title}</div>
      <div className="display" style={{ fontSize: 120 }}>{S.wins[0]} – {S.wins[1]}</div>
      <div className="display text-[54px]" style={{ color: tc(S.winner) }}>
        {S.needsHost ? "Still level — the host decides" : S.winner == null ? `Split — ${S.award?.[0] ?? 0} each` : `${T[S.winner].name} +${S.award?.[S.winner] ?? m.pts}`}</div>
      {S.note && <div className="text-[22px] text-[var(--color-ink-2)]">{S.note}</div>}
    </>);
  }
  return null;
}

/* no host: what the captain sent, the app's verdict, and the other captain's window to overrule */
function Pending({ pub }: { pub: Pub }) {
  const T = pub.teams, P = pub.pending!, o = P.team === 0 ? 1 : 0;
  const left = useSecondsLeft(P.until);
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.93)", zIndex: 15 }}>
      <div className="text-center enter flex flex-col items-center gap-4">
        <div className="eyebrow text-[20px]">{T[P.team].name} said</div>
        <div className="display" style={{ fontSize: 96, color: tc(P.team) }}>{P.text}</div>
        <div className="display text-[54px]" style={{ color: P.v ? "var(--color-ok)" : "var(--color-no)" }}>The app says {P.v ? "right" : "wrong"}</div>
        <div className="text-[24px] text-[var(--color-ink-2)]">{T[o].name}&rsquo;s captain can overrule · {left}</div>
      </div>
    </div>);
}
/* Imad's line: his face and a speech bubble, up top, for as long as it takes to read (Classic's #hostBubble) */
function ImadBubble({ imad }: { imad?: Pub["imad"] }) {
  const [on, setOn] = useState<number | null>(null);
  const id = imad?.id ?? null, len = imad?.text.length ?? 0;
  useEffect(() => { if (id == null) return; setOn(id); const t = setTimeout(() => setOn(null), 2800 + len * 60); return () => clearTimeout(t); }, [id, len]);
  if (!imad || on !== imad.id) return null;
  return (
    <div className="imad-bubble" role="status" aria-live="polite" key={imad.id}>
      <div className="hb-text">{imad.text}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/imad.webp" alt="" />
    </div>);
}
