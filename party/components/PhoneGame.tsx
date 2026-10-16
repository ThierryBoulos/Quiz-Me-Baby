"use client";
import { useEffect, useState } from "react";
import { iso, TIE_SCREENS, type Pub, type Secret, type Two } from "@/lib/game";
import type { Member } from "@/lib/room";
import { QMB } from "@/lib/engine";
import { note, sb, sendAction } from "@/lib/supabase";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { AskHead, FlagImg, LifelineStrip, MiniIntro, RoundIntro, RulingPicker, ScoreBoard, silent, tieCall, tieHead, Verdict } from "./GameParts";

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
    /* the push carries the answer: use it (no second trip); a 25 s read underneath as a safety net */
    const ch = sb().channel("secret:" + code).on("postgres_changes", { event: "*", schema: "public", table: "secrets", filter: "room=eq." + code },
      (e) => { const d = (e.new as { data?: Secret } | undefined)?.data; if (d) setS(d); else void pull(); }).subscribe();
    const t = setInterval(() => { if (document.visibilityState === "visible") void pull(); }, 25000);
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
    /* a new suggestion arrives with the push: add it straight in; a 25 s read underneath as a safety net */
    const ch = sb().channel("sug:" + code + ":" + qid).on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code },
      (e) => {
        const a = e.new as { id?: number; user_id?: string; kind?: string; payload?: { qid?: string; text?: string } };
        if (a?.kind !== "suggest" || a.payload?.qid !== qid || a.id == null || !a.user_id) return;
        setList((cur) => (cur.some((x) => x.id === a.id) ? cur : [{ id: a.id!, user_id: a.user_id!, text: String(a.payload?.text || "") }, ...cur].slice(0, 30)));
      }).subscribe();
    const t = setInterval(() => { if (document.visibilityState === "visible") void pull(); }, 25000);
    return () => { clearInterval(t); void sb().removeChannel(ch); };
  }, [code, qid, on]);
  return list.filter((s) => members.find((m) => m.user_id === s.user_id)?.team === team);
}

/* a status or an outcome is plain text: boxes are for things you can tap */
const Line = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <p className={"text-center text-[15px] text-[var(--color-ink-2)] " + className} role="status">{children}</p>;
function Ings({ ings, small }: { ings: string[]; small?: boolean }) {
  return (
    <ol className="grid gap-1" style={{ fontSize: small || ings.length > 7 ? 14 : 16 }}>
      {ings.map((t, i) => { const [q, n] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{n}</b><span className="text-[var(--color-ink-3)] text-[0.85em]">{q}</span></li>; })}
    </ol>);
}
/* No pasting into an answer: typed by hand or not at all. A paste (or a
   dropped text) is refused, and the TV flags it, like leaving the screen. */
function useNoPaste(code: string, qid?: string) {
  const [said, setSaid] = useState(false);
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(false), 3500); return () => clearTimeout(t); }, [said]);
  const block = (e: { preventDefault: () => void }) => { e.preventDefault(); setSaid(true); note(code, { paste: { qid } }); };
  const props = {
    onPaste: block, onDrop: block,
    onBeforeInput: (e: React.FormEvent<HTMLInputElement>) => { const t = (e.nativeEvent as InputEvent).inputType || ""; if (/^insertFrom(Paste|Drop)/.test(t)) block(e); },
  };
  const hint = said ? <p className="text-[13px] font-bold text-[var(--color-no)]" role="alert">No pasting: type it yourself. The TV has been told.</p> : null;
  return { props, hint };
}

type Send = (move: Record<string, unknown>) => void;
/* a light vibration where the phone supports it (Android); silently nothing elsewhere */
const buzzHand = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };

/* The Auction's +1: the number moves the moment you tap (the TV catches up a
   beat later), and no tap is lost while the last one is still on its way. */
function Counter({ A, fire, h, fs, children }: { A: NonNullable<Pub["auction"]>; fire: Send; h: number; fs: number; children?: React.ReactNode }) {
  const leg = `${A.leg}:${A.cat}`;
  const [opt, setOpt] = useState<{ leg: string; n: number } | null>(null);
  /* the TV has caught up: its count is the count again (and if a tap never arrives, after a while the TV's count wins) */
  useEffect(() => { if (opt && opt.leg === leg && A.count === opt.n) setOpt(null); }, [A.count, opt, leg]);
  useEffect(() => { if (!opt) return; const t = setTimeout(() => setOpt(null), 6000); return () => clearTimeout(t); }, [opt]);
  const shown = opt && opt.leg === leg ? opt.n : A.count;
  const tap = (d: 1 | -1) => { setOpt({ leg, n: Math.max(0, shown + d) }); fire({ type: d > 0 ? "auction/tick" : "auction/untick" }); buzzHand(15); };
  return (<>
    <div className="display text-center" style={{ fontSize: 84 }} aria-live="polite">{shown}<span className="text-[var(--color-ink-3)] text-[40px]"> / {A.bid}</span></div>
    <button className="btn btn-gold btn-block display select-none" style={{ minHeight: h, fontSize: fs, touchAction: "manipulation" }} onClick={() => tap(1)}>+1</button>
    <div className="flex gap-2 justify-center"><button className="btn btn-sm" onClick={() => tap(-1)}>Undo</button>{children}</div>
  </>);
}

/* THE HOST'S PHONE: the answer always on top, one main button, judging only
   when there's something to judge. */
export function HostGame({ pub, secret: raw, send, busy, fire = send }: { pub: Pub; secret: Secret; send: Send; busy: boolean; fire?: Send }) {
  const T = pub.teams, turn = pub.turn ?? 0;
  /* only trust the secret when it belongs to this very screen: the question
     and the answer travel separately, and the answer must never be the last one */
  const fresh = !pub.qid || (raw.qid === pub.qid && (raw.step ?? 0) >= pub.step);
  const secret: Secret = fresh ? raw : {};
  const loading = !!pub.qid && !fresh;
  const Main = ({ label, move, off }: { label: string; move: Record<string, unknown>; off?: boolean }) =>
    <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy || off} onClick={() => send(move)}>{label}</button>;
  /* the host's private answer: the one box on this phone that isn't a button, so it can't be missed */
  const AnswerCard = () => loading ? <Line>Getting the answer…</Line> : secret.answer ? (
    <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer, only you can see this</div>
      <div className="display text-[32px] mt-1" style={{ color: "var(--color-gold)" }}>{secret.answer}</div>
      {secret.notes && <div className="text-[13px] text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
      {(secret.accept?.length ?? 0) > 0 && <div className="text-[13px] text-[var(--color-ink-2)] mt-1"><b className="text-[var(--color-ink)]">Also accepted:</b> {secret.accept!.join(", ")}</div>}
    </div>) : null;
  /* a big outcome headline, no box */
  const Big = ({ eyebrow, text, color, size = 36, sub }: { eyebrow?: string; text: React.ReactNode; color?: string; size?: number; sub?: React.ReactNode }) => (
    <div className="text-center flex flex-col gap-1" role="status">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="display leading-tight" style={{ fontSize: size, color: color ?? "var(--color-gold)" }}>{text}</div>
      {sub && <div className="text-[14px] text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  /* what a team's captain typed */
  const Said = ({ t, text, empty, label }: { t: 0 | 1; text?: string | null; empty: string; label?: string }) => (
    <div className="text-center">
      <div className="eyebrow" style={{ color: tc(t) }}>{label ?? T[t].name}</div>
      {text ? <div className="font-bold text-[22px] leading-snug">{text}</div> : <div className="text-[14px] text-[var(--color-ink-3)] mt-0.5">{empty}</div>}
    </div>);
  const Typed = ({ t }: { t: 0 | 1 }) => {
    if (loading) return null;
    const x = secret.typed?.[t];
    return <Said t={t} text={x?.join("  /  ")} label={x ? `${T[t].name} typed` : T[t].name} empty={pub.timeUp ? "No answer" : `Waiting for ${T[t].name}’s captain to type…`} />;
  };
  /* RIGHT / WRONG under the answer, once there IS an answer (or the clock ran out with none: then the
     app suggests WRONG). The app's call is pre-selected; either button rules. `aloud`: the Battle with a
     host is answered out loud, so the buttons are there from the start, with no suggestion. */
  const Judge = ({ t, right, wrong, aloud }: { t: 0 | 1; right: Record<string, unknown>; wrong: Record<string, unknown>; aloud?: boolean }) => {
    const x = !loading && !!secret.typed?.[t], late = !x && !!pub.timeUp;
    if (!x && !late && !aloud) return null;
    const app = x ? secret.match?.[t] ?? null : late ? false : null;
    return <RulingPicker value={app} app={app} busy={busy || loading} label={`Rule on ${T[t].name}’s answer`} onPick={(v) => send(v ? right : wrong)} />;
  };
  /* the reveal screens: each team's answer with its ruling, which the host can always flip */
  const Rulings = ({ type, say, empty }: { type: string; say?: boolean; empty: string }) => (<>{([0, 1] as const).map((t) => { const x = pub.reveal?.typed?.[t]?.[0]; return (
    <div key={t} className="flex flex-col gap-2">
      <Said t={t} text={x} empty={empty} />
      {/* nothing written: nothing to rule on */}
      {x && <RulingPicker sticky value={pub.reveal?.ok?.[t]} app={pub.reveal?.app?.[t]} say={say} busy={busy} label={`Rule on ${T[t].name}’s answer`} onPick={(v) => send({ type, t, v })} />}
    </div>); })}</>);
  /* a results screen: exactly what the players see, and the host's button */
  const Results = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-4 flex-1">
      <OnScreen pub={pub} />
      <Result pub={pub} />
      {children}
    </div>);
  const Exit = () => (
    <div className="mt-auto flex flex-col gap-2">
      <p className="text-center text-[13px] text-[var(--color-ink-3)]">Exit takes every phone and the TV back to the home screen.</p>
      {/* home on this phone too, even if the TV is slow to answer */}
      <button className="btn btn-gold btn-lg btn-block" onClick={() => { send({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
    </div>);
  const Small = ({ label, move, ghost }: { label: string; move: Record<string, unknown>; ghost?: boolean }) =>
    <button className={"btn btn-sm " + (ghost ? "btn-ghost" : "")} disabled={busy} onClick={() => send(move)}>{label}</button>;
  const Pause = () => (pub.deadline || pub.left ? <Small label={pub.deadline ? "Pause" : "Resume"} move={{ type: "ui/pause" }} /> : null);
  const Waiting = ({ children }: { children: React.ReactNode }) => <Line className="mt-auto">{children}</Line>;

  if (pub.lifeline) return (
    <div className="flex flex-col gap-4 flex-1">
      <Big eyebrow={`Lifeline · ${T[pub.lifeline.team].name}`} text={pub.lifeline.key === "friend" ? "Call a Friend" : "Double Dip"}
        sub={pub.lifeline.key === "friend"
          ? <>Before the captain says a word, read this to the friend: &ldquo;Hi, quick quiz question. No ChatGPT, no Google, no asking anyone else. Straight off the top of your head. Ready?&rdquo;</>
          : "The captain gets two answers on this one. Either one right counts."} />
      {pub.lifeline.key === "friend" && <div className="flex flex-col items-center gap-2"><Clock deadline={pub.lifeline.deadline} left={pub.lifeline.left} size={90} timeUp={!pub.lifeline.deadline && !pub.lifeline.left} />
        {(pub.lifeline.deadline || pub.lifeline.left) && <button className="btn btn-sm" onClick={() => fire({ type: "ui/pauseFriend" })}>{pub.lifeline.deadline ? "Pause the call" : "Resume the call"}</button>}</div>}
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
        <div className="flex flex-col gap-2 mt-auto">
          <Typed t={turn} />
          <Judge t={turn} right={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: true }} wrong={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: false }} />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Pause />
          {pub.screen === "ask" && <Small ghost label="Change question" move={{ type: "round/swap" }} />}
        </div>
      </div>);
    case "answer": return <Results><Main label="Next" move={{ type: "round/afterAnswer" }} /></Results>;
    case "roundScore": return <Results><Main label="Next" move={{ type: "round/next" }} /></Results>;
    case "sudden": return !pub.sudden?.ready ? (
      <div className="flex flex-col gap-4 flex-1">
        <Big size={40} text="Sudden death" sub="One question, captains only. They buzz on their phones; first buzz types the answer. Wrong, and the other captain can buzz." />
        <Main label="Go" move={{ type: "sudden/go" }} />
      </div>) : (
      <div className="flex flex-col gap-3 flex-1">
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </div>) : (<>
          <Waiting>Waiting for a captain to buzz…{pub.out?.some(Boolean) ? ` (${T[pub.out[0] ? 0 : 1].name} is out)` : ""}</Waiting>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, next question" move={{ type: "sudden/win", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "sudden/swap" }} />
          </div>
        </>)}
      </div>);
    case "final": return <Results><Exit /></Results>;

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
        <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
          <div key={t} className="text-center">
            <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
            <div className="display text-[28px]">{secret.guesses?.[t] ?? "…"}</div></div>))}</div>
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change question" move={{ type: "closest/swap" }} /></div>
      </div>);
    case "closestReveal": return <Results><Main label="Next" move={{ type: "ui/next" }} /></Results>;
    case "flagQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Flag {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <FlagImg name={pub.flag} h={110} />
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change flag" move={{ type: "flag/swap" }} /></div>
      </div>);
    case "flagReveal": return (
      <div className="flex flex-col gap-4 flex-1">
        <OnScreen pub={pub} />
        <Result pub={pub} headOnly />
        <Rulings type="ui/flagOk" empty="No answer" />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "dishQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">{pub.dish?.kind} · {pub.dish?.ings.length} of {pub.dish?.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <AnswerCard />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "dish/right" }} wrong={{ type: "dish/wrong" }} />
          {!secret.typed?.[pub.buzz] && <Line className="!text-[13px] !text-[var(--color-ink-3)]">They have {pub.timers?.dishType ?? 10} seconds to type it.</Line>}
        </div>) : (<>
          {pub.dish && <div className="card"><Ings ings={pub.dish.ings} small /></div>}
          <Waiting>{pub.dish?.late != null ? `Time's up for ${T[pub.dish.late].name}. ` : ""}Waiting for a buzz…{[0, 1].filter((t) => pub.out?.[t]).map((t) => ` ${T[t].name} is out.`).join("")}</Waiting>
          <div className="flex gap-2 justify-center"><Pause />{!pub.out?.some(Boolean) && <Small ghost label="Change this one" move={{ type: "dish/swap" }} />}</div>
        </>)}
      </div>);
    case "dishReveal": return <Results><Main label="Next" move={{ type: "dish/next" }} /></Results>;
    /* level at the end of a mini-game: one more, or a point each */
    case "miniTie": case "sayTie": case "flagTie": case "dishTie": case "mapTie": case "battleLevel": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={pub.mini?.title} size={34} text={tieHead(pub)} sub={tieCall(pub)} />
        <div className="flex flex-col gap-3 mt-auto">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "tie/stop" })}>A point each</button>
        </div>
      </div>);
    case "miniSummary": case "flagSummary": case "dishSummary": case "mapSummary": case "saySummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <Result pub={pub} />
        {S?.note && <Line className="!text-[13px]">{S.note}</Line>}
        {S?.needsHost ? (<>
          <div className="eyebrow text-center">Still level. Who gets the {pub.mini?.pts} points?</div>
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
        <div className="flex flex-wrap gap-2 justify-center mt-auto"><Pause />{!pub.map?.hint && <Small label="Show hint" move={{ type: "map/hint" }} />}<Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change map" move={{ type: "map/swap" }} /></div>
      </div>);
    case "mapReveal": { const unruled = pub.reveal?.ok?.some((v) => v == null); return (
      <div className="flex flex-col gap-4 flex-1">
        <OnScreen pub={pub} />
        <Result pub={pub} headOnly />
        <Line className="!text-[13px]">Who got it? The idea counts, not the exact words.</Line>
        <Rulings type="ui/mapOk" empty="No answer" />
        <Main label={unruled ? "Rule on both answers first" : "Next"} move={{ type: "ui/next" }} off={unruled} />
      </div>); }
    case "auctionBid": { const A = pub.auction!; return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={`Auction · leg ${A.leg + 1} of ${A.n}`} size={30} text={A.cat} sub={A.notes} />
        <Line className="!text-[16px] !text-[var(--color-ink)]">{A.bid ? <>Bid: <b>{A.bid}</b> by <b style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</b></> : "No bid yet"}<br />
          <span className="text-[var(--color-ink-2)]">The captains bid on their phones. <b style={{ color: tc(A.turn) }}>{T[A.turn].name}</b> to bid.</span></Line>
        <div className="flex justify-center mt-auto">{!A.bid && <Small ghost label="Change the category" move={{ type: "auction/skip" }} />}</div>
      </div>); }
    case "auctionRun": { const A = pub.auction!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-[22px]" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <div className="text-[15px] text-[var(--color-ink-2)]">{A.cat}{A.notes ? `. ${A.notes}` : ""}</div>
        <Counter A={A} fire={fire} h={96} fs={46}><Pause /><Small ghost label="Time's up" move={{ type: "auction/resolve" }} /></Counter>
      </div>); }
    case "auctionLeg": return <Results><Main label="Next" move={{ type: "auction/nextLeg" }} /></Results>;
    case "auctionResult": return <Results><Main label="Next" move={{ type: "auction/done" }} /></Results>;
    case "sayQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Don&rsquo;t say the same · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {([0, 1] as const).map((t) => <p key={t} className="text-[15px]"><b style={{ color: tc(t) }}>{T[t].name}:</b> {secret.typed?.[t]?.[0] ?? "thinking…"}{secret.typed?.[t] ? <> · <Verdict v={!secret.match?.[t]} say /></> : ""}</p>)}
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change prompt" move={{ type: "say/swap" }} /></div>
      </div>);
    case "sayReveal": return (
      <div className="flex flex-col gap-4 flex-1">
        <OnScreen pub={pub} />
        <Result pub={pub} headOnly />
        <Rulings type="ui/sayOk" say empty="Nothing" />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "battleQ": { const B = pub.battle!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-[22px]" style={{ color: tc(B.cap) }}>{T[B.cap].name} · {B.i + 1}/{B.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        <div className="flex flex-col gap-2 mt-auto">
          {secret.typed?.[B.cap] && <Typed t={B.cap} />}
          <Judge t={B.cap} aloud={pub.mode === "host"} right={{ type: "battle/mark", got: true }} wrong={{ type: "battle/mark", got: false }} />
        </div>
        <div className="flex gap-2 justify-center"><Pause /><Small ghost label="Change question" move={{ type: "battle/swap" }} /></div>
      </div>); }
    case "battleHandoff": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow="Halfway" size={30} color="var(--color-ink)" text={`${T[0].name} scored ${pub.battle?.score[0]}`} sub={`Now ${T[1].name}’s captain.`} />
        <Main label={`Start ${T[1].name}'s questions`} move={{ type: "battle/start" }} />
      </div>);
    case "battleTie": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="eyebrow">Battle tie-breaker: first captain to buzz</div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-[26px] text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </div>) : (<>
          <Waiting>Waiting for a buzz…</Waiting>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, another one" move={{ type: "battle/tbWin", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "battle/tbSwap" }} />
          </div>
        </>)}
      </div>);
    case "battleSummary": return <Results><Main label="Next" move={{ type: "battle/done" }} /></Results>;
    default: return <div className="eyebrow text-center">Eyes on the TV</div>;
  }
  }
}

export const flagText = (f: NonNullable<Pub["flags"]>[number]) => `${iso(f.name)} ${f.kind === "paste" ? "(tried to paste)" : f.ms != null ? `(left the screen ${Math.round(f.ms / 1000)}s)` : "(left the screen, still away)"}`;
/* the host's warning: who left the game screen during this question (another app, a search) */
function AwayCard({ pub }: { pub: Pub }) {
  const now = (pub.flags || []).filter((f) => f.qid && f.qid === pub.qid);
  if (!now.length) return null;
  return (
    <p className="text-center text-[14px] font-bold" role="alert" style={{ color: "var(--color-no)" }}>
      Flagged during this question: {now.map(flagText).join(", ")}
    </p>);
}
/* the host's full list, in the Players panel */
export function AwayLog({ pub }: { pub: Pub | null }) {
  const all = pub?.flags || [];
  return (
    <div className="card flex flex-col gap-2">
      <div className="eyebrow" style={{ color: "var(--color-no)" }}>Flagged: left the screen or pasted</div>
      {all.length ? [...all].reverse().map((f) => (
        <div key={f.id} className="text-[14px]"><b style={{ color: tc(f.team) }}>{f.name}</b> · {f.label} · {f.kind === "paste" ? "tried to paste an answer" : f.ms != null ? `left the screen ${Math.round(f.ms / 1000)}s` : "left the screen, still away"}</div>))
        : <p className="text-[14px] text-[var(--color-ink-2)]">Nobody so far. A phone that switches app or tab during a question shows up here and on the TV.</p>}
    </div>);
}

/* the Auction while it's bid: each captain's latest bid, the one to beat lit up */
function BidBoard({ pub }: { pub: Pub }) {
  const A = pub.auction!, T = pub.teams;
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {([0, 1] as const).map((t) => { const b = A.bids?.[t], top = A.by === t && A.bid > 0; return (
        <div key={t} className="rounded-[14px] py-2.5 px-2 flex flex-col items-center" style={{ background: top ? "rgba(245,197,24,.12)" : "rgba(255,255,255,.04)", border: `1px solid ${top ? "rgba(245,197,24,.55)" : "transparent"}` }}>
          <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
          <div className="display text-[38px] leading-none mt-1">{b ?? "–"}</div>
          <div className="text-[11px] font-bold mt-1" style={{ color: top ? "var(--color-gold)" : "var(--color-ink-3)" }}>{top ? "Highest bid" : A.turn === t ? "To bid" : b == null ? "No bid yet" : "Outbid"}</div>
        </div>); })}
    </div>);
}

/* who won what, on every phone (the TV isn't the only one that gets to know) */
/* headOnly: just the headline (the host's reveal screens show the rulings themselves) */
function Result({ pub, mine, headOnly }: { pub: Pub; mine?: 0 | 1; headOnly?: boolean }) {
  const T = pub.teams, sc = pub.screen, m = pub.mini;
  const name = (t: 0 | 1) => <b style={{ color: tc(t) }}>{T[t].name}</b>;
  /* the outcome: a big headline, no box (boxes are for things you can tap) */
  const head = (t: 0 | 1 | null | undefined, text: string, sub?: string) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      <div className="display text-[32px] leading-tight" style={{ color: t == null ? "var(--color-ink-2)" : tc(t) }}>{text}</div>
      {t != null && mine != null && <div className="text-[13px] font-bold" style={{ color: t === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{t === mine ? "That's your team!" : "Not this time."}</div>}
      {sub && <div className="text-[13px] text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  const legW = (w: unknown) => (w === 0 || w === 1 ? w : null) as 0 | 1 | null;
  /* the mini-game's own score, big: TEAM A 3 – 4 TEAM B (the same board as the TV's) */
  const board = (w: Two<number>, label: string, win: 0 | 1 | null) => <ScoreBoard pub={pub} w={w} win={win} label={label} size="phone" />;
  const rows = (ok: (t: 0 | 1) => React.ReactNode) => (
    <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
      <div key={t} className="text-center"><div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div><div className="text-[15px] font-bold mt-1">{ok(t)}</div></div>))}</div>);
  if (sc === "answer" && pub.result) {
    const quiet = ([0, 1] as const).filter((t) => silent(pub, t)).map((t) => `${T[t].name}: ${silent(pub, t)}`).join(" · ");
    return head(pub.result.by, pub.result.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? ", stolen!" : ""}`, quiet || undefined);
  }
  if (sc === "roundScore") return (<>
    {head(null, `End of round ${pub.r + 1}`)}
    {board([T[0].score, T[1].score], "The score", null)}
    <p className="text-center text-[13px] text-[var(--color-ink-2)]">This round: {name(0)} +{pub.roundPts?.[0] ?? 0} · {name(1)} +{pub.roundPts?.[1] ?? 0}</p></>);
  if (sc === "closestReveal" && pub.reveal) { const w = pub.reveal.w, ans = Number(pub.reveal.answer); return (<>
    {head(legW(w), w === "tie" ? "A point each" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "")}
    {rows((t) => { const g = pub.reveal?.guesses?.[t]; return g == null ? "No answer" : `${g} (off by ${Math.abs(g - ans)})`; })}</>); }
  if ((sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal") && pub.reveal) {
    const say = sc === "sayReveal", w = pub.reveal.w;
    const ok = (t: 0 | 1) => sc === "mapReveal" ? pub.map?.ruled?.[t] : pub.reveal?.ok?.[t];
    const top = (sc !== "mapReveal" || (ok(0) != null && ok(1) != null)) && head(legW(w), w === "tie" ? "A point each" : w === "none" ? "Nobody gets it" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "");
    if (headOnly) return <>{top}</>;
    /* "TEAM A  DODGED IT", and what they wrote under it */
    return (<>
      {top}
      <div className="flex flex-col gap-3">{([0, 1] as const).map((t) => { const v = ok(t), x = pub.reveal?.typed?.[t]?.[0]; return (
        <div key={t} className="text-center">
          <div className="flex items-baseline justify-center gap-x-2">
            <span className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</span>
            {v == null ? <span className="text-[12px] text-[var(--color-ink-3)]">waiting for a ruling</span> : <Verdict v={v} say={say} size={14} />}
          </div>
          <div className="text-[16px] font-bold mt-1" style={{ color: x ? undefined : "var(--color-ink-3)" }}>{x ?? (say ? "Nothing" : "No answer")}</div>
        </div>); })}</div></>);
  }
  if (sc === "dishReveal" && pub.reveal) return head(legW(pub.reveal.w), legW(pub.reveal.w) != null ? `${T[pub.reveal.w as 0 | 1].name} got it` : "Nobody got it");
  if (sc === "auctionLeg" && pub.auction?.last) { const L = pub.auction.last; return (<>
    {/* one headline (who takes the leg); the how, small; the legs, as a board */}
    <div className="text-center flex flex-col items-center gap-2" role="status" aria-live="polite">
      <span className={"verdict text-[13px] " + (L.made ? "pos" : "neg")}>{L.made ? "Delivered" : "Short"}</span>
      <div className="display text-[32px] leading-none" style={{ color: tc(L.won) }}>{T[L.won].name} take the leg</div>
      <div className="text-[14px] text-[var(--color-ink-2)]">{name(L.by)} bid {L.bid}, named {L.count}.</div>
      {mine != null && <div className="text-[13px] font-bold" style={{ color: L.won === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{L.won === mine ? "That's your team!" : "Not this time."}</div>}
    </div>
    {board(pub.auction.wins, "Legs so far", null)}</>); }
  if (sc === "auctionResult" && pub.auction) { const A = pub.auction, w = A.winner ?? null; return (<>
    {head(w, w == null ? "Tie" : `${T[w].name} win the Auction`, w != null ? `+${A.award?.[w] ?? m?.pts} points` : "")}
    {board(A.wins, "Legs won", w)}</>); }
  if (/Summary$/.test(sc) && sc !== "battleSummary" && pub.summary) { const S = pub.summary; return (<>
    {head(S.winner, S.needsHost ? "Still level" : S.winner == null ? "A split" : `${T[S.winner].name} win ${m?.title ?? "it"}`,
      S.needsHost ? "The host decides" : S.winner == null ? `${S.award?.[0] ?? 0} point${S.award?.[0] === 1 ? "" : "s"} each` : `+${S.award?.[S.winner] ?? m?.pts} points`)}
    {board(S.wins, "Legs won", S.winner)}</>); }
  if (sc === "battleSummary" && pub.battle) { const B = pub.battle, w = B.winner ?? null; return (<>
    {head(w, w == null ? (B.note || "Tie") : `${T[w].name} win the Battle`, w != null ? `+${B.award?.[w] ?? m?.pts} points` : "")}
    {board(B.score, "Right answers", w)}</>); }
  if (sc === "final") { const w = pub.winner ?? null; return (
    <div className="text-center flex flex-col gap-2 py-4" role="status" aria-live="polite">
      <div className="eyebrow">{w == null ? "The night ends" : "The winner"}</div>
      <div className="display text-[52px] leading-none" style={{ color: tc(w) }}>{w == null ? "A draw" : T[w].name}</div>
      {w != null && mine != null && <div className="text-[15px] font-bold" style={{ color: w === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{w === mine ? "You won the night!" : "Not tonight."}</div>}
      <div className="mt-2">{board([T[0].score, T[1].score], "Final score", w)}</div>
    </div>); }
  return null;
}

/* what's on screen, close up: the question, the flag or the ingredients.
   It can't be selected or copied (no pasting it into a chatbot), and while
   the clock is paused it's hidden. */
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
/* counting: this phone counts the Auction's names, and shows its own count */
function OnScreen({ pub, counting }: { pub: Pub; counting?: boolean }) {
  if (pub.paused) return <div className="text-center py-8" role="status"><div className="display text-[40px]" style={{ color: "var(--color-gold)" }}>Paused</div><p className="text-[14px] text-[var(--color-ink-2)] mt-1">The question comes back when the clock restarts.</p></div>;
  return (<div className="noselect contents" {...noCopy}>
    {pub.question && ["ask", "steal", "answer", "sudden", "miniQ", "closestReveal", "sayQ", "sayReveal", "battleQ", "battleTie"].includes(pub.screen) && <p className="font-bold text-[19px] leading-snug text-center">{pub.question}</p>}
    {(pub.screen === "flagQ" || pub.screen === "flagReveal") && <FlagImg name={pub.flag} h={150} />}
    {pub.map && <MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={260} title={pub.map.title} />}
    {pub.map?.reveal && <div className="display text-[26px] text-center" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>}
    {pub.auction && pub.screen === "auctionLeg" && <p className="text-center text-[14px] text-[var(--color-ink-2)]"><span className="eyebrow mr-2">Leg {pub.auction.wins[0] + pub.auction.wins[1]}</span>{pub.auction.cat}</p>}
    {pub.auction && /^auction(Bid|Run)$/.test(pub.screen) && <div className="text-center"><div className="eyebrow">Category</div><div className="display text-[28px]" style={{ color: "var(--color-gold)" }}>{pub.auction.cat}</div>
      {pub.screen === "auctionBid" && <BidBoard pub={pub} />}
      {pub.screen === "auctionRun" && !counting && <div className="display text-[44px] mt-1">{pub.auction.count} / {pub.auction.bid}</div>}</div>}
    {(pub.screen === "dishQ" || pub.screen === "dishReveal") && pub.dish && <div className="card"><div className="eyebrow mb-2">Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div><Ings ings={pub.dish.ings} /></div>}
    {pub.reveal && /Reveal$/.test(pub.screen) && pub.screen !== "mapReveal" && pub.screen !== "sayReveal" && <div className="display text-[30px] text-center" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div>}
    {pub.reveal && pub.screen === "sayReveal" && <div className="text-center"><div className="eyebrow">The app&rsquo;s word</div><div className="display text-[30px]" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div></div>}
    {pub.screen === "answer" && pub.result && <div className="display text-[32px] text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
    {["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "battleQ"].includes(pub.screen) && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "dishQ" ? 70 : pub.screen === "ask" || pub.screen === "steal" ? 72 : 90} /></div>}
    {/* the Battle: the last answer, once there's no new question to read (during the questions it's on the TV only) */}
    {pub.battle?.last && /^battle(Handoff|Summary)$/.test(pub.screen) && <BattleAnswer last={pub.battle.last} />}
  </div>);
}

/* the Battle's last answer, once it's settled: "Answer: X" */
export function BattleAnswer({ last, size = 15, prev }: { last: { answer: string; got: boolean | null }; size?: number; prev?: boolean }) {
  /* "Last answer" while the next question is up, so it can't be read as that one's */
  return <p className="text-center text-[var(--color-ink-2)]" style={{ fontSize: size }} role="status">{prev ? "Last answer" : "Answer"}: <b className="text-[var(--color-ink)]">{last.answer}</b>{last.got != null && <> · <Verdict v={last.got} /></>}</p>;
}

/* the screens that show who won what (see Result) */
const RESULT = /^(answer|roundScore|closestReveal|flagReveal|sayReveal|mapReveal|dishReveal|auctionLeg|auctionResult|\w+Summary|final)$/;

/* what this question means for YOU, under the "Question for TEAM" head */
function youLine(pub: Pub, me: Member, capName?: string) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain", ours = pub.turn === mine, them = T[pub.turn ?? 0].name;
  if (capName) capName = iso(capName);
  const to = capName ? `send ideas to ${capName}` : "send ideas to your captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend." : "Double Dip: two answers on this one.") : `${T[pub.lifeline.team].name} are using a lifeline.`;
  if (pub.pending) return pub.pending.team === mine ? "Answer sent. The other captain can change the call."
    : cap ? `${them} answered. Your call below.` : `${them} answered. ${capName || "Your captain"} rules on it.`;
  /* sent, with a host: locked in until the host rules */
  if (ours && pub.sent?.[mine] && pub.mode === "host") return cap ? "Sent. Waiting for the host." : "Your captain has answered. The host decides.";
  if (pub.screen === "steal") return ours ? (cap ? "They missed. Your steal, captain: type it below." : `They missed. Your steal: ${to}.`) : `You missed. ${them} can steal it now.`;
  return ours ? (cap ? "Your question, captain: type the answer below." : `Your team's question: ${to}.`) : "Not yours. If they miss, you can steal it.";
}

/* the top of a phone: Classic's layouts for the intros and questions, a plain status line for the rest */
function Head({ pub, me, capName, canArm, onArm, busy }: { pub: Pub; me: Member; capName?: string; canArm?: (t: 0 | 1) => boolean; onArm?: (t: 0 | 1) => void; busy?: boolean }) {
  if (pub.screen === "roundIntro") return <RoundIntro pub={pub} size="phone" canArm={canArm} onArm={onArm} busy={busy} />;
  if (pub.screen === "ask" || pub.screen === "steal") return <AskHead pub={pub} size="phone" you={youLine(pub, me, capName)} go={pub.turn === me.team && !pub.lifeline && !pub.pending} />;
  if (/Intro$/.test(pub.screen) && pub.mini) return <MiniIntro pub={pub} size="phone" />;
  if (RESULT.test(pub.screen)) return null;            // the result says it
  /* on a question, the question (or flag, or map) is the thing to look at: the instruction steps back */
  const quiet = QUIET.includes(pub.screen) && !pub.paused;
  return <p className={"text-center leading-snug " + (quiet ? "text-[14px] font-semibold text-[var(--color-ink-3)]" : "font-bold text-[17px]")} role="status" aria-live="polite">{status(pub, me)}</p>;
}

const QUIET = ["miniQ", "flagQ", "mapQ", "sayQ"];
function status(pub: Pub, me: Member) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend" : "Double Dip: two answers") : `${T[pub.lifeline.team].name} used a lifeline`;
  if (TIE_SCREENS.includes(pub.screen)) return `${tieHead(pub)}. ${tieCall(pub)}`;
  switch (pub.screen) {
    case "ask": return pub.turn === mine ? (cap ? "Your question. Type your answer." : "Your team's question. Help your captain!") : `${T[pub.turn ?? 0].name} is answering. Get ready to steal.`;
    case "steal": return pub.turn === mine ? (cap ? "Steal! Type your answer." : "Steal! Help your captain.") : `${T[pub.turn ?? 0].name} can steal it`;
    case "answer": return pub.result?.by == null ? "Nobody scored" : pub.result.by === mine ? `+${pub.result.pts} to your team!` : `${T[pub.result.by].name} scored`;
    case "roundIntro": return `Round ${pub.r + 1}: ${pub.theme}`;
    case "roundScore": return `End of round ${pub.r + 1}`;
    case "sudden": return cap ? "Sudden death: captains only. Buzz to answer." : "Sudden death: captains only. Not a word!";
    case "miniQ": return cap ? "Type a number. Nearest wins." : "Closest To Wins: help your captain";
    case "flagQ": return cap ? "Which country? One go." : "Guess the Flag: help your captain";
    case "dishQ": return pub.buzz === mine ? (cap ? "You buzzed! Type it, quick." : "Your captain buzzed!") : pub.buzz != null ? `${T[pub.buzz].name} buzzed` : pub.out?.[mine] ? (pub.dish?.late === mine ? "Time's up. You're out of this one." : "You're out of this one") : cap ? "Know it? BUZZ!" : "Cocktail or Dish: help your captain";
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
  const np = useNoPaste(code, pub.qid);
  const suggest = async () => { const t = text.trim(); if (!t) return; try { await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSent(t); setText(""); } catch { /* the phone already says so; the text stays */ } };
  return (
    <div className="flex flex-col gap-4 flex-1">
      <Head pub={pub} me={me} capName={cap?.name} />
      <OnScreen pub={pub} />
      <Result pub={pub} mine={mine} />
      {canSuggest && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="sug">Suggest to {cap?.name || "your captain"}</label>
          <div className="flex gap-2">
            <input id="sug" {...np.props} className="input" value={text} maxLength={80} inputMode="text" placeholder={pub.screen === "miniQ" ? "A number" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
            <button className="btn" disabled={!text.trim()} onClick={() => void suggest()}>Send</button>
          </div>
          {np.hint}
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
  return <p className="text-center text-[13px] text-[var(--color-ink-3)]" role="status">Waiting for {who} to {TIE_SCREENS.includes(pub.screen) ? "choose: one more, or a point each" : `tap ${/^Start/.test(label) ? "Start" : label}`}.</p>;
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
  const np = useNoPaste(code, pub.qid);
  const act = async (kind: string, payload: Record<string, unknown>) => { setBusy(true); try { await sendAction(code, kind, payload); return true; } catch { return false; /* the phone already says so */ } finally { setBusy(false); } };
  const nxt = (move: Record<string, unknown>) => act("next", { move, step: pub.step });
  /* quick taps (+1, pausing a call): straight out, nothing waits for them */
  const fire = (move: Record<string, unknown>) => { void sendAction(code, "next", { move, step: pub.step }).catch(() => {}); };

  const myTurn = (sc === "ask" || sc === "steal") && pub.turn === mine && !pub.lifeline;
  const dip = sc === "ask" && (pub.llUsed?.[mine] || []).includes("dip");
  /* one answer per question: once it's sent it's locked (the app checks it, or the host decides) */
  const locked = !!pub.pending || !!pub.sent?.[mine];
  const canType = !pub.paused && ((myTurn && !locked) || (sc === "miniQ" && !pub.sent?.[mine]) || ((sc === "flagQ" || sc === "mapQ" || sc === "sayQ") && !pub.sent?.[mine])
    || (sc === "dishQ" && pub.buzz === mine && !pub.pending) || ((sc === "sudden" || sc === "battleTie") && pub.buzz === mine && !pub.pending)
    /* the Battle: typed with no host; with a host it's said out loud */
    || (sc === "battleQ" && nohost && pub.battle?.cap === mine && !locked));
  const canBuzz = (sc === "dishQ" && pub.buzz == null && !pub.out?.[mine]) || (sc === "sudden" && !!pub.sudden?.ready && pub.buzz == null && !pub.out?.[mine])
    || (sc === "battleTie" && pub.buzz == null && !pub.out?.[mine]);
  const sugs = useSuggestions(code, pub.qid, members, mine, ANSWERING.includes(sc));
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

  /* Closest To Wins: "1.5 million", "2k", "€25" all count; what the TV will read is shown back */
  const guess: number = sc === "miniQ" && a.trim() ? QMB.parseNumber(a, pub.question) : NaN;
  const per = /\bin (thousand|million|billion)s\b/i.exec(pub.question || "")?.[1].toLowerCase();
  const send = async () => {
    if (sc === "miniQ") { if (Number.isFinite(guess) && await act("answer", { n: a })) setSentTxt(a); return; }
    const texts = [a, b].map((x) => x.trim()).filter(Boolean);
    if (!texts.length) return;
    if (await act("answer", { texts })) setSentTxt(texts.join(" / "));
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      <Head pub={pub} me={me} canArm={(t) => t === mine} onArm={() => void act("lifeline", { key: "dbl" })} busy={busy} />

      {/* no host: what was sent, the app's call, and (the other captain) RIGHT or WRONG */}
      {pub.pending && (pub.pending.team === mine ? (
        <div className="text-center flex flex-col gap-1" role="status"><div className="eyebrow">You sent</div><div className="display text-[30px]">{pub.pending.text}</div>
          <div className="font-bold text-[15px]">The app says <Verdict v={pub.pending.v} /></div>
          <div className="text-[13px] text-[var(--color-ink-2)]">{T[theirs].name} can change the call · <Countdown at={pub.pending.until} /></div></div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-center">
            <div className="eyebrow" style={{ color: tc(theirs) }}>{T[theirs].name} said</div>
            <div className="display text-[30px]">{pub.pending.text}</div>
          </div>
          <RulingPicker value={pub.pending.v} app={pub.pending.v} busy={busy} label={`Rule on ${T[theirs].name}’s answer`} onPick={(v) => void nxt({ type: "ui/rule", v })} />
          <p className="text-center text-[13px] text-[var(--color-ink-3)]">Your call. Tap nothing and the app&rsquo;s call stands in <Countdown at={pub.pending.until} />s.</p>
        </div>))}

      {!pub.pending && <OnScreen pub={pub} counting={nohost && sc === "auctionRun" && A?.by === theirs} />}
      {!pub.pending && <Result pub={pub} mine={mine} />}


      {/* no host, Call a Friend: the calling captain closes the card */}
      {nohost && pub.lifeline?.key === "friend" && pub.lifeline.team === mine && (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/closeLifeline" })}>Back to the question</button>)}
      {/* no host, Call a Friend: the lead captain can stop the call's clock */}
      {nohost && lead && pub.lifeline?.key === "friend" && (pub.lifeline.deadline || pub.lifeline.left) && (
        <button className="btn btn-sm self-center" onClick={() => fire({ type: "ui/pauseFriend" })}>{pub.lifeline.deadline ? "Pause the call" : "Resume the call"}</button>)}

      {canBuzz && <button className="btn btn-lg btn-block display" style={{ minHeight: 110, fontSize: 48, background: tc(mine), color: "#04050e", borderColor: "transparent" }} disabled={busy} onClick={() => { buzzHand(40); void act("buzz", {}); }}>BUZZ</button>}

      {canType && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="ans">{sc === "miniQ" ? "Your number" : dip ? "Your two answers" : "Your answer"}</label>
          <input id="ans" {...np.props} className="input" value={a} maxLength={80} autoComplete="off" autoCorrect="off" spellCheck={false}
            inputMode="text" placeholder={sc === "miniQ" ? "e.g. 236 or 1.5 million" : "Type it"} onChange={(e) => setA(e.target.value)} />
          {sc === "miniQ" && a.trim() && (Number.isFinite(guess)
            ? ![String(guess), guess.toLocaleString("en-GB")].includes(a.trim()) && <div className="text-[13px] text-[var(--color-ink-2)]">Counts as <b>{guess.toLocaleString("en-GB")}{per ? ` ${per}` : ""}</b></div>
            : <p className="text-[13px] text-[var(--color-no)]" role="alert">That isn&rsquo;t a number.</p>)}
          {dip && <input {...np.props} className="input" aria-label="Your second answer" value={b} maxLength={80} placeholder="Second answer" onChange={(e) => setB(e.target.value)} />}
          {np.hint}
          <button className="btn btn-gold btn-lg" disabled={busy || !a.trim() || (sc === "miniQ" && !Number.isFinite(guess))} onClick={() => void send()}>{sc === "miniQ" ? "Lock in" : "Send"}</button>
          {(sc === "ask" || sc === "steal") && <div className="text-[13px] text-[var(--color-ink-3)]">One go: once you send it, it&rsquo;s locked{nohost ? " and the app checks it" : " until the host decides"}.</div>}
        </div>)}
      {!canType && pub.sent?.[mine] && (["miniQ", "flagQ", "mapQ", "sayQ"].includes(sc) || (myTurn && !pub.pending)) && (
        <p className="text-center font-bold text-[16px]" role="status">Locked in{sentTxt ? `: ${sentTxt}` : ""}.</p>)}

      {/* the lifelines: everyone sees them; the captain whose question it is taps */}
      {sc === "ask" && <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" busy={busy}
        onUse={myTurn && !locked ? (k) => void act("lifeline", { key: k }) : undefined} />}

      {/* the Auction: bidding is always the captains' */}
      {sc === "auctionBid" && A && A.turn === mine && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">{A.bid ? `Beat ${A.bid}, or pass` : "Open the bidding"}</div>
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "auction/raise", n: A.bid + 1 })}>Raise to {A.bid + 1}</button>
          <div className="flex gap-2">
            <input {...np.props} className="input" aria-label="Custom bid" inputMode="numeric" value={bid} placeholder="Custom bid" onChange={(e) => setBid(e.target.value.replace(/\D/g, "").slice(0, 3))} />
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
          <Counter A={A} fire={fire} h={92} fs={44} />
        </div>)}

      {/* no host: each captain referees the other team's flag, word and map, and can change the call until Next */}
      {nohost && (sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal") && pub.reveal && (
        <div className="flex flex-col gap-2">
          <div className="eyebrow text-center" style={{ color: tc(theirs) }}>Your call on {T[theirs].name}&rsquo;s answer{sc === "mapReveal" ? ": the idea counts, not the exact words" : ""}</div>
          <RulingPicker say={sc === "sayReveal"} value={pub.reveal.ok?.[theirs]} app={pub.reveal.app?.[theirs]} busy={busy} label={`Rule on ${T[theirs].name}’s answer`}
            onPick={(v) => void nxt(sc === "mapReveal" ? { type: "ui/mapRule", v } : { type: sc === "flagReveal" ? "ui/flagOk" : "ui/sayOk", t: theirs, v })} />
        </div>)}
      {/* the end of the night, no host: either captain sends everyone home */}
      {nohost && sc === "final" && (<>
        <p className="text-center text-[13px] text-[var(--color-ink-3)] mt-auto">Exit takes every phone and the TV back to the home screen.</p>
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => { void nxt({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
      </>)}
      {/* no host, level at the end of a mini-game: the lead captain picks */}
      {nohost && TIE_SCREENS.includes(sc) && mayNext && pub.nextBy && (
        <div className="flex flex-col gap-3 mt-auto dock">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/stop" })}>A point each</button>
        </div>)}

      {/* no host: start, go and next — the lead captain (Team A's) */}
      {showNext && next && (
        <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: next[1] })}>{next[0]}</button>)}
      {nohost && mayNext && pub.nextBy && sc === "sudden" && !pub.sudden?.ready && <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: "sudden/go" })}>Go</button>}
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
                <b style={{ color: tc(mine) }}><bdi>{members.find((m) => m.user_id === s.user_id)?.name}</bdi>:</b> {s.text}</button>))}
          </div>
        </div>)}

    </div>
  );
}
