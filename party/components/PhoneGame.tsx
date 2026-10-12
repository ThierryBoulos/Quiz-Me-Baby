"use client";
import { useEffect, useMemo, useState } from "react";
import type { Pub, Secret } from "@/lib/game";
import type { Member } from "@/lib/room";
import { loadBank } from "@/lib/engine";
import { sb, sendAction } from "@/lib/supabase";
import { Clock } from "./Clock";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };
const ANSWERING = ["ask", "steal", "miniQ", "flagQ", "dishQ", "sudden"];

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
function Scores({ pub }: { pub: Pub }) {
  const T = pub.teams;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1].map((t) => (
        <div key={t} className="card text-center !p-3" style={{ borderColor: tc(t as 0 | 1) }}>
          <div className="display text-[18px]" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
          <div className="display text-[32px]">{T[t].score}</div>
        </div>))}
    </div>);
}

type Send = (move: Record<string, unknown>) => void;
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
      <div className="card" style={{ borderColor: tc(t) }}>
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

  const mk = pub.mini?.key, S = pub.summary;
  switch (pub.screen) {
    case "roundIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">Round {pub.r + 1} of {pub.N}</div>
          <div className="display text-[42px]" style={{ color: "var(--color-gold)" }}>{pub.theme}</div>
          <div className="text-[14px] text-[var(--color-ink-2)]"><b style={{ color: tc(pub.first) }}>{T[pub.first ?? 0].name}</b> answers first</div></div>
        <div className="card text-[14px] text-[var(--color-ink-2)]">Captains arm double points on their own phones.
          {[0, 1].map((t) => <div key={t} className="mt-1"><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {pub.dbl?.[t] ? "double points armed" : T[t].ll.dbl ? "not this round" : "double already used"}</div>)}</div>
        <Main label={`Start: question for ${T[pub.first ?? 0].name}`} move={{ type: "round/begin" }} />
      </div>);
    case "ask": case "steal": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="display text-[26px]" style={{ color: tc(turn) }}>{pub.screen === "steal" ? "Steal: " : ""}{T[turn].name}</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} />
        </div>
        <p className="font-bold text-[18px] leading-snug">{pub.question}</p>
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
    case "miniIntro": case "flagIntro": case "dishIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        <div className="card text-center"><div className="eyebrow">Mini-game</div>
          <div className="display text-[38px]" style={{ color: "var(--color-gold)" }}>{pub.mini?.title}</div>
          <div className="text-[14px] text-[var(--color-ink-2)]">Best of {pub.mini?.of} · winner takes {pub.mini?.pts} points. The rules are on the TV.</div></div>
        <Main label="Start" move={{ type: mk + "/start" }} />
      </div>);
    case "miniQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Closest To Wins · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className="font-bold text-[18px]">{pub.question}</p>
        <AnswerCard />
        <div className="grid grid-cols-2 gap-3">{[0, 1].map((t) => (
          <div key={t} className="card text-center !p-3" style={{ borderColor: tc(t as 0 | 1) }}>
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
    case "miniSummary": case "flagSummary": case "dishSummary": return (
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
    default: return <div className="eyebrow text-center">Eyes on the TV</div>;
  }
}

/* what's on screen, close up: the question, the flag or the ingredients */
function OnScreen({ pub }: { pub: Pub }) {
  return (<>
    {pub.question && ["ask", "steal", "answer", "sudden", "miniQ", "closestReveal"].includes(pub.screen) && <p className="font-bold text-[19px] leading-snug text-center">{pub.question}</p>}
    {(pub.screen === "flagQ" || pub.screen === "flagReveal") && <Flag name={pub.flag} h={150} />}
    {(pub.screen === "dishQ" || pub.screen === "dishReveal") && pub.dish && <div className="card"><div className="eyebrow mb-2">Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div><Ings ings={pub.dish.ings} /></div>}
    {pub.reveal && /Reveal$/.test(pub.screen) && <div className="display text-[30px] text-center" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div>}
    {pub.screen === "answer" && pub.result && <div className="display text-[32px] text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
    {["ask", "steal", "miniQ", "flagQ", "dishQ"].includes(pub.screen) && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "dishQ" ? 70 : 90} /></div>}
  </>);
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
  const canSuggest = !!pub.qid && ANSWERING.includes(pub.screen) && !(pub.screen === "sudden");
  const suggest = async () => { const t = text.trim(); if (!t) return; await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSent(t); setText(""); };
  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="card text-center" style={{ borderColor: tc(pub.turn === mine && ["ask", "steal"].includes(pub.screen) ? mine : null) }}>
        <div className="font-bold text-[17px]">{status(pub, me)}</div>
      </div>
      <OnScreen pub={pub} />
      {canSuggest && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="sug">Suggest to {cap?.name || "your captain"}</label>
          <div className="flex gap-2">
            <input id="sug" className="input" value={text} maxLength={80} inputMode={pub.screen === "miniQ" ? "decimal" : "text"} placeholder={pub.screen === "miniQ" ? "A number" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
            <button className="btn" disabled={!text.trim()} onClick={() => void suggest()}>Send</button>
          </div>
          {sent && <div className="text-[13px] text-[var(--color-ink-2)]">Sent: <b>{sent}</b></div>}
        </div>)}
      <div className="mt-auto"><Scores pub={pub} /></div>
    </div>
  );
}

/* A CAPTAIN's phone: only what you can do right now. Type and send; the
   lifelines; the number pad; the buzzer; your players' suggestions. */
export function CaptainGame({ pub, me, members, code }: { pub: Pub; me: Member; members: Member[]; code: string }) {
  const mine = me.team as 0 | 1, T = pub.teams, sc = pub.screen;
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false), [sentTxt, setSentTxt] = useState<string | null>(null);
  useEffect(() => { setA(""); setB(""); setSentTxt(null); }, [pub.qid, sc]);
  const names = useNames();
  const act = async (kind: string, payload: Record<string, unknown>) => { setBusy(true); try { await sendAction(code, kind, payload); } finally { setBusy(false); } };

  const myTurn = (sc === "ask" || sc === "steal") && pub.turn === mine && !pub.lifeline;
  const dip = sc === "ask" && (pub.llUsed?.[mine] || []).includes("dip");
  const canType = myTurn || (sc === "miniQ" && !pub.sent?.[mine]) || (sc === "flagQ" && !pub.sent?.[mine])
    || (sc === "dishQ" && pub.buzz === mine) || (sc === "sudden" && pub.buzz === mine);
  const canBuzz = (sc === "dishQ" && pub.buzz == null && !pub.out?.[mine]) || (sc === "sudden" && !!pub.sudden?.ready && pub.buzz == null && !pub.out?.[mine]);
  const sugs = useSuggestions(code, pub.qid, members, mine, ANSWERING.includes(sc));
  const list = sc === "flagQ" ? names.flag : sc === "dishQ" ? names.dish : [];
  const used = useMemo(() => pub.llUsed?.[mine] || [], [pub.llUsed, mine]);
  const armed = !!pub.dbl?.[mine];
  const llOk = (k: "friend" | "dip") => sc === "ask" && myTurn && T[mine].ll[k] && !(armed && used.length >= 1);

  const send = async () => {
    if (sc === "miniQ") { await act("answer", { n: a }); setSentTxt(a); return; }
    const texts = [a, b].map((x) => x.trim()).filter(Boolean);
    if (!texts.length) return;
    await act("answer", { texts }); setSentTxt(texts.join(" / "));
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="card text-center" style={{ borderColor: tc(mine) }}>
        <div className="font-bold text-[17px]">{status(pub, me)}</div>
      </div>

      {sc === "roundIntro" && (
        T[mine].ll.dbl || armed ? (
          <button className={"btn btn-lg btn-block " + (armed ? (mine === 0 ? "btn-a" : "btn-b") : "")} disabled={busy} onClick={() => void act("lifeline", { key: "dbl" })}>
            {armed ? "Double points armed. Tap to undo." : "Double points this round?"}</button>
        ) : <div className="text-center text-[14px] text-[var(--color-ink-3)]">Double points already used.</div>)}

      <OnScreen pub={pub} />

      {canBuzz && <button className="btn btn-lg btn-block display" style={{ minHeight: 150, fontSize: 56, background: tc(mine), color: "#04050e", borderColor: "transparent" }} disabled={busy} onClick={() => void act("buzz", {})}>BUZZ</button>}

      {canType && (
        <div className="card flex flex-col gap-2" style={{ borderColor: tc(mine) }}>
          <label className="field-label !mb-0" htmlFor="ans">{sc === "miniQ" ? "Your number" : dip ? "Your two answers" : "Your answer"}</label>
          <input id="ans" className="input" value={a} maxLength={80} list={list.length ? "names" : undefined} autoComplete="off"
            inputMode={sc === "miniQ" ? "decimal" : "text"} placeholder={sc === "miniQ" ? "e.g. 236" : "Type it"} onChange={(e) => setA(e.target.value)} />
          {dip && <input className="input" value={b} maxLength={80} placeholder="Second answer" onChange={(e) => setB(e.target.value)} />}
          {list.length > 0 && <datalist id="names">{list.map((n) => <option key={n} value={n} />)}</datalist>}
          <button className="btn btn-gold btn-lg" disabled={busy || !a.trim()} onClick={() => void send()}>{sc === "miniQ" ? "Lock in" : "Send"}</button>
          {sentTxt && (sc === "ask" || sc === "steal") && <div className="text-[13px] text-[var(--color-ink-2)]">Sent: <b>{sentTxt}</b>. You can change it until the host decides.</div>}
        </div>)}
      {!canType && pub.sent?.[mine] && ["miniQ", "flagQ"].includes(sc) && <div className="card text-center font-bold">Locked in{sentTxt ? `: ${sentTxt}` : ""}</div>}

      {(llOk("friend") || llOk("dip")) && (
        <div className="flex gap-2 justify-center">
          {llOk("friend") && <button className="btn btn-sm" disabled={busy} onClick={() => void act("lifeline", { key: "friend" })}>Call a Friend</button>}
          {llOk("dip") && <button className="btn btn-sm" disabled={busy} onClick={() => void act("lifeline", { key: "dip" })}>Double Dip</button>}
        </div>)}

      {sugs.length > 0 && (canType || ANSWERING.includes(sc)) && (
        <div className="card">
          <div className="eyebrow mb-2">Your team suggests{canType ? ". Tap one to use it." : ""}</div>
          <div className="flex flex-col gap-1">
            {sugs.map((s) => (
              <button key={s.id} className="text-left text-[15px] py-1" disabled={!canType} onClick={() => setA(s.text)}>
                <b style={{ color: tc(mine) }}>{members.find((m) => m.user_id === s.user_id)?.name}:</b> {s.text}</button>))}
          </div>
        </div>)}

      <div className="mt-auto"><Scores pub={pub} /></div>
    </div>
  );
}
