"use client";
import { useEffect, useState } from "react";
import type { Pub } from "@/lib/game";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { BattleAnswer, BattleHalf, flagText } from "./PhoneGame";
import { AskHead, battleNeeds, Confetti, decidedCall, decidedHead, decidedSub, recapLines, silent, tieCall, tieHead, FlagImg, Hud, LifelineStrip, MiniIntro, RoundIntro, ScoreBoard, Verdict } from "./GameParts";
import { DECIDED, offBy, showNum, TIE_SCREENS } from "@/lib/game";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");

/* The TV during the game: no buttons (but Exit at the very end), no answers before the reveal. */
export function TvGame({ pub, onExit, onAgain }: { pub: Pub; onExit?: () => void; onAgain?: () => void }) {
  const T = pub.teams;
  /* the end: celebrate the winner first, then the recap comes up under it */
  const [recap, setRecap] = useState(false);
  useEffect(() => { if (pub.screen !== "final") { setRecap(false); return; } const t = setTimeout(() => setRecap(true), 7000); return () => clearTimeout(t); }, [pub.screen]);
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
          <div className="h-7 text-22 font-bold" style={{ color: tc(pub.turn) }}>{pub.sent?.[pub.turn ?? 0] ? `${T[pub.turn ?? 0].name} has answered…` : ""}</div>
        </>)}

        {pub.screen === "answer" && pub.result && (<>
          <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
          <div className="eyebrow text-18">The answer</div>
          <div className="display" style={{ fontSize: 96, color: "var(--color-gold)" }}>{pub.result.answer}</div>
          {/* the fun fact goes with the answer */}
          {pub.result.notes && <div className="text-22 text-[var(--color-ink-2)] max-w-[900px] -mt-2">{pub.result.notes}</div>}
          {/* what each team said, and the app's call on it (contestable until Next) */}
          {(pub.calls || []).map((c) => <div key={c.id} className="text-24 flex items-baseline gap-3 justify-center"><b style={{ color: tc(c.team) }}>{T[c.team].name}{c.note === "steal" ? " (steal)" : c.note ? ` (${c.note})` : ""}:</b> {c.text || "no answer"} <Verdict v={c.ok} size={20} /></div>)}
          {[0, 1].map((t) => !(pub.calls || []).some((c) => c.team === t) && silent(pub, t as 0 | 1) ? <div key={t} className="text-24 text-[var(--color-ink-2)]"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {silent(pub, t as 0 | 1)}</div> : null)}
          <div className="display text-44" style={{ color: pub.result.by == null ? "var(--color-ink-2)" : tc(pub.result.by) }}>
            {pub.result.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? " — stolen!" : ""}`}
          </div>
        </>)}

        {pub.screen === "roundScore" && (<>
          <div className="eyebrow text-20">End of round {pub.r + 1}</div>
          <div className="flex gap-24">{[0, 1].map((t) => (
            <div key={t}><div className="display text-40" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
              <div className="display text-120">{T[t].score}</div>
              <div className="text-24 text-[var(--color-ink-2)]">+{pub.roundPts?.[t] ?? 0} this round</div></div>))}
          </div>
        </>)}

        {pub.screen === "sudden" && pub.sudden && (!pub.sudden.ready ? (<>
          <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>Sudden death</div>
          <div className="text-28 text-[var(--color-ink-2)] max-w-[900px]">Scores are level. One question, captains only — first hand up answers. First right answer wins the night.</div>
        </>) : (<>
          <div className="eyebrow text-20">Sudden death · question {pub.sudden.n}</div>
          <div className="font-bold text-52 max-w-[1000px] leading-tight">{pub.question}</div>
          <Buzzed pub={pub} />
          {pub.sudden.shown && <div className="display text-80" style={{ color: "var(--color-gold)" }}>{pub.sudden.answer}</div>}
          <SdCalls pub={pub} />
        </>))}

        <TvMini pub={pub} />

        {pub.screen === "final" && (<>
          <Confetti n={140} />
          <div className="eyebrow text-22">{pub.winner == null ? "The night ends" : "The winner"}</div>
          <div className="display" style={{ fontSize: recap ? 100 : 150, color: tc(pub.winner), transition: "font-size .6s ease" }}>{pub.winner == null ? "A draw" : T[pub.winner].name}</div>
          {/* once the recap is up, the big score board gives way to one line (the scores stay in the top bar too) */}
          {recap ? (
            <div className="display leading-none" style={{ fontSize: 72 }} aria-label={`${T[0].name} ${T[0].score}, ${T[1].name} ${T[1].score}`}>
              <span style={{ color: "var(--color-a)" }}>{T[0].score}</span><span className="text-[var(--color-ink-3)]"> – </span><span style={{ color: "var(--color-b)" }}>{T[1].score}</span>
            </div>
          ) : <ScoreBoard pub={pub} w={[T[0].score, T[1].score]} win={pub.winner} size="tv" />}
          {(!recap || pub.contest) && <SdCalls pub={pub} />}
          {recap && recapLines(pub).length > 0 && (
            <div className="card enter text-left max-w-[1000px]" style={{ position: "relative", zIndex: 60 }}>
              <div className="eyebrow text-18 mb-2" style={{ color: "var(--color-gold)" }}>The night in a nutshell</div>
              <ul className="flex flex-col gap-1.5 text-26">{recapLines(pub).map((l) => <li key={l}>{l}</li>)}</ul>
            </div>)}
          {(pub.flags?.length ?? 0) > 0 && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px]">Left the game screen during a question: {awayTotals(pub)}</div>}
          <div className="flex gap-3" style={{ position: "relative", zIndex: 70 }}>
            {onAgain && <button className="btn btn-sm" onClick={onAgain}>Play again: same teams</button>}
            {onExit && <button className="btn btn-sm btn-ghost" onClick={onExit}>Exit: everyone back to the home screen</button>}
          </div>
        </>)}
        {pub.contest && <ContestBanner pub={pub} />}
      </div>

      {pub.lifeline && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", backdropFilter: "blur(12px)", zIndex: 20 }}>
          <div className="text-center">
            <div className="eyebrow text-20">Lifeline · {T[pub.lifeline.team].name}</div>
            <div className="display mt-3" style={{ fontSize: 110, color: "var(--color-gold)" }}>{pub.lifeline.key === "friend" ? "Calling a friend" : "Double Dip"}</div>
            {pub.lifeline.key === "friend" && <div className="mt-6 grid place-items-center"><Clock deadline={pub.lifeline.deadline} left={pub.lifeline.left} size={150} timeUp={!pub.lifeline.deadline && !pub.lifeline.left} /></div>}
            {pub.lifeline.wait && <div className="text-28 text-[var(--color-ink-2)] mt-4">Dialling… the clock starts when the call does.</div>}
            {pub.lifeline.key === "dip" && <div className="text-28 text-[var(--color-ink-2)] mt-4">Two answers this time. Either one right counts.</div>}
          </div>
        </div>
      )}
      {pub.paused && !pub.lifeline && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(4,5,14,.97)", backdropFilter: "blur(12px)", zIndex: 20 }}>
          <div className="text-center">
            <div className="display" style={{ fontSize: 140, color: "var(--color-gold)" }}>Paused</div>
            <div className="text-26 text-[var(--color-ink-2)] mt-2">The question comes back when the clock restarts.</div>
          </div>
        </div>)}
      {pub.nextBy && !pub.contest && <NextHint pub={pub} />}
      <AwayFlags pub={pub} />
      <ImadBubble imad={pub.imad} />
      {pub.toast && shown === pub.toast.id && <div key={pub.toast.id} className="enter absolute left-1/2 bottom-8 -translate-x-1/2 chip" role="status" aria-live="polite" style={{ fontSize: 24, padding: "12px 28px" }}>{pub.toast.text}</div>}
    </div>
  );
}

const pointsEach = (n: number) => `${n} point${n === 1 ? "" : "s"} each`;
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };

/* who buzzed, and who is out (Guess the Cocktail or Dish, sudden death) */
function Buzzed({ pub }: { pub: Pub }) {
  const T = pub.teams;
  if (pub.buzz != null) return <div className="display text-60 enter" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed!</div>;
  const out = [0, 1].filter((t) => pub.out?.[t]);
  return <div className="h-10 text-24 text-[var(--color-ink-2)]">{out.map((t) => `${T[t].name} is out of this one`).join(" · ")}</div>;
}

function Sent({ pub }: { pub: Pub }) {
  const T = pub.teams;
  return (
    <div className="flex gap-10" role="status">{[0, 1].map((t) => (
      <span key={t} className="font-bold" style={{ fontSize: 22, color: pub.sent?.[t] ? tc(t as 0 | 1) : "var(--color-ink-3)" }}>
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
      <div className="text-26 text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
      <div className="eyebrow text-18">The answer</div>
      <div className="display" style={{ fontSize: 110, color: "var(--color-gold)" }}>{pub.reveal.answer}</div>
      {pub.reveal.notes && <div className="text-22 text-[var(--color-ink-2)] max-w-[900px] -mt-2">{pub.reveal.notes}</div>}
      <div className="flex gap-20">{[0, 1].map((t) => { const gss = pub.reveal?.guesses?.[t]; return (
        <div key={t} style={{ opacity: w === t || w === "tie" ? 1 : 0.55 }}>
          <div className="display text-30" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
          <div className="display text-70">{gss == null ? "—" : showNum(gss)}</div>
          <div className="text-20 text-[var(--color-ink-2)]">{gss == null ? "No answer" : `Off by ${showNum(offBy(gss, ans))}`}</div>
        </div>); })}</div>
      <div className="display text-44" style={{ color: tc(w === 0 || w === 1 ? w : null) }}>{w === "tie" ? "A point each" : w === 0 || w === 1 ? `${T[w].name} takes it` : ""}</div>
    </>);
  }
  if ((sc === "flagQ" || sc === "flagReveal") && pub.flag) return (<>
    <FlagImg name={pub.flag} h={sc === "flagQ" ? 300 : 220} maxW={520} />
    {sc === "flagQ" ? (<><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} /><Sent pub={pub} /></>) : (<>
      <div className="display" style={{ fontSize: 90, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
      <TeamRows pub={pub} empty="No answer" />
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
            <div className="display text-44" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}?</div>
            <div className="text-22 text-[var(--color-ink-2)]"><b>{pub.dish.ings.length}</b> of {pub.dish.n} ingredients</div>
            <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
            <Buzzed pub={pub} />
            {/* the buzzer's own clock to type it */}
            {pub.dish.typeBy && pub.buzz != null && <div className="flex items-center gap-4 text-24"><Clock deadline={pub.dish.typeBy} size={80} /><span>to type it</span></div>}
          </>) : (<>
            <div className="display" style={{ fontSize: 76, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
            {(pub.calls || []).map((c) => <div key={c.id} className="text-22 flex items-baseline gap-2"><b style={{ color: tc(c.team) }}>{T[c.team].name}:</b> {c.text || "no answer"} <Verdict v={c.ok} size={18} /></div>)}
            <div className="display text-36" style={{ color: tc(pub.reveal?.w === 0 || pub.reveal?.w === 1 ? pub.reveal.w : null) }}>
              {pub.reveal?.w === 0 || pub.reveal?.w === 1 ? `${T[pub.reveal.w].name} got it` : "Nobody got it"}</div>
          </>)}
        </div>
      </div>);
  }
  if ((sc === "mapQ" || sc === "mapReveal") && pub.map) return (
    <div className="flex gap-10 items-center w-full" style={{ fontSize: 22 }}>
      <div className="flex-1 min-w-0"><MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={480} title={pub.map.title} /></div>
      <div className="w-[340px] flex flex-col items-center gap-4">
        {sc === "mapQ" ? (<>
          <div className="display text-40" style={{ color: "var(--color-gold)" }}>What does this map show?</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
          <Sent pub={pub} />
        </>) : (<>
          <div className="eyebrow text-16">The map shows</div>
          <div className="display text-40" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>
          <TeamRows pub={pub} empty="No answer" small />
        </>)}
      </div>
    </div>);
  if (sc === DECIDED && pub.decided) return (<>
    <div className="eyebrow text-20">{m.title}</div>
    <div className="display" style={{ fontSize: 100, color: tc(pub.decided.winner) }}>{decidedHead(pub)}</div>
    <div className="text-30">{decidedSub(pub)}</div>
    <div className="text-26 text-[var(--color-ink-2)]">{decidedCall(pub)}</div>
  </>);
  if (TIE_SCREENS.includes(sc)) return (<>
    <div className="eyebrow text-20">{m.title}</div>
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>{tieHead(pub)}</div>
    <div className="text-28 text-[var(--color-ink-2)]">{tieCall(pub)}</div>
  </>);
  if (pub.auction && /^auction(Bid|Run|Leg|Result)$/.test(sc)) {
    const A = pub.auction;
    if (sc === "auctionBid") return (<>
      <div className="eyebrow text-20">Category</div>
      <div className="display max-w-[1100px]" style={{ fontSize: 76, color: "var(--color-gold)", lineHeight: 1.05 }}>{A.cat}</div>
      <div className="display text-60">{A.bid ? <>Bid: {A.bid} <span style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</span></> : "No bid yet"}</div>
      <div className="text-28" style={{ color: tc(A.turn) }}><b>{T[A.turn].name}</b>: raise{A.bid ? " or pass" : ""}</div>
      <div className="text-24 text-[var(--color-ink-2)]">Whoever wins the bid has <b>{pub.timers?.auction ?? 30} seconds</b> to name them.</div>
    </>);
    if (sc === "auctionRun") return (<>
      <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display text-44" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}!</div>
      <div className="display" style={{ fontSize: 170, lineHeight: 1 }}>{A.count}<span className="text-[var(--color-ink-3)]" style={{ fontSize: 80 }}> / {A.bid}</span></div>
      <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
      {A.countedBy && <div className="text-22 text-[var(--color-ink-2)]">Counted by <b>{A.countedBy}</b></div>}
    </>);
    if (sc === "auctionLeg" && A.last) return (<>
      <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display" style={{ fontSize: 90, color: A.last.made ? "var(--color-ok)" : "var(--color-no)" }}>{A.last.made ? "Delivered!" : "Short!"}</div>
      <div className="text-30">{T[A.last.by].name} bid {A.last.bid}, named {A.last.count}.</div>
      <div className="display text-48" style={{ color: tc(A.last.won) }}>{T[A.last.won].name} take{A.last.won === A.last.by ? "" : "s"} the leg</div>
    </>);
    if (sc === "auctionResult") return (<>
      <div className="eyebrow text-20">The Auction</div>
      <ScoreBoard pub={pub} w={A.wins} win={A.winner} size="tv" />
      {A.winner != null && <div className="display text-52" style={{ color: tc(A.winner) }}>{T[A.winner].name} +{A.award?.[A.winner] ?? m.pts}</div>}
    </>);
  }
  if (sc === "sayQ") return (<>
    <div className="eyebrow text-20">Don&rsquo;t Say the Same as Me</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 56, lineHeight: 1.1 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
    <Sent pub={pub} />
  </>);
  if (sc === "sayReveal" && pub.reveal) return (<>
    <div className="text-26 text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
    <div className="eyebrow text-18">The app&rsquo;s word</div>
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>{pub.reveal.answer}</div>
    <TeamRows pub={pub} say empty="Nothing" />
    <div className="display text-40" style={{ color: tc(pub.reveal.w === 0 || pub.reveal.w === 1 ? pub.reveal.w : null) }}>{pub.reveal.w === "tie" ? "A point each" : pub.reveal.w === 0 || pub.reveal.w === 1 ? `${T[pub.reveal.w].name} take the leg` : ""}</div>
  </>);
  if (pub.battle && sc === "battleQ") { const B = pub.battle; return (<>
    <div className="display text-40" style={{ color: tc(B.cap) }}>{T[B.cap].name}&rsquo;s captain</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: (pub.question || "").length > 100 ? 42 : 54, lineHeight: 1.12 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
    <div className="display text-36"><span style={{ color: tc(0) }}>{B.score[0]}</span> – <span style={{ color: tc(1) }}>{B.score[1]}</span></div>
    {B.last && <BattleAnswer last={B.last} size={24} prev />}
  </>); }
  if (pub.battle && sc === "battleHandoff") return (<>
    <div className="eyebrow text-20">Halfway</div>
    <div className="display" style={{ fontSize: 100, color: tc(1) }}>{T[1].name}&rsquo;s captain, you&rsquo;re up</div>
    <div className="text-30">{T[0].name} scored <b>{pub.battle.score[0]}</b> out of {pub.battle.n}. {battleNeeds(pub)}</div>
    {pub.battle.half?.length ? <div className="w-[1320px] max-w-full"><BattleHalf half={pub.battle.half} size={24} cols={2} /></div>
      : pub.battle.last && <BattleAnswer last={pub.battle.last} size={24} />}
  </>);
  if (pub.battle && sc === "battleTie") return (<>
    <div className="eyebrow text-20">Tie at {pub.battle.score[0]}. Tie-breaker{pub.battle.tb && pub.battle.tb > 1 ? ` ${pub.battle.tb}` : ""}: first captain to buzz</div>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 52, lineHeight: 1.12 }}>{pub.question}</div>
    {(pub.deadline || (pub.left ?? 0) > 0) && <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={110} />}
    <Buzzed pub={pub} />
    {pub.battle.last && <BattleAnswer last={pub.battle.last} size={24} prev />}
    <SdCalls pub={pub} />
  </>);
  if (pub.battle && sc === "battleReview") { const B = pub.battle, calls = pub.calls || []; return (<>
    <div className="eyebrow text-20">Battle of the Captains · captains, contest any call on your phone, then settle it</div>
    <div className="display text-52"><span style={{ color: tc(0) }}>{B.score[0]}</span> – <span style={{ color: tc(1) }}>{B.score[1]}</span></div>
    <div className="flex gap-16 text-left">{([0, 1] as const).map((t) => (
      <div key={t} className="flex flex-col gap-1 min-w-[420px]">
        <div className="display text-28" style={{ color: tc(t) }}>{T[t].name}</div>
        {calls.filter((c) => c.team === t).map((c) => <div key={c.id} className="text-20 flex items-baseline gap-3"><span className="text-[var(--color-ink-3)] w-6">{c.note}</span><span className="flex-1 truncate">{c.text || "no answer"}</span><Verdict v={c.ok} size={16} /></div>)}
      </div>))}</div>
  </>); }
  if (pub.battle && sc === "battleSummary") { const B = pub.battle; return (<>
    {B.last && <BattleAnswer last={B.last} size={24} />}
    <div className="eyebrow text-20">Battle of the Captains</div>
    <ScoreBoard pub={pub} w={B.score} win={B.winner} size="tv" />
    <div className="display text-52" style={{ color: tc(B.winner) }}>{B.winner == null ? (B.note || "Tie") : `${T[B.winner].name} +${B.award?.[B.winner] ?? m.pts}`}</div>
    <SdCalls pub={pub} />
  </>); }

  if (/Summary$/.test(sc) && pub.summary) {
    const S = pub.summary;
    return (<>
      <div className="eyebrow text-20">{m.title}</div>
      <ScoreBoard pub={pub} w={S.wins} win={S.winner} size="tv" />
      <div className="display text-52" style={{ color: tc(S.winner) }}>
        {S.needsHost ? "Still level: the host decides" : S.winner == null ? pointsEach(S.award?.[0] ?? 0) : `${T[S.winner].name} +${S.award?.[S.winner] ?? m.pts}`}</div>
      {S.note && !/^split/i.test(S.note) && <div className="text-22 text-[var(--color-ink-2)]">{S.note}</div>}
    </>);
  }
  return null;
}

/* each team's ruling, then what they wrote under it: "TEAM A  DODGED IT" / "Mcdo" */
function TeamRows({ pub, say, empty, small }: { pub: Pub; say?: boolean; empty: string; small?: boolean }) {
  const T = pub.teams;
  return (
    <div className={"flex justify-center " + (small ? "gap-8" : "gap-20")}>{([0, 1] as const).map((t) => { const ok = pub.reveal?.ok?.[t], x = pub.reveal?.typed?.[t]?.[0]; return (
      <div key={t} className="flex flex-col items-center gap-1 min-w-0">
        <div className="flex items-baseline gap-3 whitespace-nowrap" style={{ fontSize: small ? 22 : 30 }}>
          <span className="display" style={{ color: tc(t) }}>{T[t].name}</span>
          {ok == null ? null : <Verdict v={ok} say={say} />}
        </div>
        <div className="font-bold" style={{ fontSize: small ? 20 : 28, color: x ? undefined : "var(--color-ink-3)" }}>{x ?? empty}</div>
        {say && pub.reveal?.offList?.[t] && !ok && <div className="text-[var(--color-ink-2)]" style={{ fontSize: small ? 16 : 20 }}>Not on the list</div>}
      </div>); })}
    </div>);
}

/* a call being contested: who says what, and who decides (with no host, the time left before the app's call stands) */
/* sudden death / the tie-breaker: the question just decided, each answer and the app's call on it
   (a captain can contest one on their phone) */
function SdCalls({ pub }: { pub: Pub }) {
  const C = pub.calls || [], T = pub.teams;
  if (!C.length || !["final", "sudden", "battleTie", "battleSummary"].includes(pub.screen)) return null;
  return (
    <div className="text-22 flex flex-wrap gap-x-8 gap-y-1 justify-center items-baseline max-w-[1300px]">
      <span className="eyebrow text-16">{C[0].note === "last question" ? "Last question" : "How it was won"}</span>
      {C.map((c) => <span key={c.id} className="flex items-baseline gap-2"><b style={{ color: tc(c.team) }}>{T[c.team].name}:</b> {c.text || "no answer"} <Verdict v={c.ok} size={16} /></span>)}
    </div>);
}

function ContestBanner({ pub }: { pub: Pub }) {
  const T = pub.teams, K = pub.contest!, left = useSecondsLeft(K.until), nohost = pub.mode === "nohost";
  const say = pub.screen === "sayReveal", word = (ok: boolean) => (say ? (ok ? "DODGED IT" : "SAID IT") : ok ? "RIGHT" : "WRONG");
  const decider = nohost ? pub.captains?.[K.by === 0 ? 1 : 0] || "The other captain" : "The host";
  return (
    <div className="card enter text-24 max-w-[1300px]" style={{ borderColor: "var(--color-gold)", position: "relative", zIndex: 26 }} role="status">
      <div className="eyebrow text-16 mb-1" style={{ color: "var(--color-gold)" }}>Contested</div>
      <b style={{ color: tc(K.by) }}>{T[K.by].name}</b> say {K.team !== K.by ? <><b style={{ color: tc(K.team) }}>{T[K.team].name}</b>&rsquo;s </> : null}&ldquo;{K.text}&rdquo; was <b>{word(!K.ok)}</b>. <b>{decider}</b> decides{nohost ? <span className="text-[var(--color-ink-2)]"> · {left} s</span> : null}.
    </div>);
}
/* who left the game screen during this question, in red, bottom left, until the question changes */
function AwayFlags({ pub }: { pub: Pub }) {
  const now = (pub.flags || []).filter((f) => f.qid && f.qid === pub.qid);
  if (!now.length || pub.screen === "final") return null;
  return (
    <div className="absolute left-8 bottom-8 flex items-center gap-3 rounded-full px-5 py-2.5 text-18 font-bold" role="status"
      style={{ background: "rgba(255,85,102,.16)", border: "1px solid rgba(255,85,102,.55)", color: "var(--color-no)", zIndex: 25 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></svg>
      Flagged: {now.map(flagText).join(", ")}
    </div>);
}
/* the night's tally: who left the game screen, and how often */
function awayTotals(pub: Pub) {
  const by: Record<string, number> = {};
  (pub.flags || []).forEach((f) => { by[f.name] = (by[f.name] || 0) + 1; });
  return Object.entries(by).map(([n, c]) => `${n} ${c === 1 ? "once" : c + " times"}`).join(", ");
}

/* no host: whose tap the room is waiting for (after a while, either captain's) */
function NextHint({ pub }: { pub: Pub }) {
  const open = useAfter(pub.nextOpenAt);
  const label = /Intro$|^roundIntro$/.test(pub.screen) || pub.screen === "battleHandoff" ? "Start" : pub.screen === "sudden" ? "Go" : "Next";
  return <div className="absolute right-8 bottom-8 text-18 text-[var(--color-ink-2)]">Waiting for <b>{pub.nextBy}</b>{open && pub.nextOther ? <> or <b>{pub.nextOther}</b></> : null} to {TIE_SCREENS.includes(pub.screen) || pub.screen === DECIDED ? "choose" : `tap ${label}`}</div>;
}

/* Imad's line: his face and a speech bubble, up top, for as long as it takes to read (Classic's #hostBubble) */
function ImadBubble({ imad }: { imad?: Pub["imad"] }) {
  const [on, setOn] = useState<number | null>(null);
  const id = imad?.id ?? null, len = imad?.text.length ?? 0;
  useEffect(() => { if (id == null) return; setOn(id); const t = setTimeout(() => setOn(null), 2800 + len * 60); return () => clearTimeout(t); }, [id, len]);
  if (!imad || on !== imad.id) return null;
  return (
    <div className="imad-bubble" role="status" aria-live="polite" key={imad.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/imad.webp" alt="" />
      <div className="hb-text">{imad.text}</div>
    </div>);
}
