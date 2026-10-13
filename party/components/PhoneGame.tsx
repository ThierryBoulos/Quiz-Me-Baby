"use client";
import { useEffect, useState } from "react";
import type { Pub, Secret } from "@/lib/game";
import type { Member } from "@/lib/room";
import { loadBank } from "@/lib/engine";
import { sb, sendAction } from "@/lib/supabase";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { AskHead, LifelineStrip, MiniIntro, RoundIntro } from "./GameParts";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };
export const ANSWERING = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "sayQ", "sudden", "battleQ", "battleTie"];
/* captains only: the players keep quiet */
const CAPTAINS_ONLY = ["sudden", "battleQ", "battleTie"];

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

/* A captain's inbox: what their own players suggest for the question on
   screen, newest first, with who said it. */
type Sug = { id: number; user_id: string; text: string };
function useSuggestions(code: string, qid: string | undefined, members: Member[], team: 0 | 1, on: boolean) {
  const [list, setList] = useState<Sug[]>([]);
  useEffect(() => {
    setList([]);
    if (!on || !qid) return;
    const pull = async () => {
      const { data } = await sb().from("actions").select("id,user_id,payload").eq("room", code).eq("kind", "suggest").eq("payload->>qid", qid).order("id", { ascending: false }).limit(30);
      setList(((data || []) as { id: number; user_id: string; payload: { text?: string } }[]).map((a) => ({ id: a.id, user_id: a.user_id, text: String(a.payload.text || "") })));
    };
    void pull();
    const ch = sb().channel("sug:" + code + ":" + qid).on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code }, () => void pull()).subscribe();
    const t = setInterval(() => void pull(), 2500);
    return () => { clearInterval(t); void sb().removeChannel(ch); };
  }, [code, qid, on]);
  return list.filter((s) => members.find((m) => m.user_id === s.user_id)?.team === team);
}

/* country names and cocktail/dish names, for the type-ahead */
function useNames() {
  const [names, setNames] = useState<{ flag: string[]; dish: string[] }>({ flag: [], dish: [] });
  useEffect(() => { void loadBank().then((b) => setNames({
    flag: [...new Set(b.bank.filter((q) => q.type === "flag").map((q) => q.answer))].sort(),
    dish: [...new Set(b.bank.filter((q) => q.type === "dish").map((q) => q.answer))].sort() })); }, []);
  return names;
}

function Flag({ name, h = 160 }: { name?: string; h?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return name ? <img src={`/flags/${name}.svg`} alt="The flag" className="rounded-[10px] mx-auto" style={{ height: h, maxWidth: "100%", objectFit: "contain" }} /> : null;
}
function Ings({ ings, small }: { ings: string[]; small?: boolean }) {
  return (
    <ol className="grid gap-1" style={{ fontSize: small || ings.length > 7 ? 14 : 16 }}>
      {ings.map((t, i) => { const [q, n] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{n}</b><span className="text-[var(--color-ink-3)] text-[0.85em]">{q}</span></li>; })}
    </ol>);
}
type Send = (move: Record<string, unknown>) => void;
/* a light vibration where the phone supports it (Android); silently nothing elsewhere */
const buzzHand = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
const btnRed = { background: "rgba(255,85,102,.9)", color: "#2b0206", borderColor: "transparent" };
const btnGreen = { background: "var(--color-ok)", color: "#04210f", borderColor: "transparent" };

/* THE HOST'S PHONE: the answer always on top, one main button, judging only
   when there's something to judge. */
export function HostGame({ pub, secret: raw, send, busy }: { pub: Pub; secret: Secret; send: Send; busy: boolean }) {
  const T = pub.teams, turn = pub.turn ?? 0;
  /* only trust the secret when it belongs to this very screen: the question
     and the answer travel separately, and the answer must never be the last one */
  const fresh = !pub.qid || (raw.qid === pub.qid && (raw.step ?? 0) >= pub.step);
  const secret: Secret = fresh ? raw : {};
  const loading = !!pub.qid && !fresh;
  const Main = ({ label, move }: { label: string; move: Record<string, unknown> }) =>
    <button className="btn btn-gold btn-lg btn-block mt-auto" disabled={busy} onClick={() => send(move)}>{label}</button>;
  const AnswerCard = () => loading ? <div className="card text-center text-[14px] text-[var(--color-ink-3)]">Getting the answer…</div> : secret.answer ? (
    <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer, only you can see this</div>
      <div className="display text-[32px] mt-1" style={{ color: "var(--color-gold)" }}>{secret.answer}</div>
      {secret.notes && <div className="text-[13px] text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
    </div>) : null;
  /* what a captain typed, with the app's opinion — the host still decides */
  const Typed = ({ t }: { t: 0 | 1 }) => {
    const x = secret.typed?.[t];
    if (loading) return null;
    if (!x) return <div className="card text-center text-[14px] text-[var(--color-ink-3)]">Waiting for {T[t].name}&rsquo;s captain to type…</div>;
    const m = secret.match?.[t];
    return (
      <div className="card">
        <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name} typed</div>
        <div className="font-bold text-[22px]">{x.join("  /  ")}</div>
        <div className="text-[13px] mt-1" style={{ color: m ? "var(--color-ok)" : "var(--color-ink-3)" }}>{m ? "The app thinks that's right" : "The app doesn't recognise it — your call"}</div>
      </div>);
  };
  const Judge = ({ right, wrong }: { right: Record<string, unknown>; wrong: Record<string, unknown> }) => (
    <div className="grid grid-cols-2 gap-3 mt-auto">
      <button className="btn btn-lg" style={btnRed} disabled={busy || loading} onClick={() => send(wrong)}>Wrong</button>
      <button className="btn btn-lg" style={btnGreen} disabled={busy || loading} onClick={() => send(right)}>Right</button>
    </div>);
  const Small = ({ label, move, ghost }: { label: string; move: Record<string, unknown>; ghost?: boolean }) =>
    <button className={"btn btn-sm " + (ghost ? "btn-ghost" : "")} disabled={busy} onClick={() => send(move)}>{label}</button>;
  const Pause = () => (pub.deadline || pub.left ? <Small label={pub.deadline ? "Pause" : "Resume"} move={{ type: "ui/pause" }} /> : null);

  if (pub.lifeline) return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="card text-center"><div className="eyebrow">Lifeline · {T[pub.lifeline.team].name}</div>
        <div className="display text-[36px]" style={{ color: "var(--color-gold)" }}>{pub.lifeline.key === "friend" ? "Call a Friend" : "Double Dip"}</div>
        {pub.lifeline.key === "friend"
          ? <p className="text-[14px] text-[var(--color-ink-2)] mt-2">Before the captain says a word, read this to the friend: &ldquo;Hi, quick quiz question. No ChatGPT, no Google, no asking anyone else. Straight off the top of your head. Ready?&rdquo;</p>
          : <p className="text-[14px] text-[var(--color-ink-2)] mt-2">The captain gets two answers on this one. Either one right counts.</p>}
        {pub.lifeline.key === "friend" && <div className="grid place-items-center mt-3"><Clock deadline={pub.lifeline.deadline} size={90} timeUp={!pub.lifeline.deadline} /></div>}
      </div>
      <p className="font-bold text-[18px]">{pub.question}</p>
      <AnswerCard />
      <Main label="Back to the question" move={{ type: "ui/closeLifeline" }} />
    </div>);

  const mk = pub.mini?.key ? ({ saysame: "say" } as Record<string, string>)[pub.mini.key] || pub.mini.key : undefined, S = pub.summary;
  const screen = HostScreen();
  return <>{<AwayCard pub={pub} />}{screen}</>;
  function HostScreen() {
  switch (pub.screen) {
    case "roundIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        <RoundIntro pub={pub} size="phone" />
        <Main label={`Start: question for ${T[pub.first ?? 0].name}`} move={{ type: "round/begin" }} />
      </div>);
    case "ask": case "steal": return (
      <div className="flex flex-col gap-3 flex-1">
        <AskHead pub={pub} size="phone" />
        <div className="flex items-start gap-3">
          <p className="font-bold text-[18px] leading-snug flex-1">{pub.question}</p>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} />
        </div>
        <AnswerCard />
        <Typed t={turn} />
        <Judge right={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: true }} wrong={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: false }} />
        <div className="flex flex-wrap gap-2 justify-center">
          <Pause />
          {pub.screen === "ask" && <Small ghost label="Change question" move={{ type: "round/swap" }} />}
        </div>
      </div>);
    case "answer": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">The answer</div>
          <div className="display text-[36px]" style={{ color: "var(--color-gold)" }}>{pub.result?.answer}</div>
          <div className="display text-[24px] mt-2" style={{ color: tc(pub.result?.by) }}>{pub.result?.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}`}</div></div>
        <Main label="Next" move={{ type: "round/afterAnswer" }} />
      </div>);
    case "roundScore": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">End of round {pub.r + 1}</div>
          <div className="display text-[44px]">{T[0].score} – {T[1].score}</div></div>
        <Main label="Next" move={{ type: "round/next" }} />
      </div>);
    case "sudden": return !pub.sudden?.ready ? (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="display text-[40px]" style={{ color: "var(--color-gold)" }}>Sudden death</div>
          <p className="text-[14px] text-[var(--color-ink-2)] mt-2">One question, captains only. They buzz on their phones; first buzz types the answer. Wrong, and the other captain can buzz.</p></div>
        <Main label="Go" move={{ type: "sudden/go" }} />
      </div>) : (
      <div className="flex flex-col gap-3 flex-1">
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {pub.buzz != null ? (<>
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </>) : (<>
          <div className="card text-center text-[15px] text-[var(--color-ink-2)] mt-auto">Waiting for a captain to buzz…{pub.out?.some(Boolean) ? ` (${T[pub.out[0] ? 0 : 1].name} is out)` : ""}</div>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, next question" move={{ type: "sudden/win", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "sudden/swap" }} />
          </div>
        </>)}
      </div>);
    case "final": return (
      <div className="card text-center flex-1 grid place-items-center"><div>
        <div className="eyebrow">The winner</div>
        <div className="display text-[52px]" style={{ color: tc(pub.winner) }}>{pub.winner == null ? "A draw" : T[pub.winner].name}</div>
        <div className="display text-[32px]">{T[0].score} – {T[1].score}</div></div></div>);

    /* ---- the mini-games ---- */
    case "miniIntro": case "flagIntro": case "dishIntro": case "mapIntro": case "auctionIntro": case "sayIntro": case "battleIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        <MiniIntro pub={pub} size="phone" />
        <Main label="Start" move={{ type: mk === "auction" ? "auction/begin" : mk + "/start" }} />
      </div>);
    case "miniQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Closest To Wins · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        <div className="grid grid-cols-2 gap-3">{[0, 1].map((t) => (
          <div key={t} className="card text-center !p-3">
            <div className="eyebrow" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
            <div className="display text-[28px]">{secret.guesses?.[t] ?? "…"}</div></div>))}</div>
        <p className="text-[13px] text-center text-[var(--color-ink-3)]">The app works out who&rsquo;s closer once both are in.</p>
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change question" move={{ type: "closest/swap" }} /></div>
      </div>);
    case "closestReveal": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">The answer</div>
          <div className="display text-[36px]" style={{ color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
          <div className="display text-[22px] mt-1" style={{ color: tc(pub.reveal?.w === 0 || pub.reveal?.w === 1 ? pub.reveal.w : null) }}>
            {pub.reveal?.w === "tie" ? "A point each" : pub.reveal?.w === 0 || pub.reveal?.w === 1 ? `${T[pub.reveal.w].name} takes the leg` : ""}</div></div>
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "flagQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Flag {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <Flag name={pub.flag} h={110} />
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change flag" move={{ type: "flag/swap" }} /></div>
      </div>);
    case "flagReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="card text-center"><div className="eyebrow">The answer</div><div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>{pub.reveal?.answer}</div></div>
        <div className="eyebrow">The app checked them. Tap to overrule.</div>
        {[0, 1].map((t) => { const ok = pub.reveal?.ok?.[t]; return (
          <button key={t} className="btn btn-block" style={ok ? btnGreen : { borderColor: tc(t as 0 | 1) }} disabled={busy} onClick={() => send({ type: "ui/flagOk", t })}>
            {T[t].name}: {pub.reveal?.typed?.[t]?.[0] ?? "no answer"} · {ok ? "right" : "wrong"}</button>); })}
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "dishQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">{pub.dish?.kind} · {pub.dish?.ings.length} of {pub.dish?.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <AnswerCard />
        {pub.buzz != null ? (<>
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge right={{ type: "dish/right" }} wrong={{ type: "dish/wrong" }} />
        </>) : (<>
          {pub.dish && <div className="card"><Ings ings={pub.dish.ings} small /></div>}
          <div className="card text-center text-[14px] text-[var(--color-ink-2)] mt-auto">Waiting for a buzz…{[0, 1].filter((t) => pub.out?.[t]).map((t) => ` ${T[t].name} is out.`).join("")}</div>
          <div className="flex gap-2 justify-center"><Pause />{!pub.out?.some(Boolean) && <Small ghost label="Change this one" move={{ type: "dish/swap" }} />}</div>
        </>)}
      </div>);
    case "dishReveal": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">The answer</div>
          <div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
          <div className="display text-[22px]" style={{ color: tc(pub.reveal?.w === 0 || pub.reveal?.w === 1 ? pub.reveal.w : null) }}>
            {pub.reveal?.w === 0 || pub.reveal?.w === 1 ? `${T[pub.reveal.w].name} got it` : "Nobody got it"}</div></div>
        <Main label="Next" move={{ type: "dish/next" }} />
      </div>);
    case "dishTie": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>Level at {pub.mini?.wins[0]} each</div>
          <p className="text-[14px] text-[var(--color-ink-2)]">One more to settle it, or a point each?</p></div>
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "dish/stop" })}>A point each</button>
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "dish/more" })}>One more</button>
        </div>
      </div>);
    case "miniSummary": case "flagSummary": case "dishSummary": case "mapSummary": case "saySummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">{pub.mini?.title}</div>
          <div className="display text-[44px]">{S?.wins[0]} – {S?.wins[1]}</div>
          {S?.note && <div className="text-[13px] text-[var(--color-ink-2)]">{S.note}</div>}</div>
        {S?.needsHost ? (<>
          <div className="eyebrow">Still level. Who gets the {pub.mini?.pts} points?</div>
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <button className="btn btn-a" disabled={busy} onClick={() => send({ type: mk + "/award", w: 0 })}>{T[0].name}</button>
            <button className="btn" disabled={busy} onClick={() => send({ type: mk + "/award", w: "split" })}>Split</button>
            <button className="btn btn-b" disabled={busy} onClick={() => send({ type: mk + "/award", w: 1 })}>{T[1].name}</button>
          </div>
        </>) : <Main label="Next" move={{ type: mk + "/done" }} />}
      </div>);
    case "mapQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Map {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        {pub.map && <MapView id={pub.map.id} reveal={false} hint={!!pub.map.hint} maxH={200} legend={false} />}
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex flex-wrap gap-2 justify-center mt-auto"><Pause />{!pub.map?.hint && <Small label="Show a hint" move={{ type: "map/hint" }} />}<Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change map" move={{ type: "map/swap" }} /></div>
      </div>);
    case "mapReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="card text-center"><div className="eyebrow">The map shows</div><div className="display text-[28px]" style={{ color: "var(--color-gold)" }}>{pub.map?.title}</div></div>
        <div className="eyebrow">Who got it? The idea counts, not the exact words.</div>
        {[0, 1].map((t) => { const ok = pub.reveal?.ok?.[t]; return (
          <button key={t} className="btn btn-block" style={ok ? btnGreen : { borderColor: tc(t as 0 | 1) }} disabled={busy} onClick={() => send({ type: "ui/mapOk", t })}>
            {T[t].name}: {pub.reveal?.typed?.[t]?.[0] ?? "no answer"} · {ok ? "right" : "wrong"}</button>); })}
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "mapTie": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>Level at {pub.mini?.wins[0]} each</div>
          <p className="text-[14px] text-[var(--color-ink-2)]">Another map, or a point each?</p></div>
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "map/stop" })}>A point each</button>
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "map/more" })}>One more</button>
        </div>
      </div>);
    case "auctionBid": { const A = pub.auction!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="card text-center"><div className="eyebrow">Auction · leg {A.leg + 1} of {A.n}</div>
          <div className="display text-[30px]" style={{ color: "var(--color-gold)" }}>{A.cat}</div>
          {A.notes && <div className="text-[13px] text-[var(--color-ink-2)] mt-1">{A.notes}</div>}</div>
        <div className="card text-center text-[16px]">{A.bid ? <>Bid: <b>{A.bid}</b> by <b style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</b></> : "No bid yet"}<br />
          <span className="text-[var(--color-ink-2)]">The captains bid on their phones. <b style={{ color: tc(A.turn) }}>{T[A.turn].name}</b> to go.</span></div>
        <div className="flex justify-center mt-auto">{!A.bid && <Small ghost label="Change the category" move={{ type: "auction/skip" }} />}</div>
      </div>); }
    case "auctionRun": { const A = pub.auction!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-[22px]" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <div className="text-[15px] text-[var(--color-ink-2)]">{A.cat}{A.notes ? `. ${A.notes}` : ""}</div>
        <div className="display text-center" style={{ fontSize: 90 }}>{A.count}<span className="text-[var(--color-ink-3)] text-[40px]"> / {A.bid}</span></div>
        <button className="btn btn-gold btn-block display" style={{ minHeight: 130, fontSize: 54 }} disabled={busy} onClick={() => send({ type: "auction/tick" })}>+1</button>
        <div className="flex gap-2 justify-center"><Small label="Undo" move={{ type: "auction/untick" }} /><Pause /><Small ghost label="Time's up" move={{ type: "auction/resolve" }} /></div>
      </div>); }
    case "auctionLeg": { const L = pub.auction?.last; return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center">{L && (<>
          <div className="display text-[36px]" style={{ color: L.made ? "var(--color-ok)" : "var(--color-no)" }}>{L.made ? "Delivered" : "Short"}</div>
          <div className="text-[15px]">{T[L.by].name} bid {L.bid}, named {L.count}.</div>
          <div className="display text-[22px] mt-1" style={{ color: tc(L.won) }}>{T[L.won].name} take the leg</div></>)}</div>
        <Main label="Next" move={{ type: "auction/nextLeg" }} />
      </div>); }
    case "auctionResult": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">The Auction</div>
          <div className="display text-[44px]">{pub.auction?.wins[0]} – {pub.auction?.wins[1]}</div></div>
        <Main label="Next" move={{ type: "auction/done" }} />
      </div>);
    case "sayQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Don&rsquo;t say the same · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {[0, 1].map((t) => <div key={t} className="card !p-3 text-[15px]"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {secret.typed?.[t]?.[0] ?? "thinking…"}{secret.typed?.[t] ? (secret.match?.[t] ? " · said the word" : " · dodged it") : ""}</div>)}
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change prompt" move={{ type: "say/swap" }} /></div>
      </div>);
    case "sayReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="card text-center"><div className="eyebrow">The word</div><div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>{pub.reveal?.answer}</div></div>
        <div className="eyebrow">The app checked them. Tap to overrule.</div>
        {[0, 1].map((t) => { const ok = pub.reveal?.ok?.[t]; return (
          <button key={t} className="btn btn-block" style={ok ? btnGreen : { borderColor: tc(t as 0 | 1) }} disabled={busy} onClick={() => send({ type: "ui/sayOk", t })}>
            {T[t].name}: {pub.reveal?.typed?.[t]?.[0] ?? "nothing"} · {ok ? "dodged it" : "said it"}</button>); })}
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "battleQ": { const B = pub.battle!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-[22px]" style={{ color: tc(B.cap) }}>{T[B.cap].name} · {B.i + 1}/{B.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {secret.typed?.[B.cap] && <Typed t={B.cap} />}
        <Judge right={{ type: "battle/mark", got: true }} wrong={{ type: "battle/mark", got: false }} />
        <div className="flex gap-2 justify-center"><Pause /><Small ghost label="Change question" move={{ type: "battle/swap" }} /></div>
      </div>); }
    case "battleHandoff": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">Halfway</div>
          <div className="display text-[30px]">{T[0].name} scored {pub.battle?.score[0]}</div>
          <div className="text-[14px] text-[var(--color-ink-2)]">Now {T[1].name}&rsquo;s captain.</div></div>
        <Main label={`Start ${T[1].name}'s questions`} move={{ type: "battle/start" }} />
      </div>);
    case "battleTie": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="eyebrow">Battle tie-breaker: first captain to buzz</div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {pub.buzz != null ? (<>
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </>) : (<>
          <div className="card text-center text-[15px] text-[var(--color-ink-2)] mt-auto">Waiting for a buzz…</div>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, another one" move={{ type: "battle/tbWin", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "battle/tbSwap" }} />
          </div>
        </>)}
      </div>);
    case "battleSummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">Battle of the Captains</div>
          <div className="display text-[44px]">{pub.battle?.score[0]} – {pub.battle?.score[1]}</div>
          {pub.battle?.note && <div className="text-[13px] text-[var(--color-ink-2)]">{pub.battle.note}</div>}</div>
        <Main label="Next" move={{ type: "battle/done" }} />
      </div>);
    default: return <div className="eyebrow text-center">Eyes on the TV</div>;
  }
  }
}

/* the host's warning: who left the game screen during this question (another app, a search) */
function AwayCard({ pub }: { pub: Pub }) {
  const now = (pub.flags || []).filter((f) => f.qid && f.qid === pub.qid);
  if (!now.length) return null;
  return (
    <div className="card !p-3 text-[14px] font-bold" role="alert" style={{ background: "rgba(255,85,102,.12)", borderColor: "rgba(255,85,102,.5)", color: "var(--color-no)" }}>
      Left the game screen during this question: {now.map((f) => `${f.name}${f.ms != null ? ` (${Math.round(f.ms / 1000)}s)` : " (still away)"}`).join(", ")}
    </div>);
}
/* the host's full list, in the Players panel */
export function AwayLog({ pub }: { pub: Pub | null }) {
  const all = pub?.flags || [];
  return (
    <div className="card flex flex-col gap-2">
      <div className="eyebrow" style={{ color: "var(--color-no)" }}>Left the game screen</div>
      {all.length ? [...all].reverse().map((f) => (
        <div key={f.id} className="text-[14px]"><b style={{ color: tc(f.team) }}>{f.name}</b> · {f.label}{f.ms != null ? ` · ${Math.round(f.ms / 1000)}s` : " · still away"}</div>))
        : <p className="text-[14px] text-[var(--color-ink-2)]">Nobody so far. A phone that switches app or tab during a question shows up here and on the TV.</p>}
    </div>);
}

/* who won what, on every phone (the TV isn't the only one that gets to know) */
function Result({ pub, mine }: { pub: Pub; mine?: 0 | 1 }) {
  const T = pub.teams, sc = pub.screen, m = pub.mini;
  const name = (t: 0 | 1) => <b style={{ color: tc(t) }}>{T[t].name}</b>;
  const head = (t: 0 | 1 | null | undefined, text: string, sub?: string) => (
    <div className="card text-center flex flex-col gap-1" role="status" aria-live="polite">
      <div className="display text-[28px] leading-tight" style={{ color: tc(t ?? null) }}>{text}</div>
      {t != null && mine != null && <div className="text-[13px] font-bold" style={{ color: t === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{t === mine ? "That's your team!" : "Not this time."}</div>}
      {sub && <div className="text-[13px] text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  const legW = (w: unknown) => (w === 0 || w === 1 ? w : null) as 0 | 1 | null;
  const rows = (ok: (t: 0 | 1) => string) => (
    <div className="grid grid-cols-2 gap-2">{([0, 1] as const).map((t) => (
      <div key={t} className="card !p-3 text-center"><div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div><div className="text-[15px] font-bold mt-1">{ok(t)}</div></div>))}</div>);
  if (sc === "answer" && pub.result) return head(pub.result.by, pub.result.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? ", stolen!" : ""}`);
  if (sc === "roundScore") return (<>
    {head(null, `End of round ${pub.r + 1}`)}
    {rows((t) => `${T[t].score} pts (+${pub.roundPts?.[t] ?? 0})`)}</>);
  if (sc === "closestReveal" && pub.reveal) { const w = pub.reveal.w, ans = Number(pub.reveal.answer); return (<>
    {head(legW(w), w === "tie" ? "A point each" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "")}
    {rows((t) => { const g = pub.reveal?.guesses?.[t]; return g == null ? "No answer" : `${g} (off by ${Math.abs(g - ans)})`; })}</>); }
  if ((sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal") && pub.reveal) {
    const say = sc === "sayReveal", w = pub.reveal.w;
    const ok = (t: 0 | 1) => sc === "mapReveal" ? pub.map?.ruled?.[t] : pub.reveal?.ok?.[t];
    const verdict = (t: 0 | 1) => { const v = ok(t); return v == null ? "waiting for a ruling" : say ? (v ? "dodged it" : "said it") : v ? "right" : "wrong"; };
    return (<>
      {(sc !== "mapReveal" || (ok(0) != null && ok(1) != null)) && head(legW(w), w === "tie" ? "A point each" : w === "none" ? "Nobody gets it" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "")}
      {rows((t) => `${pub.reveal?.typed?.[t]?.[0] ?? (say ? "nothing" : "no answer")} · ${verdict(t)}`)}</>);
  }
  if (sc === "dishReveal" && pub.reveal) return head(legW(pub.reveal.w), legW(pub.reveal.w) != null ? `${T[pub.reveal.w as 0 | 1].name} got it` : "Nobody got it");
  if (sc === "auctionLeg" && pub.auction?.last) { const L = pub.auction.last; return (
    <div className="card text-center flex flex-col gap-1" role="status" aria-live="polite">
      <div className="display text-[30px]" style={{ color: L.made ? "var(--color-ok)" : "var(--color-no)" }}>{L.made ? "Delivered!" : "Short!"}</div>
      <div className="text-[15px]">{name(L.by)} bid {L.bid}, named {L.count}.</div>
      <div className="display text-[24px] mt-1" style={{ color: tc(L.won) }}>{T[L.won].name} take the leg</div>
      {mine != null && <div className="text-[13px] font-bold" style={{ color: L.won === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{L.won === mine ? "That's your team!" : "Not this time."}</div>}
      <div className="text-[13px] text-[var(--color-ink-2)]">Legs so far: {T[0].name} {pub.auction.wins[0]} · {T[1].name} {pub.auction.wins[1]}</div>
    </div>); }
  if (sc === "auctionResult" && pub.auction) { const A = pub.auction, w = A.winner ?? null; return head(w, w == null ? `Level, ${A.wins[0]}–${A.wins[1]}` : `${T[w].name} win the Auction`, `${A.wins[0]}–${A.wins[1]} on legs${w != null ? ` · +${A.award?.[w] ?? m?.pts} points` : ""}`); }
  if (/Summary$/.test(sc) && sc !== "battleSummary" && pub.summary) { const S = pub.summary; return head(S.winner, S.needsHost ? "Still level" : S.winner == null ? "A split" : `${T[S.winner].name} win ${m?.title ?? "it"}`,
    `${S.wins[0]}–${S.wins[1]} on legs${S.needsHost ? " · the host decides" : S.winner == null ? ` · ${S.award?.[0] ?? 0} points each` : ` · +${S.award?.[S.winner] ?? m?.pts} points`}`); }
  if (sc === "battleSummary" && pub.battle) { const B = pub.battle, w = B.winner ?? null; return head(w, w == null ? (B.note || "Level") : `${T[w].name} win the Battle`, `${B.score[0]}–${B.score[1]}${w != null ? ` · +${B.award?.[w] ?? m?.pts} points` : ""}`); }
  return null;
}

/* what's on screen, close up: the question, the flag or the ingredients.
   It can't be selected or copied (no pasting it into a chatbot), and while
   the clock is paused it's hidden. */
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
function OnScreen({ pub }: { pub: Pub }) {
  if (pub.paused) return <div className="card text-center py-8"><div className="display text-[34px]" style={{ color: "var(--color-gold)" }}>Paused</div><p className="text-[14px] text-[var(--color-ink-2)] mt-1">The question comes back when the clock restarts.</p></div>;
  return (<div className="noselect contents" {...noCopy}>
    {pub.question && ["ask", "steal", "answer", "sudden", "miniQ", "closestReveal", "sayQ", "sayReveal", "battleQ", "battleTie"].includes(pub.screen) && <p className="font-bold text-[19px] leading-snug text-center">{pub.question}</p>}
    {(pub.screen === "flagQ" || pub.screen === "flagReveal") && <Flag name={pub.flag} h={150} />}
    {pub.map && <MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={260} />}
    {pub.map?.reveal && <div className="display text-[26px] text-center" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>}
    {pub.auction && /^auction(Bid|Run|Leg)$/.test(pub.screen) && <div className="card text-center"><div className="eyebrow">Category</div><div className="display text-[26px]" style={{ color: "var(--color-gold)" }}>{pub.auction.cat}</div>
      {pub.screen === "auctionRun" && <div className="display text-[44px]">{pub.auction.count} / {pub.auction.bid}</div>}</div>}
    {(pub.screen === "dishQ" || pub.screen === "dishReveal") && pub.dish && <div className="card"><div className="eyebrow mb-2">Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div><Ings ings={pub.dish.ings} /></div>}
    {pub.reveal && /Reveal$/.test(pub.screen) && pub.screen !== "mapReveal" && pub.screen !== "sayReveal" && <div className="display text-[30px] text-center" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div>}
    {pub.screen === "answer" && pub.result && <div className="display text-[32px] text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
    {["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "battleQ"].includes(pub.screen) && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "dishQ" ? 70 : pub.screen === "ask" || pub.screen === "steal" ? 72 : 90} /></div>}
  </div>);
}

/* the screens that show who won what (see Result) */
const RESULT = /^(answer|roundScore|closestReveal|flagReveal|sayReveal|mapReveal|dishReveal|auctionLeg|auctionResult|\w+Summary)$/;

/* what this question means for YOU, under the "Question for TEAM" head */
function youLine(pub: Pub, me: Member, capName?: string) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain", ours = pub.turn === mine, them = T[pub.turn ?? 0].name;
  const to = capName ? `send ideas to ${capName}` : "send ideas to your captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend." : "Double Dip: two answers on this one.") : `${T[pub.lifeline.team].name} are using a lifeline.`;
  if (pub.pending) return pub.pending.team === mine ? "Answer sent. The other captain can overrule." : `${them} answered. Agree or overrule below.`;
  if (pub.screen === "steal") return ours ? (cap ? "They missed. Your steal, captain: type it below." : `They missed. Your steal: ${to}.`) : `You missed. ${them} can steal it now.`;
  return ours ? (cap ? "Your question, captain: type the answer below." : `Your team's question: ${to}.`) : "Not yours. If they miss, you can steal it.";
}

/* the top of a phone: Classic's layouts for the intros and questions, a plain status line for the rest */
function Head({ pub, me, capName, canArm, onArm, busy }: { pub: Pub; me: Member; capName?: string; canArm?: (t: 0 | 1) => boolean; onArm?: (t: 0 | 1) => void; busy?: boolean }) {
  if (pub.screen === "roundIntro") return <RoundIntro pub={pub} size="phone" canArm={canArm} onArm={onArm} busy={busy} />;
  if (pub.screen === "ask" || pub.screen === "steal") return <AskHead pub={pub} size="phone" you={youLine(pub, me, capName)} go={pub.turn === me.team && !pub.lifeline && !pub.pending} />;
  if (/Intro$/.test(pub.screen) && pub.mini) return <MiniIntro pub={pub} size="phone" />;
  if (RESULT.test(pub.screen)) return null;            // the result card says it
  return <p className="text-center font-bold text-[17px] leading-snug" role="status" aria-live="polite">{status(pub, me)}</p>;
}

function status(pub: Pub, me: Member) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend" : "Double Dip: two answers") : `${T[pub.lifeline.team].name} used a lifeline`;
  switch (pub.screen) {
    case "ask": return pub.turn === mine ? (cap ? "Your question. Type your answer." : "Your team's question. Help your captain!") : `${T[pub.turn ?? 0].name} is answering. Get ready to steal.`;
    case "steal": return pub.turn === mine ? (cap ? "Steal! Type your answer." : "Steal! Help your captain.") : `${T[pub.turn ?? 0].name} can steal it`;
    case "answer": return pub.result?.by == null ? "Nobody scored" : pub.result.by === mine ? `+${pub.result.pts} to your team!` : `${T[pub.result.by].name} scored`;
    case "roundIntro": return `Round ${pub.r + 1}: ${pub.theme}`;
    case "roundScore": return `End of round ${pub.r + 1}`;
    case "sudden": return cap ? "Sudden death: captains only. Buzz to answer." : "Sudden death: captains only. Not a word!";
    case "final": return pub.winner == null ? "It's a draw" : pub.winner === mine ? "You won the night!" : `${T[pub.winner].name} won the night`;
    case "miniQ": return cap ? "Type a number. Nearest wins." : "Closest To Wins: help your captain";
    case "flagQ": return cap ? "Which country? One go." : "Guess the Flag: help your captain";
    case "dishQ": return pub.buzz === mine ? (cap ? "You buzzed! Type it." : "Your captain buzzed!") : pub.buzz != null ? `${T[pub.buzz].name} buzzed` : pub.out?.[mine] ? "You're out of this one" : cap ? "Know it? BUZZ!" : "Cocktail or Dish: help your captain";
    case "sayQ": return cap ? "Type an answer the app won't think of" : "Don't Say the Same: help your captain";
    case "sayReveal": return pub.reveal?.ok?.[mine] ? "You dodged the app's word" : "You said the app's word";
    case "battleQ": return pub.battle?.cap === mine ? (cap ? (pub.mode === "nohost" ? "Your question. Type it fast!" : "Your question. Say it out loud!") : "Your captain's battle. Not a word!") : cap ? "Your turn is next. Stay quiet." : "Captains only. Not a word!";
    case "battleHandoff": return `${T[1].name}'s captain is next`;
    case "battleTie": return cap ? "Tie-breaker: buzz to answer" : "Captains only. Not a word!";
    case "mapQ": return cap ? "What does the map show? One go." : "Guess the Map: help your captain";
    case "mapReveal": return "The answer's on the TV";
    case "auctionBid": return pub.auction?.turn === mine ? (cap ? "Your bid: raise, or pass" : "Your captain is bidding") : `${T[pub.auction?.turn ?? 0].name} is bidding`;
    case "auctionRun": return pub.auction?.by === mine ? (cap ? `Name ${pub.auction?.bid}! Out loud!` : `Name ${pub.auction?.bid}! Out loud!`) : `${T[pub.auction?.by ?? 0].name} has to name ${pub.auction?.bid}`;
    default: return pub.mini ? pub.mini.title : "Eyes on the TV";
  }
}

/* A PLAYER's phone: what's on screen, the scores, and a box to suggest an
   answer to the captain. Players never answer directly. */
export function PlayerGame({ pub, me, members, code }: { pub: Pub; me: Member; members: Member[]; code: string }) {
  const mine = me.team as 0 | 1;
  const [text, setText] = useState(""), [sent, setSent] = useState<string | null>(null);
  useEffect(() => { setSent(null); setText(""); }, [pub.qid]);
  const cap = members.find((m) => m.team === mine && m.role === "captain");
  const canSuggest = !!pub.qid && ANSWERING.includes(pub.screen) && !CAPTAINS_ONLY.includes(pub.screen);
  const suggest = async () => { const t = text.trim(); if (!t) return; await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSent(t); setText(""); };
  return (
    <div className="flex flex-col gap-4 flex-1">
      <Head pub={pub} me={me} capName={cap?.name} />
      <OnScreen pub={pub} />
      <Result pub={pub} mine={mine} />
      {canSuggest && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="sug">Suggest to {cap?.name || "your captain"}</label>
          <div className="flex gap-2">
            <input id="sug" className="input" value={text} maxLength={80} inputMode={pub.screen === "miniQ" ? "decimal" : "text"} placeholder={pub.screen === "miniQ" ? "A number" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
            <button className="btn" disabled={!text.trim()} onClick={() => void suggest()}>Send</button>
          </div>
          {sent && <div className="text-[13px] text-[var(--color-ink-2)]">Sent: <b>{sent}</b></div>}
        </div>)}
      {pub.screen === "ask" && <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" />}
      {pub.nextBy && <WaitingFor pub={pub} />}
    </div>
  );
}

/* A CAPTAIN's phone: only what you can do right now. Type and send; the
   lifelines; the number pad; the buzzer; your players' suggestions. */
/* the "next thing" button a captain gets when there's no host, and its countdown */
const NEXT_LABEL: Record<string, [string, string]> = {
  roundIntro: ["Start the question", "round/begin"], miniIntro: ["Start", "closest/start"], flagIntro: ["Start", "flag/start"], dishIntro: ["Start", "dish/start"],
  mapIntro: ["Start", "map/start"], auctionIntro: ["Start", "auction/begin"], sayIntro: ["Start", "say/start"], battleIntro: ["Start", "battle/start"],
  battleHandoff: ["Start the second half", "battle/start"], sayReveal: ["Next", "ui/next"], mapReveal: ["Next", "ui/next"], saySummary: ["Next", "say/done"], battleSummary: ["Next", "battle/done"],
  answer: ["Next", "round/afterAnswer"], roundScore: ["Next", "round/next"], closestReveal: ["Next", "ui/next"], flagReveal: ["Next", "ui/next"],
  dishReveal: ["Next", "dish/next"], auctionLeg: ["Next", "auction/nextLeg"], auctionResult: ["Next", "auction/done"],
  miniSummary: ["Next", "closest/done"], flagSummary: ["Next", "flag/done"], dishSummary: ["Next", "dish/done"], mapSummary: ["Next", "map/done"],
};
function Countdown({ at }: { at: number }) { const s = useSecondsLeft(at); return <>{s}</>; }
/* no host: whose tap the room is waiting for */
function WaitingFor({ pub }: { pub: Pub }) {
  const label = pub.screen === "sudden" ? "Go" : NEXT_LABEL[pub.screen]?.[0] || "Next";
  const open = useAfter(pub.nextOpenAt);
  const who = open && pub.nextOther ? `${pub.nextBy} or ${pub.nextOther}` : pub.nextBy;
  return <p className="text-center text-[13px] text-[var(--color-ink-3)]" role="status">Waiting for {who} to tap {/^Start/.test(label) ? "Start" : label}.</p>;
}
/* the screens a clock runs on, and so the ones a Pause makes sense on */
const PAUSABLE = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "battleQ"];

/* A CAPTAIN's phone: only what you can do right now. Type and send; the
   lifelines; the number pad; the buzzer; the bidding; your players'
   suggestions. With no host, also the referee's buttons and Next. */
export function CaptainGame({ pub, me, members, code, hold = false }: { pub: Pub; me: Member; members: Member[]; code: string; hold?: boolean }) {
  const mine = me.team as 0 | 1, T = pub.teams, sc = pub.screen, nohost = pub.mode === "nohost";
  const theirs = (mine === 0 ? 1 : 0) as 0 | 1;
  const [a, setA] = useState(""), [b, setB] = useState(""), [sending, setBusy] = useState(false), [sentTxt, setSentTxt] = useState<string | null>(null);
  const [bid, setBid] = useState("");
  const busy = sending || hold;                     // sending, or waiting for the TV to reply
  useEffect(() => { setA(""); setB(""); setSentTxt(null); }, [pub.qid, sc]);
  useEffect(() => { setBid(""); }, [pub.auction?.bid, sc]);
  const names = useNames();
  const act = async (kind: string, payload: Record<string, unknown>) => { setBusy(true); try { await sendAction(code, kind, payload); } finally { setBusy(false); } };
  const nxt = (move: Record<string, unknown>) => act("next", { move, step: pub.step });

  const myTurn = (sc === "ask" || sc === "steal") && pub.turn === mine && !pub.lifeline;
  const dip = sc === "ask" && (pub.llUsed?.[mine] || []).includes("dip");
  /* with no host, the first answer sent is the one the app checks */
  const locked = nohost && (!!pub.pending || !!pub.sent?.[mine]);
  const canType = !pub.paused && ((myTurn && !locked) || (sc === "miniQ" && !pub.sent?.[mine]) || ((sc === "flagQ" || sc === "mapQ" || sc === "sayQ") && !pub.sent?.[mine])
    || (sc === "dishQ" && pub.buzz === mine && !pub.pending) || ((sc === "sudden" || sc === "battleTie") && pub.buzz === mine && !pub.pending)
    /* the Battle: typed with no host; with a host it's said out loud */
    || (sc === "battleQ" && nohost && pub.battle?.cap === mine && !locked));
  const canBuzz = (sc === "dishQ" && pub.buzz == null && !pub.out?.[mine]) || (sc === "sudden" && !!pub.sudden?.ready && pub.buzz == null && !pub.out?.[mine])
    || (sc === "battleTie" && pub.buzz == null && !pub.out?.[mine]);
  const sugs = useSuggestions(code, pub.qid, members, mine, ANSWERING.includes(sc));
  const list = sc === "flagQ" ? names.flag : sc === "dishQ" ? names.dish : [];
  const A = pub.auction;
  /* a short buzz in the hand when it becomes your go (phones that can) */
  const yourGo = (myTurn && !locked) || (sc === "auctionBid" && A?.turn === mine) || canBuzz;
  useEffect(() => { if (yourGo) buzzHand([60, 40, 60]); }, [yourGo, pub.qid, sc]);
  /* no host: Team A's captain (B's if A has none) starts and moves the night on */
  const lead = pub.lead === mine;
  /* ...and if they haven't after a while (phone in a pocket), the other captain can */
  const open = useAfter(pub.nextOpenAt);
  const mayNext = lead || open;
  const next = nohost && mayNext && pub.nextBy ? NEXT_LABEL[sc] : undefined;
  const showNext = !!next && sc !== "sudden";

  const send = async () => {
    if (sc === "miniQ") { await act("answer", { n: a }); setSentTxt(a); return; }
    const texts = [a, b].map((x) => x.trim()).filter(Boolean);
    if (!texts.length) return;
    await act("answer", { texts }); setSentTxt(texts.join(" / "));
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      <Head pub={pub} me={me} canArm={(t) => t === mine} onArm={() => void act("lifeline", { key: "dbl" })} busy={busy} />

      {/* no host: the other captain's answer, the app's verdict, and my chance to overrule */}
      {pub.pending && (pub.pending.team === mine ? (
        <div className="card text-center"><div className="eyebrow">You sent</div><div className="display text-[28px]">{pub.pending.text}</div>
          <div className="font-bold" style={{ color: pub.pending.v ? "var(--color-ok)" : "var(--color-no)" }}>The app says {pub.pending.v ? "right" : "wrong"}</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">{T[theirs].name} can overrule · <Countdown at={pub.pending.until} /></div></div>
      ) : (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow" style={{ color: tc(theirs) }}>{T[theirs].name} said</div>
          <div className="display text-[30px]">{pub.pending.text}</div>
          <div className="font-bold" style={{ color: pub.pending.v ? "var(--color-ok)" : "var(--color-no)" }}>The app says {pub.pending.v ? "right" : "wrong"}</div>
          <div className="text-[13px] text-[var(--color-ink-3)]">You decide: is the app right? <Countdown at={pub.pending.until} /></div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "ui/overrule" })}>Overrule</button>
            <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "ui/agree" })}>Agree</button>
          </div>
        </div>))}

      {!pub.pending && <OnScreen pub={pub} />}
      {!pub.pending && <Result pub={pub} mine={mine} />}


      {/* no host, Call a Friend: the calling captain closes the card */}
      {nohost && pub.lifeline?.key === "friend" && pub.lifeline.team === mine && (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/closeLifeline" })}>Back to the question</button>)}

      {canBuzz && <button className="btn btn-lg btn-block display" style={{ minHeight: 150, fontSize: 56, background: tc(mine), color: "#04050e", borderColor: "transparent" }} disabled={busy} onClick={() => { buzzHand(40); void act("buzz", {}); }}>BUZZ</button>}

      {canType && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="ans">{sc === "miniQ" ? "Your number" : dip ? "Your two answers" : "Your answer"}</label>
          <input id="ans" className="input" value={a} maxLength={80} list={list.length ? "names" : undefined} autoComplete="off"
            inputMode={sc === "miniQ" ? "decimal" : "text"} placeholder={sc === "miniQ" ? "e.g. 236" : "Type it"} onChange={(e) => setA(e.target.value)} />
          {dip && <input className="input" aria-label="Your second answer" value={b} maxLength={80} placeholder="Second answer" onChange={(e) => setB(e.target.value)} />}
          {list.length > 0 && <datalist id="names">{list.map((n) => <option key={n} value={n} />)}</datalist>}
          <button className="btn btn-gold btn-lg" disabled={busy || !a.trim()} onClick={() => void send()}>{sc === "miniQ" ? "Lock in" : "Send"}</button>
          {sentTxt && !nohost && (sc === "ask" || sc === "steal") && <div className="text-[13px] text-[var(--color-ink-2)]">Sent: <b>{sentTxt}</b>. You can change it until the host decides.</div>}
          {nohost && (sc === "ask" || sc === "steal") && <div className="text-[13px] text-[var(--color-ink-3)]">One go: the app checks the first answer you send.</div>}
        </div>)}
      {!canType && pub.sent?.[mine] && ["miniQ", "flagQ", "mapQ", "sayQ"].includes(sc) && <div className="card text-center font-bold">Locked in{sentTxt ? `: ${sentTxt}` : ""}</div>}

      {/* the lifelines: everyone sees them; the captain whose question it is taps */}
      {sc === "ask" && <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" busy={busy}
        onUse={myTurn && !locked ? (k) => void act("lifeline", { key: k }) : undefined} />}

      {/* the Auction: bidding is always the captains' */}
      {sc === "auctionBid" && A && A.turn === mine && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">{A.bid ? `Beat ${A.bid}, or pass` : "Open the bidding"}</div>
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "auction/raise", n: A.bid + 1 })}>Raise to {A.bid + 1}</button>
          <div className="flex gap-2">
            <input className="input" aria-label="Custom bid" inputMode="numeric" value={bid} placeholder="Custom bid" onChange={(e) => setBid(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            <button className="btn" disabled={busy || !(Number(bid) > A.bid)} onClick={() => void nxt({ type: "auction/raise", n: Number(bid) })}>Bid</button>
          </div>
          {bid !== "" && !(Number(bid) > A.bid) && <p className="text-[13px] text-[var(--color-no)]" role="alert">A bid has to beat {A.bid}.</p>}
          {A.bid > 0 && (
            <button className="btn btn-lg btn-block pass-btn" disabled={busy} onClick={() => void nxt({ type: "auction/pass" })}>
              <span className="text-[17px]">Pass</span>
              <span className="text-[13px] font-semibold text-[var(--color-ink-2)]"><b style={{ color: tc(A.by ?? theirs) }}>{T[A.by ?? theirs].name}</b> must name {A.bid}</span>
            </button>)}
        </div>)}
      {/* no host: the other captain counts the names */}
      {nohost && sc === "auctionRun" && A && A.by === theirs && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">You&rsquo;re counting. Only fair ones count.</div>
          <button className="btn btn-gold btn-block display" style={{ minHeight: 120, fontSize: 50 }} disabled={busy} onClick={() => void nxt({ type: "auction/tick" })}>+1</button>
          <button className="btn btn-sm self-center" disabled={busy} onClick={() => void nxt({ type: "auction/untick" })}>Undo</button>
        </div>)}

      {/* no host: each captain referees the other team's flag and map */}
      {nohost && sc === "flagReveal" && pub.reveal && (
        <button className="btn btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/flagOk", t: theirs })}>
          {T[theirs].name}: {pub.reveal.typed?.[theirs]?.[0] ?? "no answer"} · {pub.reveal.ok?.[theirs] ? "right" : "wrong"} (tap to overrule)</button>)}
      {nohost && sc === "sayReveal" && pub.reveal && (
        <button className="btn btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/sayOk", t: theirs })}>
          {T[theirs].name}: {pub.reveal.typed?.[theirs]?.[0] ?? "nothing"} · {pub.reveal.ok?.[theirs] ? "dodged it" : "said it"} (tap to overrule)</button>)}
      {nohost && sc === "mapReveal" && pub.map && (pub.map.ruled?.[theirs] == null ? (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow" style={{ color: tc(theirs) }}>You rule on {T[theirs].name}&rsquo;s answer</div>
          <div className="display text-[26px]">{pub.reveal?.typed?.[theirs]?.[0]}</div>
          <div className="text-[13px] text-[var(--color-ink-2)]">The map shows: <b>{pub.map.title}</b>. The idea counts, not the exact words.</div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn btn-lg" style={btnRed} disabled={busy} onClick={() => void nxt({ type: "ui/mapRule", v: false })}>Wrong</button>
            <button className="btn btn-lg" style={btnGreen} disabled={busy} onClick={() => void nxt({ type: "ui/mapRule", v: true })}>Right</button>
          </div>
        </div>) : <div className="card text-center text-[14px]">You ruled {T[theirs].name} {pub.map.ruled?.[theirs] ? "right" : "wrong"}.</div>)}

      {/* no host: start, go and next — the lead captain (Team A's) */}
      {showNext && next && (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: next[1] })}>{next[0]}</button>)}
      {nohost && mayNext && pub.nextBy && sc === "sudden" && !pub.sudden?.ready && <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: "sudden/go" })}>Go</button>}
      {pub.nextBy && !lead && open && <p className="text-center text-[13px] text-[var(--color-ink-3)]">{pub.nextBy} hasn&rsquo;t tapped it, so you can.</p>}
      {pub.nextBy && !lead && !open && <WaitingFor pub={pub} />}
      {/* no host: either captain can stop the clock (the question hides until it restarts) */}
      {nohost && PAUSABLE.includes(sc) && !pub.lifeline && !pub.pending && (pub.deadline || pub.paused) && (
        <button className="btn btn-sm self-center" disabled={busy} onClick={() => void nxt({ type: "ui/pause" })}>{pub.paused ? "Resume" : "Pause"}</button>)}

      {sugs.length > 0 && (canType || ANSWERING.includes(sc)) && (
        <div className="card">
          <div className="eyebrow mb-2">Your team suggests{canType ? ". Tap one to use it." : ""}</div>
          <div className="flex flex-col gap-1">
            {sugs.map((s) => (
              <button key={s.id} className="text-left text-[15px] min-h-[44px] px-2 -mx-2 rounded-[12px] active:bg-white/10" disabled={!canType} onClick={() => setA(s.text)}>
                <b style={{ color: tc(mine) }}>{members.find((m) => m.user_id === s.user_id)?.name}:</b> {s.text}</button>))}
          </div>
        </div>)}

    </div>
  );
}
