"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { DECIDED, iso, MAX_BID, offBy, showKm, showNum, T_AGREE, TIE_SCREENS, type LatLon, type Pub, type Secret, type Two } from "@/lib/game";
import type { Member } from "@/lib/room";
import { QMB } from "@/lib/engine";
import { joinLive, newTap, note, sb, sendAction, sendDraft } from "@/lib/supabase";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { PinMap } from "./PinMap";
import { AskHead, battleNeeds, Board, decidedCall, decidedHead, decidedSub, FlagImg, PinPhoto, pinMarks, recapLines, LifelineStrip, MiniIntro, RoundIntro, RulingPicker, ScoreBoard, silent, TEAM_HEX, tieCall, tieHead, Verdict, verdictWord } from "./GameParts";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };
export const ANSWERING = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ", "sudden", "battleQ", "battleTie"];
/* captains only: the players keep quiet (and in Majority Rules everyone answers for themselves: nothing to suggest) */
const CAPTAINS_ONLY = ["sudden", "battleQ", "battleTie", "majorityQ"];

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
    const close = joinLive(() => sb().channel("secret:" + code).on("postgres_changes", { event: "*", schema: "public", table: "secrets", filter: "room=eq." + code },
      (e) => { const d = (e.new as { data?: Secret } | undefined)?.data; if (d) setS(d); else void pull(); }).subscribe());
    const t = setInterval(() => { if (document.visibilityState === "visible") void pull(); }, 25000);
    return () => { clearInterval(t); close(); };
  }, [code, on]);
  return s;
}

/* where a captain buzzes, then types */
const BUZZ_SCREENS = ["dishQ", "sudden", "battleTie"];
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
    const close = joinLive(() => sb().channel("sug:" + code + ":" + qid).on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code },
      (e) => {
        const a = e.new as { id?: number; user_id?: string; kind?: string; payload?: { qid?: string; text?: string } };
        if (a?.kind !== "suggest" || a.payload?.qid !== qid || a.id == null || !a.user_id) return;
        setList((cur) => (cur.some((x) => x.id === a.id) ? cur : [{ id: a.id!, user_id: a.user_id!, text: String(a.payload?.text || "") }, ...cur].slice(0, 30)));
      }).subscribe());
    const t = setInterval(() => { if (document.visibilityState === "visible") void pull(); }, 25000);
    return () => { clearInterval(t); close(); };
  }, [code, qid, on]);
  return list.filter((s) => members.find((m) => m.user_id === s.user_id)?.team === team);
}

/* a status or an outcome is plain text: boxes are for things you can tap */
const Line = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <p className={"text-center text-15 text-[var(--color-ink-2)] " + className} role="status">{children}</p>;
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
  const hint = said ? <p className="text-13 font-bold text-[var(--color-no)]" role="alert">No pasting: type it yourself. The TV has been told.</p> : null;
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
  /* Every touch counts, however fast. An iPhone can take two quick taps on the same spot for one double
     tap and never send the second "click" (GRF2: the host had to tap +1 twice, again and again), so this
     counts when the finger lifts, which comes for every touch; a click counts only from the keyboard. */
  const press = (d: 1 | -1) => ({
    onPointerUp: (e: React.PointerEvent) => { if (e.pointerType === "mouse" && e.button !== 0) return; tap(d); },
    onClick: (e: React.MouseEvent) => { if (e.detail === 0) tap(d); },
  });
  return (<>
    <div className="display text-center" style={{ fontSize: 84 }} aria-live="polite">{shown}<span className="text-[var(--color-ink-3)] text-40"> / {A.bid}</span></div>
    <button className="btn btn-gold btn-block display select-none" style={{ minHeight: h, fontSize: fs, touchAction: "manipulation" }} {...press(1)}>+1</button>
    <div className="flex gap-2 justify-center"><button className="btn btn-sm" {...press(-1)}>Undo</button>{children}</div>
  </>);
}

/* ---- Majority Rules ---- */
/* this phone's own order of the four answers: the same all question long, different on every phone
   (a glance at a neighbour's tap says nothing) */
function phoneOrder(opts: string[], seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = opts.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const onList = (pub: Pub, me: Member) => !!pub.majority?.on?.some((n) => n.toLowerCase() === me.name.toLowerCase());
/* every player's (and captain's) answer: four buttons, one tap, locked. After it, nothing says which:
   a neighbour can't read it off this screen. At the reveal, this phone's own result. */
function MajorityPad({ pub, me, code }: { pub: Pub; me: Member; code: string }) {
  const M = pub.majority, key = `${pub.qid}|majorityQ`;
  const [mine, setMine] = useState<{ key: string; pick: string; tap: string } | null>(null);
  const [no, setNo] = useState<string | null>(null);
  const order = useMemo(() => phoneOrder(M?.options || [], `${me.user_id}|${pub.qid}`), [M?.options, me.user_id, pub.qid]);
  /* the TV's receipt: a tap it turned down says why, and lets go of it */
  const got = mine ? pub.ack?.[me.user_id]?.[mine.tap] : undefined;
  useEffect(() => { if (mine && got && got !== "+" && pub.screen === "majorityQ") { setNo(got === "-" ? "The TV didn't take that. Tap again." : got); setMine(null); } }, [got]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!no) return; const t = setTimeout(() => setNo(null), 5000); return () => clearTimeout(t); }, [no]);
  if (!M || !onList(pub, me)) return pub.screen === "majorityQ" ? <Line>You joined after it started, so you&rsquo;re watching this one. You&rsquo;ll play the next Majority Rules.</Line> : null;
  const picked = mine?.key === key ? mine.pick : null;
  if (pub.screen === "majorityReveal") {
    const R = M.reveal, right = !!picked && picked === R?.answer;
    return <p className="text-center font-bold text-18" role="status" style={{ color: right ? "var(--color-ok)" : "var(--color-no)" }}>
      {picked ? <>You said {picked}: {right ? "right!" : "wrong."}</> : "You didn't answer this one (it counts as wrong)."}</p>;
  }
  if (pub.paused) return null;
  if (picked) return <p className="text-center font-bold text-16" role="status">Locked in. The answer comes up when the time&rsquo;s up.</p>;
  const tap = (pick: string) => {
    const t = newTap();
    setMine({ key, pick, tap: t }); setNo(null); buzzHand(15);
    void sendAction(code, "answer", { pick, k: key, tap: t }).catch(() => setMine(null));
  };
  return (
    <div className="flex flex-col gap-2">
      {no && <p className="text-center text-14 font-bold" role="alert" style={{ color: "var(--color-gold)" }}>{no}</p>}
      <div className="grid gap-2.5" role="group" aria-label="The four answers">
        {order.map((o) => <button key={o} type="button" className="btn btn-lg btn-block mr-opt" disabled={pub.tvAway} onClick={() => tap(o)}><bdi>{o}</bdi></button>)}
      </div>
      <p className="text-center text-12 text-[var(--color-ink-3)]">One tap, and it&rsquo;s locked.</p>
    </div>);
}
/* the join screen's lists, on a phone: who's here; the host takes someone off (or puts them back); with
   no host a captain asks to take an absent teammate off, and the other captain agrees, or not */
function MajorityList({ pub, me, act }: { pub: Pub; me: Member; act?: (move: Record<string, unknown>) => void }) {
  const L = pub.majority?.list || [], A = pub.majority?.ask, T = pub.teams, host = me.role === "host", cap = me.role === "captain";
  const left = useSecondsLeft(A?.until);
  const bare = (n: string) => n.replace(/[\u2068\u2069]/g, ""), meOn = L.find((x) => bare(x.name) === me.name);
  return (
    <div className="flex flex-col gap-3">
      {!host && !(meOn && !meOn.out) && <p className="text-center font-bold text-16" role="status">You&rsquo;re not on a list yet.</p>}
      {A && cap && me.team !== A.team && act && (
        <div className="card flex flex-col gap-2" style={{ borderColor: "var(--color-gold)" }}>
          <p className="text-15"><b>{T[A.team].name}</b> ask to take <b>{A.name}</b> off their list: they&rsquo;re not on the game screen. Agree? ({left} s)</p>
          <div className="grid grid-cols-2 gap-2"><button className="btn btn-gold" onClick={() => act({ type: "ui/mrOutOk", v: true })}>Agree</button><button className="btn" onClick={() => act({ type: "ui/mrOutOk", v: false })}>No, keep them</button></div>
        </div>)}
      {A && !(cap && me.team !== A.team) && <p className="text-center text-13 text-[var(--color-ink-2)]">Asking to take {A.name} off {T[A.team].name}&rsquo;s list…</p>}
      <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
        <div key={t} className="flex flex-col gap-1">
          <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name} · {L.filter((x) => x.team === t && !x.out).length}</div>
          {L.filter((x) => x.team === t).map((x) => {
            const mayAsk = cap && me.team === t && !x.here && !x.out && !A && act;
            return (
              <div key={x.name} className="flex items-center gap-1.5 text-14 min-h-[32px]" style={{ opacity: x.out ? 0.45 : 1 }}>
                <span aria-hidden style={{ color: x.here ? "var(--color-ok)" : "var(--color-ink-3)" }}>{x.here ? "●" : "○"}</span>
                <span className="flex-1 min-w-0 truncate" style={{ textDecoration: x.out ? "line-through" : undefined }}>{x.name}</span>
                {host && act && <button className="btn btn-sm !min-h-[32px] !px-2 !text-12" aria-label={`${x.out ? "Put back" : "Take off"}: ${bare(x.name)}`} onClick={() => act({ type: "ui/mrOut", name: x.name })}>{x.out ? "Put back" : "Take off"}</button>}
                {mayAsk && <button className="btn btn-sm !min-h-[32px] !px-2 !text-12" aria-label={`Not here: ask to take ${bare(x.name)} off`} onClick={() => act({ type: "ui/mrOut", name: x.name })}>Not here</button>}
              </div>); })}
        </div>))}</div>
      <p className="text-12 text-[var(--color-ink-3)] text-center">● on the game screen · ○ not here. Everyone listed plays: no answer counts as wrong.</p>
    </div>);
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
  /* A ruling on a reveal is a switch, and it shows the moment it's tapped (the TV confirms a beat later):
     on a slow server a tap looked like it did nothing (20 Oct). Unconfirmed after 8 s, the TV's call shows again. */
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pickKey = (t: 0 | 1) => `${pub.qid}|${pub.screen}|${t}`;
  const okNow = `${pub.reveal?.ok?.[0]}|${pub.reveal?.ok?.[1]}`;
  useEffect(() => { setPicked({}); }, [pub.qid, pub.screen, okNow]);
  const Main = ({ label, move, off }: { label: string; move: Record<string, unknown>; off?: boolean }) =>
    <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy || off} onClick={() => send(move)}>{label}</button>;
  /* the host's private answer: the one box on this phone that isn't a button, so it can't be missed */
  const AnswerCard = () => loading ? <Line>Getting the answer…</Line> : secret.you ? (
    <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>This one&rsquo;s about you</div>
      <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>You know the answer</div>
      <div className="text-13 text-[var(--color-ink-2)] mt-1">Tap Right or Wrong for what they say.</div>
    </div>) : secret.answer ? (
    <div className="card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answer. Only you see this</div>
      <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{secret.answer}</div>
      {secret.notes && <div className="text-13 text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
      {(secret.accept?.length ?? 0) > 0 && <div className="text-13 text-[var(--color-ink-2)] mt-1"><b className="text-[var(--color-ink)]">Also accepted:</b> {secret.accept!.join(", ")}</div>}
    </div>) : null;
  /* a big outcome headline, no box */
  const Big = ({ eyebrow, text, color, size = 36, sub }: { eyebrow?: string; text: React.ReactNode; color?: string; size?: number; sub?: React.ReactNode }) => (
    <div className="text-center flex flex-col gap-1" role="status">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="display leading-tight" style={{ fontSize: size, color: color ?? "var(--color-gold)" }}>{text}</div>
      {sub && <div className="text-14 text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  /* what a team's captain typed */
  const Said = ({ t, text, empty, label }: { t: 0 | 1; text?: string | null; empty: string; label?: string }) => (
    <div className="text-center">
      <div className="eyebrow" style={{ color: tc(t) }}>{label ?? T[t].name}</div>
      {text ? <div className="font-bold text-22 leading-snug">{text}</div> : <div className="text-14 text-[var(--color-ink-3)] mt-0.5">{empty}</div>}
    </div>);
  const Typed = ({ t }: { t: 0 | 1 }) => {
    /* what they typed comes with the screen itself, so it shows before the secret (the answer, the app's call) lands */
    const x = (loading ? null : secret.typed?.[t]) ?? pub.said?.[t];
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
  /* the reveal screens: each team's answer, and its ruling beside it, which the host can always flip */
  const Rulings = ({ type, say, empty }: { type: string; say?: boolean; empty: string }) => (<>{([0, 1] as const).map((t) => {
    const x = pub.reveal?.typed?.[t]?.[0], k = pickKey(t), app = pub.reveal?.app?.[t], v = k in picked ? picked[k] : pub.reveal?.ok?.[t];
    const pick = (nv: boolean) => { setPicked((c) => ({ ...c, [k]: nv })); setTimeout(() => setPicked((c) => { if (!(k in c)) return c; const n = { ...c }; delete n[k]; return n; }), 8000); fire({ type, t, v: nv }); };
    return (
      <div key={t} className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
          {x ? <div className="font-bold text-18 leading-snug break-words">{x}</div> : <div className="text-14 text-[var(--color-ink-3)]">{empty}</div>}
          {x && v != null && app != null && v !== app && <div className="text-12 font-bold" style={{ color: v ? "var(--color-ok)" : "var(--color-no)" }}>You changed it: {verdictWord(v, say)}</div>}
        </div>
        {/* nothing written: nothing to rule on */}
        {x && <div className="w-[172px] shrink-0"><RulingPicker compact sticky value={v} app={app} say={say} label={`Rule on ${T[t].name}’s answer`} onPick={pick} /></div>}
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
      <button className="btn btn-gold btn-lg btn-block" onClick={() => send({ type: "ui/again" })}>Play again: same teams</button>
      <p className="text-center text-13 text-[var(--color-ink-3)]">Exit takes every phone and the TV back to the home screen.</p>
      {/* home on this phone too, even if the TV is slow to answer */}
      <button className="btn btn-lg btn-block" onClick={() => { send({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
    </div>);
  const Small = ({ label, move, ghost }: { label: string; move: Record<string, unknown>; ghost?: boolean }) =>
    <button className={"btn btn-sm " + (ghost ? "btn-ghost" : "")} disabled={busy} onClick={() => send(move)}>{label}</button>;
  const Pause = () => (!pub.tvAway && (pub.deadline || pub.left) ? <Small label={pub.deadline ? "Pause" : "Resume"} move={{ type: "ui/pause", on: pub.deadline ? "pause" : "resume" }} /> : null);
  const Waiting = ({ children }: { children: React.ReactNode }) => <Line className="mt-auto">{children}</Line>;

  if (pub.lifeline) return (
    <div className="flex flex-col gap-4 flex-1">
      <Big eyebrow={`Lifeline · ${T[pub.lifeline.team].name}`} text={pub.lifeline.key === "friend" ? "Call a Friend" : "Double Dip"}
        sub={pub.lifeline.key === "friend"
          ? <>Before the captain says a word, read this to the friend: &ldquo;Hi, quick quiz question. No ChatGPT, no Google, no asking anyone else. Straight off the top of your head. Ready?&rdquo;{pub.lifeline.wait && <> Then tap Start the call: the {pub.timers?.friend ?? 30} seconds start.</>}</>
          : "The captain gets two answers on this one. Either one right counts."} />
      {pub.lifeline.key === "friend" && <div className="flex flex-col items-center gap-2"><Clock deadline={pub.lifeline.deadline} left={pub.lifeline.left} size={90} timeUp={!pub.lifeline.deadline && !pub.lifeline.left} />
        {pub.lifeline.wait ? <button className="btn btn-gold btn-lg" onClick={() => fire({ type: "ui/startCall" })}>Start the call</button>
          : (pub.lifeline.deadline || pub.lifeline.left) && <button className="btn btn-sm" onClick={() => fire({ type: "ui/pauseFriend" })}>{pub.lifeline.deadline ? "Pause the call" : "Resume the call"}</button>}</div>}
      <p className={qCls(pub.question)}>{pub.question}</p>
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
          <p className={qCls(pub.question) + " leading-snug flex-1"}>{pub.question}</p>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} />
        </div>
        <AnswerCard />
        <div className="flex flex-col gap-2 mt-auto">
          <Typed t={turn} />
          <Judge t={turn} right={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: true }} wrong={{ type: pub.screen === "steal" ? "round/judgeSteal" : "round/judge", v: false }} />
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {/* (once the answer is in, its clock has stopped for your call: nothing to pause) */}
          {!pub.sent?.[turn] && <Pause />}
          {pub.screen === "ask" && <Small ghost label="Change question" move={{ type: "round/swap" }} />}
        </div>
      </div>);
    case "answer": return <Results><Calls pub={pub} host busy={busy} act={send} /><Main label="Next" move={{ type: "round/afterAnswer" }} /></Results>;
    case "roundScore": return <Results><Main label="Next" move={{ type: "round/next" }} /></Results>;
    case "sudden": return !pub.sudden?.ready ? (
      <div className="flex flex-col gap-4 flex-1">
        <Big size={40} text="Sudden death" sub="One question, captains only. They buzz on their phones; first buzz types the answer. Wrong, and the other captain can buzz." />
        <Main label="Go" move={{ type: "sudden/go" }} />
      </div>) : (
      <div className="flex flex-col gap-3 flex-1">
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <Calls pub={pub} host busy={busy} act={send} />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-26 text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
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
    case "final": return <Results><Calls pub={pub} host busy={busy} act={send} /><Exit /></Results>;

    /* ---- the mini-games ---- */
    case "miniIntro": case "flagIntro": case "dishIntro": case "mapIntro": case "auctionIntro": case "sayIntro": case "pinIntro": case "airportIntro": case "majorityIntro": case "battleIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        {pub.screen === "majorityIntro" && <MajorityList pub={pub} me={{ role: "host" } as Member} act={fire} />}
        <MiniIntro pub={pub} size="phone" />
        <Main label="Start" move={{ type: mk === "auction" ? "auction/begin" : mk + "/start" }} />
      </div>);
    case "miniQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Closest To Wins · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
          <div key={t} className="text-center">
            <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
            <div className="display text-28">{secret.guesses?.[t] ?? "…"}</div></div>))}</div>
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
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} headOnly />
        <Rulings type="ui/flagOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "pinQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Landmark {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <PinPhoto pin={pub.pin} h={150} small zoom />
        <AnswerCard />
        <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
          <div key={t} className="text-center">
            <div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
            <div className="font-bold text-16 mt-0.5">{pub.sent?.[t] ? "Pin in" : "Placing…"}</div></div>))}</div>
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change landmark" move={{ type: "pin/swap" }} /></div>
      </div>);
    case "pinReveal": return <Results><Main label="Next" move={{ type: "ui/next" }} /></Results>;
    case "majorityQ": { const M = pub.majority; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Majority Rules · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
          <div key={t} className="text-center"><div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div>
            <div className="font-bold text-18 mt-0.5">{M?.answered?.[t] ?? 0} of {M?.n?.[t] ?? 0} answered</div></div>))}</div>
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change question" move={{ type: "majority/swap" }} /></div>
      </div>); }
    case "majorityReveal": return <Results><Main label="Next" move={{ type: "ui/next" }} /></Results>;
    case "airportQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Board {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <Board air={pub.airport} size="small" />
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change board" move={{ type: "airport/swap" }} /></div>
      </div>);
    case "airportReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} headOnly />
        <Rulings type="ui/airportOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "dishQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">{pub.dish?.kind} · {pub.dish?.ings.length} of {pub.dish?.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <AnswerCard />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-26 text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "dish/right" }} wrong={{ type: "dish/wrong" }} />
          {!secret.typed?.[pub.buzz] && pub.dish?.typeBy && <div className="flex items-center justify-center gap-3 text-14 text-[var(--color-ink-2)]"><Clock deadline={pub.dish.typeBy} size={48} />to type it</div>}
        </div>) : (<>
          {pub.dish && <div className="card"><Ings ings={pub.dish.ings} small /></div>}
          <Waiting>{pub.dish?.late != null ? `Time's up for ${T[pub.dish.late].name}. ` : ""}Waiting for a buzz…{[0, 1].filter((t) => pub.out?.[t]).map((t) => ` ${T[t].name} is out.`).join("")}</Waiting>
          <div className="flex gap-2 justify-center"><Pause />{!pub.out?.some(Boolean) && <Small ghost label="Change this one" move={{ type: "dish/swap" }} />}</div>
        </>)}
      </div>);
    case "dishReveal": return <Results><Calls pub={pub} host busy={busy} act={send} /><Main label="Next" move={{ type: "dish/next" }} /></Results>;
    /* the Battle's review (if the host came back during it): every call, then settle it */
    case "battleReview": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow="Battle of the Captains" size={30} text="Review the calls" sub="Change any call that's wrong, then settle the Battle." />
        <Calls pub={pub} host busy={busy} act={send} />
        <Main label="Settle the Battle" move={{ type: "battle/reviewDone" }} />
      </div>);
    /* won with legs to spare: keep playing for fun, or stop here */
    case DECIDED: return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={pub.mini?.title} size={34} text={decidedHead(pub)} sub={decidedSub(pub)} />
        <div className="flex flex-col gap-3 mt-auto">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "decided/stop" })}>Stop here</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "decided/more" })}>Keep playing for fun</button>
        </div>
      </div>);
    /* level at the end of a mini-game: one more, or a point each */
    case "miniTie": case "sayTie": case "flagTie": case "dishTie": case "mapTie": case "pinTie": case "airportTie": case "majorityTie": case "battleLevel": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={pub.mini?.title} size={34} text={tieHead(pub)} sub={tieCall(pub)} />
        <div className="flex flex-col gap-3 mt-auto">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "tie/stop" })}>A point each</button>
        </div>
      </div>);
    case "miniSummary": case "flagSummary": case "dishSummary": case "mapSummary": case "saySummary": case "pinSummary": case "airportSummary": case "majoritySummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <Result pub={pub} />
        {S?.note && <Line className="!text-13">{S.note}</Line>}
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
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} headOnly />
        <Line className="!text-13">Who got it? The idea counts, not the exact words.</Line>
        <Rulings type="ui/mapOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label={unruled ? "Rule on both answers first" : "Next"} move={{ type: "ui/next" }} off={unruled} />
      </div>); }
    case "auctionBid": { const A = pub.auction!; return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={`Auction · leg ${A.leg + 1} of ${A.n}`} size={30} text={A.cat} sub={A.notes} />
        <Line className="!text-16 !text-[var(--color-ink)]">{A.bid ? <>Bid: <b>{A.bid}</b> by <b style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</b></> : "No bid yet"}<br />
          <span className="text-[var(--color-ink-2)]">The captains bid on their phones. <b style={{ color: tc(A.turn) }}>{T[A.turn].name}</b> to bid. Whoever wins it has {pub.timers?.auction ?? 30} seconds to name them.</span></Line>
        <div className="flex justify-center mt-auto">{!A.bid && <Small ghost label="Change the category" move={{ type: "auction/skip" }} />}</div>
      </div>); }
    case "auctionRun": { const A = pub.auction!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-22" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <div className="text-15 text-[var(--color-ink-2)]">{A.cat}{A.notes ? `. ${A.notes}` : ""}</div>
        <Counter A={A} fire={fire} h={96} fs={46}><Pause /><Small ghost label="Time's up" move={{ type: "auction/resolve" }} /></Counter>
      </div>); }
    case "auctionLeg": return <Results><Main label="Next" move={{ type: "auction/nextLeg" }} /></Results>;
    case "auctionResult": return <Results><Main label="Next" move={{ type: "auction/done" }} /></Results>;
    case "sayQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Don&rsquo;t Say the Same as Me · {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        {([0, 1] as const).map((t) => <p key={t} className="text-15"><b style={{ color: tc(t) }}>{T[t].name}:</b> {secret.typed?.[t]?.[0] ?? "thinking…"}{secret.typed?.[t] ? <> · <Verdict v={!secret.match?.[t]} say /></> : ""}</p>)}
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change prompt" move={{ type: "say/swap" }} /></div>
      </div>);
    case "sayReveal": return (
      <div className="flex flex-col gap-4 flex-1">
        <OnScreen pub={pub} />
        <Result pub={pub} headOnly />
        <Rulings type="ui/sayOk" say empty="Nothing" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "battleQ": { const B = pub.battle!; return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="display text-22" style={{ color: tc(B.cap) }}>{T[B.cap].name} · {B.i + 1}/{B.n}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <div className="flex flex-col gap-2 mt-auto">
          {secret.typed?.[B.cap] && <Typed t={B.cap} />}
          <Judge t={B.cap} aloud={pub.mode === "host"} right={{ type: "battle/mark", got: true }} wrong={{ type: "battle/mark", got: false }} />
        </div>
        <div className="flex gap-2 justify-center"><Pause /><Small ghost label="Change question" move={{ type: "battle/swap" }} /></div>
      </div>); }
    case "battleHandoff": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow="Halfway" size={30} color="var(--color-ink)" text={`${T[0].name} scored ${pub.battle?.score[0]}`} sub={`Now ${T[1].name}’s captain. ${battleNeeds(pub)}`} />
        <Main label={`Start ${T[1].name}'s questions`} move={{ type: "battle/start" }} />
      </div>);
    case "battleTie": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="eyebrow">Battle tie-breaker: first captain to buzz</div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <Calls pub={pub} host busy={busy} act={send} />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-26 text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed</div>
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
    case "battleSummary": return <Results><Calls pub={pub} host busy={busy} act={send} /><Main label="Next" move={{ type: "battle/done" }} /></Results>;
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
    <p className="text-center text-14 font-bold" role="alert" style={{ color: "var(--color-no)" }}>
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
        <div key={f.id} className="text-14"><b style={{ color: tc(f.team) }}>{f.name}</b> · {f.label} · {f.kind === "paste" ? "tried to paste an answer" : f.ms != null ? `left the screen ${Math.round(f.ms / 1000)}s` : "left the screen, still away"}</div>))
        : <p className="text-14 text-[var(--color-ink-2)]">Nobody so far. A phone that switches app or tab during a question shows up here and on the TV.</p>}
    </div>);
}

/* The host, if something went wrong (a call that couldn't be put right, a bug): set the total scores
   by hand. Out of the way at the bottom of the Players panel, and it asks first.
   ask: a captain with no host, who asks for it instead: the other captain has to agree. */
export function ScoreFix({ pub, send, busy, ask }: { pub: Pub; send: Send; busy: boolean; ask?: boolean }) {
  const T = pub.teams;
  const [open, setOpen] = useState(false), [v, setV] = useState<[number, number]>([T[0].score, T[1].score]);
  useEffect(() => { if (!open) setV([T[0].score, T[1].score]); }, [open, T]);
  if (!open) return <button className="btn btn-sm btn-ghost self-center" onClick={() => setOpen(true)}>Adjust the scores</button>;
  const step = (t: 0 | 1, d: number) => setV((x) => (t === 0 ? [Math.max(0, x[0] + d), x[1]] : [x[0], Math.max(0, x[1] + d)]));
  const changed = v[0] !== T[0].score || v[1] !== T[1].score;
  const save = () => {
    if (ask) { send({ type: "ui/askScore", a: v[0], b: v[1] }); setOpen(false); return; }
    if (!window.confirm(`Are you sure? ${T[0].name}: ${T[0].score} → ${v[0]}. ${T[1].name}: ${T[1].score} → ${v[1]}.`)) return;
    send({ type: "ui/setScore", a: v[0], b: v[1] }); setOpen(false);
  };
  return (
    <div className="card flex flex-col gap-3">
      <div className="eyebrow">Adjust the scores</div>
      <p className="text-13 text-[var(--color-ink-2)]">{ask ? <>Only if something went wrong. The other captain has to agree within {T_AGREE} seconds; if not, the scores stay as they are.</>
        : "Only if something went wrong. The TV and every phone show the new scores at once."}</p>
      {ask && pub.agree && <p className="text-13 font-bold" role="status" style={{ color: "var(--color-gold)" }}>One request at a time: wait for the open one first.</p>}
      {([0, 1] as const).map((t) => (
        <div key={t} className="flex items-center gap-3">
          <b className="flex-1 truncate" style={{ color: tc(t) }}>{T[t].name}</b>
          <button className="btn btn-sm" aria-label={`${T[t].name} minus one`} onClick={() => step(t, -1)}>−</button>
          <span className="display text-32 w-14 text-center">{v[t]}</span>
          <button className="btn btn-sm" aria-label={`${T[t].name} plus one`} onClick={() => step(t, 1)}>+</button>
        </div>))}
      <div className="flex gap-2">
        <button className="btn btn-gold flex-1" disabled={busy || !changed || (ask && !!pub.agree)} onClick={save}>{ask ? "Ask the other captain" : "Save the scores"}</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
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
          <div className="display text-40 leading-none mt-1">{b ?? "–"}</div>
          <div className="text-11 font-bold mt-1" style={{ color: top ? "var(--color-gold)" : "var(--color-ink-3)" }}>{top ? "Highest bid" : A.turn === t ? "To bid" : b == null ? "No bid yet" : "Outbid"}</div>
        </div>); })}
    </div>);
}

/* who won what, on every phone (the TV isn't the only one that gets to know) */
/* headOnly: just the headline (the host's reveal screens show the rulings themselves) */
/* The app's calls on this screen (the answer card, a reveal, the Battle review), each with a small
   Contest for a captain. With no host the other captain agrees or not (after a while the app's call
   stands); with a host, the host decides, and can change any call. */
function Calls({ pub, mine, host, busy, act, cardOnly }: { pub: Pub; mine?: 0 | 1; host?: boolean; busy?: boolean; act: (move: Record<string, unknown>) => void; cardOnly?: boolean }) {
  const C = pub.calls || [], K = pub.contest, T = pub.teams, say = pub.screen === "sayReveal", left = useSecondsLeft(K?.until);
  if (!C.length) return null;
  const word = (ok: boolean) => (say ? (ok ? "DODGED IT" : "SAID IT") : ok ? "RIGHT" : "WRONG");
  const nohost = pub.mode === "nohost";
  /* sudden death's "last question" said once, above it */
  const lastQ = C.every((c) => c.note === "last question");
  const decider = K ? (nohost ? pub.captains?.[K.by === 0 ? 1 : 0] || "The other captain" : "The host") : "";
  return (
    <div className="flex flex-col gap-2">
      {/* one grid for every call, so the names, the answers, the RIGHT/WRONG and the Contest each line up in a column */}
      {!cardOnly && <div className={"grid items-center gap-x-2 gap-y-1.5 text-14" + (C.length > 6 ? " max-h-[52vh] overflow-y-auto pr-1" : "")}
        style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto auto" }}>
        {lastQ && <div className="eyebrow text-center col-span-4">The last question</div>}
        {C.map((c) => { const dim = { opacity: K && K.id !== c.id ? 0.6 : 1 }; return (
          <Fragment key={c.id}>
            {/* the name cut short, the answer whole: this list is the only place a captain sees what was typed (29 Oct) */}
            <span className="font-bold max-w-[88px] truncate" style={{ color: tc(c.team), ...dim }} title={T[c.team].name}>{T[c.team].name}{c.note && !lastQ ? <span className="font-normal text-12 text-[var(--color-ink-3)]"> · {c.note}</span> : null}</span>
            <span className="min-w-0 break-words text-[var(--color-ink-2)]" style={dim}>{c.text || "No answer"}
              {c.answer && !c.ok && <span className="block break-words text-12 text-[var(--color-ink-3)]">Answer: {c.answer}</span>}</span>
            <span className="justify-self-start" style={dim}><Verdict v={c.ok} say={say} size={13} /></span>
            <span className="justify-self-start min-h-[36px] flex items-center" style={dim}>
              {host ? <button className="text-13 font-bold underline underline-offset-4 min-h-[36px] px-1" disabled={busy} onClick={() => act({ type: "ui/flip", id: c.id })}>Change</button>
                : !c.done && !K && mine != null && (c.team === mine ? !c.ok : c.ok) ? <button className="text-13 font-bold underline underline-offset-4 text-[var(--color-ink-2)] min-h-[36px] px-1" disabled={busy}
                  onClick={() => act({ type: "ui/contest", id: c.id })}>Contest</button> : null}</span>
          </Fragment>); })}
      </div>}
      {K && (host || (nohost && mine != null && mine !== K.by) ? (
        <div className="card flex flex-col gap-2 text-center" role="alert">
          <div className="text-14"><b style={{ color: tc(K.by) }}>{T[K.by].name}</b> say {K.team !== K.by ? <><b style={{ color: tc(K.team) }}>{T[K.team].name}</b>&rsquo;s </> : null}&ldquo;{K.text}&rdquo; was <b>{word(!K.ok)}</b>.{host ? " Your call." : " Agree?"}</div>
          <div className="flex gap-2 justify-center">
            <button className="btn btn-sm" disabled={busy} onClick={() => act({ type: "ui/contestOk", v: true })}>{host ? `Make it ${word(!K.ok)}` : "Agree"}</button>
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => act({ type: "ui/contestOk", v: false })}>{host ? `Keep ${word(K.ok)}` : "No"}</button>
          </div>
          {nohost && <div className="text-12 text-[var(--color-ink-3)]">No answer in {left} s and the app&rsquo;s call stands.</div>}
        </div>
      ) : (
        <p className="text-center text-13 text-[var(--color-ink-2)]" role="status">
          <b style={{ color: tc(K.by) }}>{T[K.by].name}</b> contest &ldquo;{K.text}&rdquo;. {decider} decides{nohost ? ` (${left} s)` : ""}.</p>))}
    </div>);
}

function Result({ pub, mine, headOnly }: { pub: Pub; mine?: 0 | 1; headOnly?: boolean }) {
  const T = pub.teams, sc = pub.screen, m = pub.mini;
  const name = (t: 0 | 1) => <b style={{ color: tc(t) }}>{T[t].name}</b>;
  /* the outcome: a big headline, no box (boxes are for things you can tap) */
  const head = (t: 0 | 1 | null | undefined, text: string, sub?: string) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      <div className="display text-32 leading-tight" style={{ color: t == null ? "var(--color-ink-2)" : tc(t) }}>{text}</div>
      {t != null && mine != null && <div className="text-13 font-bold" style={{ color: t === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{t === mine ? "That's your team!" : "Not this time."}</div>}
      {sub && <div className="text-13 text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  const legW = (w: unknown) => (w === 0 || w === 1 ? w : null) as 0 | 1 | null;
  /* the mini-game's own score, big: TEAM A 3 – 4 TEAM B (the same board as the TV's) */
  const board = (w: Two<number>, label: string, win: 0 | 1 | null) => <ScoreBoard pub={pub} w={w} win={win} label={label} size="phone" />;
  const rows = (ok: (t: 0 | 1) => React.ReactNode) => (
    <div className="grid grid-cols-2 gap-3">{([0, 1] as const).map((t) => (
      <div key={t} className="text-center"><div className="eyebrow" style={{ color: tc(t) }}>{T[t].name}</div><div className="text-15 font-bold mt-1">{ok(t)}</div></div>))}</div>);
  if (sc === "answer" && pub.result) {
    const quiet = ([0, 1] as const).filter((t) => silent(pub, t)).map((t) => `${T[t].name}: ${silent(pub, t)}`).join(" · ");
    return head(pub.result.by, pub.result.by == null ? "Nobody scores" : `${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? ", stolen!" : ""}`, quiet || undefined);
  }
  if (sc === "roundScore") return (<>
    {head(null, `End of round ${pub.r + 1}`)}
    {board([T[0].score, T[1].score], "The score", null)}
    <p className="text-center text-13 text-[var(--color-ink-2)]">This round: {name(0)} +{pub.roundPts?.[0] ?? 0} · {name(1)} +{pub.roundPts?.[1] ?? 0}</p></>);
  if (sc === "closestReveal" && pub.reveal) { const w = pub.reveal.w, ans = Number(pub.reveal.answer); return (<>
    {head(legW(w), w === "tie" ? "A point each" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "")}
    {rows((t) => { const g = pub.reveal?.guesses?.[t]; return g == null ? "No answer" : `${showNum(g)} (off by ${showNum(offBy(g, ans))})`; })}
    {pub.reveal.notes && <div className="text-13 text-[var(--color-ink-2)] text-center">{pub.reveal.notes}</div>}</>); }
  if (sc === "majorityReveal" && pub.majority?.reveal) { const M = pub.majority, R = M.reveal!; return (<>
    <div className="eyebrow text-center">This question</div>
    {rows((t) => `${R.right[t]} of ${M.n?.[t] ?? 0} right`)}
    {/* the game so far, in percent, is in the bar at the top (this question counted already): here, the counts behind it */}
    {M.totals && <p className="text-center text-13 text-[var(--color-ink-3)]">So far: {name(0)} {M.totals.right[0]} of {M.totals.of[0]} right · {name(1)} {M.totals.right[1]} of {M.totals.of[1]} right</p>}</>); }
  if (sc === "pinReveal" && pub.pin?.reveal) { const R = pub.pin.reveal, w = pub.reveal?.w; return (<>
    {head(legW(w), w === "tie" ? "A point each" : w === "none" ? "No pins, no point" : legW(w) != null ? `${T[w as 0 | 1].name} take the leg` : "")}
    {rows((t) => (R.pins[t] ? `${showKm(R.km[t] ?? 0)} off` : "No pin"))}</>); }
  if ((sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal" || sc === "airportReveal") && pub.reveal) {
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
            {v == null ? <span className="text-12 text-[var(--color-ink-3)]">waiting for a ruling</span> : <Verdict v={v} say={say} size={14} />}
          </div>
          <div className="text-16 font-bold mt-1" style={{ color: x ? undefined : "var(--color-ink-3)" }}>{x ?? (say ? "Nothing" : "No answer")}</div>
          {say && pub.reveal?.offList?.[t] && !v && <div className="text-12 text-[var(--color-ink-2)]">Not on the list, so it counts as said</div>}
        </div>); })}</div></>);
  }
  if (sc === "dishReveal" && pub.reveal) return head(legW(pub.reveal.w), legW(pub.reveal.w) != null ? `${T[pub.reveal.w as 0 | 1].name} got it` : "Nobody got it");
  if (sc === "auctionLeg" && pub.auction?.last) { const L = pub.auction.last; return (<>
    {/* one headline (who takes the leg); the how, small; the legs, as a board */}
    <div className="text-center flex flex-col items-center gap-2" role="status" aria-live="polite">
      <span className={"verdict text-13 " + (L.made ? "pos" : "neg")}>{L.made ? "Delivered" : "Short"}</span>
      <div className="display text-32 leading-none" style={{ color: tc(L.won) }}>{T[L.won].name} take the leg</div>
      <div className="text-14 text-[var(--color-ink-2)]">{name(L.by)} bid {L.bid}, named {L.count}.</div>
      {mine != null && <div className="text-13 font-bold" style={{ color: L.won === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{L.won === mine ? "That's your team!" : "Not this time."}</div>}
    </div>
    {board(pub.auction.wins, "Legs so far", null)}</>); }
  if (sc === "auctionResult" && pub.auction) { const A = pub.auction, w = A.winner ?? null; return (<>
    {head(w, w == null ? "Tie" : `${T[w].name} win the Auction`, w != null ? `+${A.award?.[w] ?? m?.pts} points` : "")}
    {board(A.wins, "Legs won", w)}</>); }
  if (/Summary$/.test(sc) && sc !== "battleSummary" && pub.summary) { const S = pub.summary; return (<>
    {head(S.winner, S.needsHost ? "Still level" : S.winner == null ? "A split" : `${T[S.winner].name} win ${m?.title ?? "it"}`,
      S.needsHost ? "The host decides" : S.winner == null ? `${S.award?.[0] ?? 0} point${S.award?.[0] === 1 ? "" : "s"} each` : `+${S.award?.[S.winner] ?? m?.pts} points`)}
    {board(S.wins, "Legs won", S.winner)}
    {S.who && <div className="text-13 text-center" style={{ color: "var(--color-gold)" }}>{S.who}</div>}</>); }
  if (sc === "battleSummary" && pub.battle) { const B = pub.battle, w = B.winner ?? null; return (<>
    {head(w, w == null ? (B.note || "Tie") : `${T[w].name} win the Battle`, w != null ? `+${B.award?.[w] ?? m?.pts} points` : "")}
    {board(B.score, "Right answers", w)}
    {B.predict && <div className="text-13 text-center" style={{ color: "var(--color-gold)" }}>{B.predict}</div>}</>); }
  if (sc === "final") { const w = pub.winner ?? null; return (
    <div className="text-center flex flex-col gap-2 py-4" role="status" aria-live="polite">
      <div className="eyebrow">{w == null ? "The night ends" : "The winner"}</div>
      <div className="display text-52 leading-none" style={{ color: tc(w) }}>{w == null ? "A draw" : T[w].name}</div>
      {w != null && mine != null && <div className="text-15 font-bold" style={{ color: w === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{w === mine ? "You won the night!" : "Not tonight."}</div>}
      <div className="mt-2">{board([T[0].score, T[1].score], "Final score", w)}</div>
      {recapLines(pub).length > 0 && <ul className="mt-3 flex flex-col gap-1 text-14 text-[var(--color-ink-2)]">{recapLines(pub).map((l) => <li key={l}>{l}</li>)}</ul>}
    </div>); }
  return null;
}

/* what's on screen, close up: the question, the flag or the ingredients.
   It can't be selected or copied (no pasting it into a chatbot), and while
   the clock is paused it's hidden. */
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
/* counting: this phone counts the Auction's names, and shows its own count */
function OnScreen({ pub, counting, small }: { pub: Pub; counting?: boolean; small?: boolean }) {
  if (pub.paused && pub.agree?.kind === "swap") return <div className="text-center py-8" role="status"><div className="display text-40" style={{ color: "var(--color-gold)" }}>A new {pub.agree.what}?</div><p className="text-14 text-[var(--color-ink-2)] mt-1">The clock is stopped while {pub.teams[pub.agree.team === 0 ? 1 : 0].name}&rsquo;s captain decides.</p></div>;
  if (pub.paused) return <div className="text-center py-8" role="status"><div className="display text-40" style={{ color: "var(--color-gold)" }}>Paused</div><p className="text-14 text-[var(--color-ink-2)] mt-1">The question comes back when the clock restarts.</p></div>;
  return (<div className="noselect contents" {...noCopy}>
    {pub.question && ["ask", "steal", "answer", "sudden", "miniQ", "closestReveal", "sayQ", "sayReveal", "majorityQ", "majorityReveal", "battleQ", "battleTie"].includes(pub.screen) && <p className={qCls(pub.question, 20) + " leading-snug text-center"}>{pub.question}</p>}
    {pub.screen === "majorityReveal" && pub.majority?.reveal && <div className="display text-30 text-center" style={{ color: "var(--color-gold)" }}>{pub.majority.reveal.answer}</div>}
    {/* the fact behind it, right under the answer */}
    {pub.screen === "majorityReveal" && pub.majority?.reveal?.notes && <p className="text-14 text-[var(--color-ink-2)] text-center leading-snug -mt-1">{pub.majority.reveal.notes}</p>}
    {(pub.screen === "flagQ" || pub.screen === "flagReveal") && <FlagImg name={pub.flag} h={small ? 96 : 150} />}
    {pub.screen === "pinQ" && (small
      /* the captain's phone: the photo beside the clock, so the map gets the room */
      ? <div className="flex items-center justify-center gap-4"><PinPhoto pin={pub.pin} h={112} small zoom /><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={64} /></div>
      : <PinPhoto pin={pub.pin} h={230} small zoom />)}
    {pub.screen === "pinReveal" && pub.pin?.reveal && <PinMap marks={pinMarks(pub)} fly height={small ? 220 : 300} label={`Where it is: ${pub.pin.reveal.place}`} />}
    {pub.screen === "pinReveal" && pub.pin?.reveal && <div className="text-center"><div className="display text-30" style={{ color: "var(--color-gold)" }}>{pub.pin.reveal.name}</div>
      <div className="text-14 text-[var(--color-ink-2)] mt-1">{pub.pin.reveal.place}</div></div>}
    {(pub.screen === "airportQ" || pub.screen === "airportReveal") && <Board air={pub.airport} size={small ? "small" : "phone"} />}
    {pub.map && <MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={small ? 170 : 260} title={pub.map.title} />}
    {pub.map?.reveal && <div className="display text-26 text-center" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>}
    {pub.auction && pub.screen === "auctionLeg" && <p className="text-center text-14 text-[var(--color-ink-2)]"><span className="eyebrow mr-2">Leg {pub.auction.wins[0] + pub.auction.wins[1]}</span>{pub.auction.cat}</p>}
    {pub.auction && /^auction(Bid|Run)$/.test(pub.screen) && <div className="text-center"><div className="eyebrow">Category</div><div className="display text-28" style={{ color: "var(--color-gold)" }}>{pub.auction.cat}</div>
      {pub.screen === "auctionBid" && <BidBoard pub={pub} />}
      {pub.screen === "auctionRun" && !counting && <div className="display text-44 mt-1">{pub.auction.count} / {pub.auction.bid}</div>}
      {pub.screen === "auctionRun" && pub.auction.countedBy && <div className="text-13 text-[var(--color-ink-2)] mt-1">Counted by <b>{pub.auction.countedBy}</b></div>}</div>}
    {(pub.screen === "dishQ" || pub.screen === "dishReveal") && pub.dish && <div className="card"><div className="eyebrow mb-2">Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div><Ings ings={pub.dish.ings} /></div>}
    {pub.reveal && /Reveal$/.test(pub.screen) && !["mapReveal", "sayReveal", "pinReveal"].includes(pub.screen) && <div className="display text-30 text-center" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div>}
    {pub.screen === "airportReveal" && pub.airport?.code && <p className="text-center text-14 text-[var(--color-ink-2)] -mt-1"><b className="text-[var(--color-ink)]">{pub.airport.code}</b> · {pub.airport.city}{pub.airport.cityOk === false && <span className="block mt-1 text-13 font-bold" style={{ color: "var(--color-gold)" }}>{pub.airport.city} alone doesn&rsquo;t count: it has more than one big airport.</span>}{pub.reveal?.notes ? <span className="block mt-1 text-13">{pub.reveal.notes}</span> : null}</p>}
    {pub.reveal && pub.screen === "sayReveal" && <div className="text-center"><div className="eyebrow">The app&rsquo;s word</div><div className="display text-30" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div></div>}
    {pub.screen === "answer" && pub.result && <div className="display text-32 text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
    {["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "majorityQ", "battleQ"].includes(pub.screen) && !(small && pub.screen === "pinQ") && <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "dishQ" || small ? 70 : pub.screen === "ask" || pub.screen === "steal" ? 72 : 90} /></div>}
    {/* the Battle: the last answer, once there's no new question to read (during the questions it's on the TV only) */}
    {pub.battle?.half?.length && pub.screen === "battleHandoff" ? <BattleHalf half={pub.battle.half} />
      : pub.battle?.last && /^battle(Handoff|Summary)$/.test(pub.screen) && <BattleAnswer last={pub.battle.last} />}
  </div>);
}

/* the Battle at halfway: every one of the first captain's answers, the right one beside each miss */
export function BattleHalf({ half, size = 14, cols = 1 }: { half: NonNullable<NonNullable<Pub["battle"]>["half"]>; size?: number; cols?: number }) {
  return (
    <div className="grid grid-flow-col gap-x-14 gap-y-1 w-full" style={{ fontSize: size, gridTemplateRows: `repeat(${Math.ceil(half.length / cols)}, auto)` }}>
      {half.map((e, i) => (
        <div key={i} className="flex items-baseline gap-2 text-left">
          <span className="text-[var(--color-ink-3)] shrink-0" style={{ width: size * 1.6 }}>{i + 1}</span>
          <span className="flex-1 min-w-0 truncate">{e.said || <span className="text-[var(--color-ink-3)]">No answer</span>}
            {!e.got && e.answer && <span className="text-[var(--color-ink-3)]"> · {e.answer}</span>}</span>
          <Verdict v={e.got} size={Math.round(size * 0.9)} />
        </div>))}
    </div>);
}

/* the Battle's last answer, once it's settled: "Answer: X" */
export function BattleAnswer({ last, size = 15, prev }: { last: { answer: string; got: boolean | null }; size?: number; prev?: boolean }) {
  /* "Last answer" while the next question is up, so it can't be read as that one's */
  return <p className="text-center text-[var(--color-ink-2)]" style={{ fontSize: size }} role="status">{prev ? "Last answer" : "Answer"}: <b className="text-[var(--color-ink)]">{last.answer}</b>{last.got != null && <> · <Verdict v={last.got} /></>}</p>;
}

/* the screens that show who won what (see Result) */
const RESULT = /^(answer|roundScore|closestReveal|flagReveal|sayReveal|mapReveal|pinReveal|airportReveal|majorityReveal|dishReveal|auctionLeg|auctionResult|\w+Summary|final)$/;

/* what this question means for YOU, under the "Question for TEAM" head */
/* a long question (over 120 characters) in a size that keeps Send on screen */
const qCls = (q?: string | null, base = 18) => "font-bold " + ((q || "").length > 120 ? "text-16" : "text-" + base);

function youLine(pub: Pub, me: Member, capName?: string) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain", ours = pub.turn === mine, them = T[pub.turn ?? 0].name;
  if (capName) capName = iso(capName);
  const to = capName ? `send ideas to ${capName}` : "send ideas to your captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend." : "Double Dip: two answers on this one.") : `${T[pub.lifeline.team].name} are using a lifeline.`;
  if (pub.pending) return pub.pending.team === mine ? "Answer sent. The app is checking it." : `${them} answered. The app is checking it.`;
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
  return <p className={"text-center leading-snug " + (quiet ? "text-14 font-semibold text-[var(--color-ink-3)]" : "font-bold text-18")} role="status" aria-live="polite">{status(pub, me)}</p>;
}

const QUIET = ["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ"];
function status(pub: Pub, me: Member) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend" : "Double Dip: two answers") : `${T[pub.lifeline.team].name} used a lifeline`;
  if (TIE_SCREENS.includes(pub.screen)) return `${tieHead(pub)}. ${tieCall(pub)}`;
  if (pub.screen === DECIDED) return `${decidedHead(pub)} ${decidedCall(pub)}`;
  switch (pub.screen) {
    case "ask": return pub.turn === mine ? (cap ? "Your question. Type your answer." : "Your team's question. Help your captain!") : `${T[pub.turn ?? 0].name} is answering. Get ready to steal.`;
    case "steal": return pub.turn === mine ? (cap ? "Steal! Type your answer." : "Steal! Help your captain.") : `${T[pub.turn ?? 0].name} can steal it`;
    case "answer": return pub.result?.by == null ? "Nobody scored" : pub.result.by === mine ? `+${pub.result.pts} to your team!` : `${T[pub.result.by].name} scored`;
    case "roundIntro": return `Round ${pub.r + 1}: ${pub.theme}`;
    case "roundScore": return `End of round ${pub.r + 1}`;
    case "sudden": return cap ? "Sudden death: captains only. Buzz to answer." : "Sudden death: captains only. Not a word!";
    case "miniQ": return cap ? "Type a number. Nearest wins." : "Closest To Wins: help your captain";
    case "flagQ": return cap ? "Which country? One go." : "Guess the Flag: help your captain";
    case "pinQ": return cap ? "Where is it? Drop your pin. One go." : "Drop the Pin: help your captain";
    case "airportQ": return cap ? "Which airport? One go." : "Guess the Airport: help your captain";
    case "majorityQ": return "Your own answer: eyes on your phone, no talking";
    case "dishQ": return pub.buzz === mine ? (pub.sent?.[mine] ? `Answer sent. ${pub.mode === "nohost" ? "The app checks it." : "The host decides."}` : cap ? "You buzzed! Type it, quick." : "Your captain buzzed!") : pub.buzz != null ? `${T[pub.buzz].name} buzzed` : pub.out?.[mine] ? (pub.dish?.late === mine ? "Time's up. You're out of this one." : "You're out of this one") : cap ? "Know it? BUZZ!" : "Guess the Cocktail or Dish: help your captain";
    case "sayQ": return cap ? "Type an answer the app won't think of" : "Don't Say the Same as Me: help your captain";
    case "sayReveal": return pub.reveal?.ok?.[mine] ? "You dodged the app's word" : "You said the app's word";
    /* Team A's captain plays the first half, then Team B's: the one who's finished isn't "next" */
    case "battleQ": return pub.battle?.cap === mine ? (cap ? (pub.mode === "nohost" ? "Your question. Type it fast!" : "Your question. Say it out loud!") : "Your captain's battle. Not a word!")
      : cap ? (mine === 0 ? `Your half is done. ${T[1].name}'s captain now. Stay quiet.` : "Your turn is next. Stay quiet.") : "Captains only. Not a word!";
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
  /* only while it can help: not on the other team's question or steal (20 Oct: players suggested to a
     captain who couldn't answer), nor once their captain's answer is in */
  const notOurs = (pub.screen === "ask" || pub.screen === "steal") && pub.turn !== mine;
  const canSuggest = !!pub.qid && ANSWERING.includes(pub.screen) && !CAPTAINS_ONLY.includes(pub.screen) && !notOurs && !pub.sent?.[mine];
  const np = useNoPaste(code, pub.qid);
  /* the Auction: a count-along, on this phone only (the TV's count is the one that counts); the Battle: one call on
     your captain's score, before their first question (29 Oct) */
  const [tally, setTally] = useState(0), [pred, setPred] = useState<number | null>(null), [predBusy, setPredBusy] = useState(false);
  useEffect(() => { setTally(0); }, [pub.qid]);
  useEffect(() => { setPred(null); }, [pub.screen]);
  const predict = async (n: number) => {
    setPredBusy(true);
    try { await sendAction(code, "answer", { predict: n, team: mine, k: `${pub.qid}|${pub.screen}` }); setPred(n); } catch { /* the TV says why, under the buttons */ }
    setPredBusy(false);
  };
  const callIt = (pub.screen === "battleIntro" || pub.screen === "battleHandoff") && pub.battle && pub.battle.cap === mine;
  const suggest = async () => { const t = text.trim(); if (!t) return; try { await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSent(t); setText(""); } catch { /* the phone already says so; the text stays */ } };
  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Majority Rules' join screen: whether you're on the list, and who's here, before the rules */}
      {pub.screen === "majorityIntro" && <MajorityList pub={pub} me={me} />}
      {/* the Battle: your call on your captain's score, above the intro so nobody has to scroll for it */}
      {callIt && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">Your call: how many will {cap?.name || "your captain"} get, out of {pub.battle!.n}?</div>
          {pred != null ? <p className="text-15">You said <b>{pred}</b>. The summary tells.</p>
            : <div className="grid grid-cols-6 gap-1.5">{Array.from({ length: pub.battle!.n + 1 }, (_, n) => <button key={n} className="btn btn-sm" disabled={predBusy} onClick={() => void predict(n)}>{n}</button>)}</div>}
        </div>)}
      <Head pub={pub} me={me} capName={cap?.name} />
      <OnScreen pub={pub} />
      {/^majority(Q|Reveal)$/.test(pub.screen) && <MajorityPad pub={pub} me={me} code={code} />}
      <Result pub={pub} mine={mine} />
      {canSuggest && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="sug">Suggest to {cap?.name || "your captain"}</label>
          <div className="flex gap-2">
            <input id="sug" {...np.props} className="input" value={text} maxLength={80} inputMode={pub.screen === "miniQ" ? "decimal" : "text"} placeholder={pub.screen === "miniQ" ? "A number" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
            <button className="btn" disabled={!text.trim()} onClick={() => void suggest()}>Send</button>
          </div>
          {np.hint}
          {sent && <div className="text-13 text-[var(--color-ink-2)]">Sent: <b>{sent}</b></div>}
        </div>)}
      {pub.screen === "auctionRun" && (
        <div className="card flex flex-col gap-2 items-center">
          <div className="eyebrow">Count along (just for you)</div>
          <div className="display text-52" style={{ color: "var(--color-gold)" }}>{tally}</div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <button className="btn btn-gold btn-lg" onClick={() => setTally((t) => t + 1)}>+1</button>
            <button className="btn" disabled={!tally} onClick={() => setTally((t) => Math.max(0, t - 1))}>Undo</button>
          </div>
          <p className="text-12 text-[var(--color-ink-3)] text-center">The TV&rsquo;s count is the one that counts: {pub.auction?.count ?? 0} so far.</p>
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
  pinIntro: ["Start", "pin/start"], airportIntro: ["Start", "airport/start"], pinReveal: ["Next", "ui/next"], airportReveal: ["Next", "ui/next"],
  pinSummary: ["Next", "pin/done"], airportSummary: ["Next", "airport/done"],
  majorityIntro: ["Start: everyone's in", "majority/start"], majorityReveal: ["Next question", "ui/next"], majoritySummary: ["Next", "majority/done"],
  answer: ["Next", "round/afterAnswer"], roundScore: ["Next", "round/next"], closestReveal: ["Next", "ui/next"], flagReveal: ["Next", "ui/next"],
  dishReveal: ["Next", "dish/next"], auctionLeg: ["Next", "auction/nextLeg"], auctionResult: ["Next", "auction/done"], battleReview: ["Settle the Battle", "battle/reviewDone"],
  miniSummary: ["Next", "closest/done"], flagSummary: ["Next", "flag/done"], dishSummary: ["Next", "dish/done"], mapSummary: ["Next", "map/done"],
};
/* no host: whose tap the room is waiting for */
function WaitingFor({ pub }: { pub: Pub }) {
  const label = pub.screen === "sudden" ? "Go" : NEXT_LABEL[pub.screen]?.[0] || "Next";
  const open = useAfter(pub.nextOpenAt), auto = useSecondsLeft(pub.autoAt);
  if (pub.autoAt && auto > 0) return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Next in {auto} s, or {pub.nextBy} taps Next.</p>;
  const who = open && pub.nextOther ? `${pub.nextBy} or ${pub.nextOther}` : pub.nextBy;
  return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Waiting for {who} to {TIE_SCREENS.includes(pub.screen) ? "choose: one more, or a point each" : pub.screen === DECIDED ? "choose: keep playing for fun, or stop here" : `tap ${/^Start/.test(label) ? "Start" : label}`}.</p>;
}
/* the screens a clock runs on, and so the ones a Pause makes sense on */
/* where the app's calls are listed, and can be contested */
const CALL_SCREENS = ["answer", "flagReveal", "sayReveal", "mapReveal", "airportReveal", "dishReveal", "battleReview"];
/* ...and sudden death / the tie-breaker: the question just decided, on the screen after it */
const SD_CALL_SCREENS = ["final", "battleSummary", "sudden", "battleTie"];
/* no host: the screens where both captains can agree to a new one, and what it's called */
const SWAP_WORDS: Record<string, string> = { ask: "question", miniQ: "question", flagQ: "flag", pinQ: "landmark", airportQ: "board", majorityQ: "question", dishQ: "dish", mapQ: "map", sayQ: "prompt", battleQ: "question" };
const PAUSABLE = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "majorityQ", "battleQ"];

/* A CAPTAIN's phone: only what you can do right now. Type and send; the
   lifelines; the number pad; the buzzer; the bidding; your players'
   suggestions. With no host, also the referee's buttons and Next. */
/* No host: a captain's request (new total scores, or a new question) that the other captain agrees to, or not.
   No answer in time: nothing changes. The asking captain sees it waiting. */
function AgreeCard({ pub, mine, busy, act }: { pub: Pub; mine: 0 | 1; busy: boolean; act: (move: Record<string, unknown>) => void }) {
  const A = pub.agree, T = pub.teams, left = useSecondsLeft(A?.until);
  if (!A) return null;
  if (A.team === mine) return <p className="text-center text-14 text-[var(--color-ink-2)]" role="status">Asking {T[mine === 0 ? 1 : 0].name}&rsquo;s captain to agree to {A.kind === "swap" ? `a new ${A.what}` : "the new scores"}… ({left} s)</p>;
  return (
    <div className="card flex flex-col gap-2 enter" style={{ borderColor: "var(--color-gold)" }} role="group" aria-label="Do you agree?">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Do you agree?</div>
      {A.kind === "swap"
        ? <p className="text-15"><b style={{ color: tc(A.team) }}>{T[A.team].name}</b>&rsquo;s captain wants a new {A.what}, at the same level.
          <span className="text-[var(--color-ink-2)]"> The clock is stopped meanwhile; a new one gets a fresh clock.</span></p>
        : <p className="text-15"><b style={{ color: tc(A.team) }}>{T[A.team].name}</b>&rsquo;s captain wants to set the scores to <b style={{ color: tc(0) }}>{T[0].name}</b> {A.a}, <b style={{ color: tc(1) }}>{T[1].name}</b> {A.b}.
          <span className="text-[var(--color-ink-2)]"> Now: {T[0].score}–{T[1].score}.</span></p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-gold" disabled={busy} onClick={() => act({ type: "ui/agree", v: true, id: A.id })}>Agree</button>
        <button className="btn" disabled={busy} onClick={() => act({ type: "ui/agree", v: false, id: A.id })}>No</button>
      </div>
      <p className="text-12 text-[var(--color-ink-3)]">No answer in {left} s: nothing changes.</p>
    </div>);
}

export function CaptainGame({ pub, me, members, code, hold = false }: { pub: Pub; me: Member; members: Member[]; code: string; hold?: boolean }) {
  const mine = me.team as 0 | 1, T = pub.teams, sc = pub.screen, nohost = pub.mode === "nohost";
  const theirs = (mine === 0 ? 1 : 0) as 0 | 1;
  const [a, setA] = useState(""), [b, setB] = useState(""), [sending, setBusy] = useState(false), [sentTxt, setSentTxt] = useState<string | null>(null);
  const [bid, setBid] = useState("");
  const [pinAt, setPinAt] = useState<LatLon | null>(null);   // Drop the Pin: where this captain's pin is
  const busy = sending || hold;                     // sending, or waiting for the TV to reply
  useEffect(() => { setA(""); setB(""); setSentTxt(null); setPinAt(null); }, [pub.qid, sc]);
  /* a BUZZ shows at once on this phone (the TV confirms it a moment later, or says who was first) */
  const [buzzed, setBuzzed] = useState(false);
  const outKey = `${pub.out?.[0]}|${pub.out?.[1]}`;
  useEffect(() => { setBuzzed(false); }, [pub.qid, sc, pub.buzz, outKey]);
  useEffect(() => { setBid(""); }, [pub.auction?.bid, sc]);
  const np = useNoPaste(code, pub.qid);
  /* Every tap carries a tag; the TV hands it back once it has dealt with the tap (pub.ack). A tap
     it turned down says why here, and an answer or a buzz it didn't take is let go, to try again. */
  const lastTap = useRef<{ tap: string; kind: string; q: string } | null>(null);
  const [no, setNo] = useState<string | null>(null);
  const act = async (kind: string, payload: Record<string, unknown>) => {
    const tap = newTap(); lastTap.current = { tap, kind, q: `${pub.qid}|${sc}` };
    setBusy(true); try { await sendAction(code, kind, { ...payload, tap }); return true; } catch { lastTap.current = null; return false; /* the phone already says so */ } finally { setBusy(false); }
  };
  const acks = pub.ack?.[me.user_id];
  const got = lastTap.current && acks ? acks[lastTap.current.tap] : undefined;   // undefined: not dealt with yet
  useEffect(() => {
    const L = lastTap.current;
    if (!L || got === undefined) return;
    lastTap.current = null;                          // each receipt once
    if (got === "+") return;                         // taken: the TV's view shows what came of it
    const ack = { no: got === "-" ? undefined : got };
    /* taken: it shows as sent, it's waiting for its call, or the question has already moved on (a right answer) */
    const mineIn = !!pub.sent?.[mine] || pub.pending?.team === mine || `${pub.qid}|${sc}` !== L.q;
    if (L.kind === "answer" && !mineIn) { setSentTxt(null); setNo(ack.no || "The TV didn't take that answer. Send it again."); }
    else if (L.kind === "buzz" && pub.buzz !== mine && `${pub.qid}|${sc}` === L.q) { setBuzzed(false); setNo(ack.no || "The TV didn't take the buzz. Tap again."); }
    else if (ack.no) setNo(ack.no);
  }, [got, acks]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!no) return; const t = setTimeout(() => setNo(null), 6000); return () => clearTimeout(t); }, [no]);
  const nxt = (move: Record<string, unknown>) => act("next", { move, step: pub.step });
  /* quick taps (+1, pausing a call): straight out, nothing waits for them */
  const fire = (move: Record<string, unknown>) => { void sendAction(code, "next", { move, step: pub.step }).catch(() => {}); };

  const myTurn = (sc === "ask" || sc === "steal") && pub.turn === mine && !pub.lifeline;
  const dip = sc === "ask" && (pub.llUsed?.[mine] || []).includes("dip");
  /* one answer per question: once it's sent it's locked (the app checks it, or the host decides) */
  /* sentTxt: what this phone has just sent, locked at once (before the TV's update comes back) */
  const sentHere = !!pub.sent?.[mine] || !!sentTxt;
  const locked = !!pub.pending || sentHere;
  const canType = !pub.paused && ((myTurn && !locked) || (sc === "miniQ" && !sentHere) || ((sc === "flagQ" || sc === "mapQ" || sc === "sayQ" || sc === "airportQ") && !sentHere)
    /* a buzz: one answer, and once it's sent the box closes (it stayed open, with its Send, and got sent twice: 20 Oct) */
    || (BUZZ_SCREENS.includes(sc) && pub.buzz === mine && !pub.pending && !sentHere)
    /* the Battle: typed with no host; with a host it's said out loud */
    || (sc === "battleQ" && nohost && pub.battle?.cap === mine && !locked));
  const canBuzz = (sc === "dishQ" && pub.buzz == null && !pub.out?.[mine]) || (sc === "sudden" && !!pub.sudden?.ready && pub.buzz == null && !pub.out?.[mine])
    || (sc === "battleTie" && pub.buzz == null && !pub.out?.[mine]);
  /* Drop the Pin: the map is the answer box */
  const canPin = !pub.paused && sc === "pinQ" && !sentHere;
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
  /* no host: a new question (flag, landmark…) if both captains agree, while nobody has answered this one */
  const swapWord = sc === "dishQ" ? (pub.dish?.kind || "dish").toLowerCase() : SWAP_WORDS[sc];
  const canSwap = nohost && !!swapWord && !pub.sent?.[0] && !pub.sent?.[1] && !sentHere && pub.buzz == null && !pub.out?.[0] && !pub.out?.[1]
    && !((pub.majority?.answered?.[0] || 0) + (pub.majority?.answered?.[1] || 0));

  /* Closest To Wins: "1.5 million", "2k", "€25" all count; what the TV will read is shown back */
  const guess: number = sc === "miniQ" && a.trim() ? QMB.parseNumber(a, pub.question) : NaN;
  const per = /\bin (thousand|million|billion)s\b/i.exec(pub.question || "")?.[1].toLowerCase();
  /* what's in the box goes to the TV a moment after each pause in typing: if the clock runs out before
     Send, the TV takes it (typed "elephan", never sent: "elephan" is the answer) */
  const draftKey = `${pub.qid}|${sc}`, drafted = useRef("");
  useEffect(() => {
    if (!canPin || !pinAt) return;
    /* (the pin, where it is now: it counts if the clock runs out before Lock in) */
    const t = setTimeout(() => sendDraft(code, { k: draftKey, pin: pinAt }), 300);
    return () => clearTimeout(t);
  }, [pinAt, canPin, draftKey, code]);
  useEffect(() => {
    if (!canType) return;
    const body = sc === "miniQ" ? { n: a.trim() } : { texts: [a, b].map((x) => x.trim()).filter(Boolean) };
    const sig = draftKey + JSON.stringify(body);
    if (sig === drafted.current || (!a.trim() && !b.trim() && !drafted.current.startsWith(draftKey))) return;
    const t = setTimeout(() => { drafted.current = sig; sendDraft(code, { k: draftKey, ...body }); }, 300);
    return () => clearTimeout(t);
  }, [a, b, canType, draftKey, sc, code]);
  const sendPin = async () => { if (!pinAt) return; setSentTxt("your pin"); if (!(await act("answer", { pin: pinAt, k: draftKey }))) setSentTxt(null); };
  const send = async () => {
    /* locked in on this phone straight away; put back if it couldn't go */
    if (sc === "miniQ") { if (!Number.isFinite(guess)) return; setSentTxt(a); if (!(await act("answer", { n: a, k: draftKey }))) setSentTxt(null); return; }
    const texts = [a, b].map((x) => x.trim()).filter(Boolean);
    if (!texts.length) return;
    setSentTxt(texts.join(" / "));
    if (!(await act("answer", { texts, k: draftKey }))) setSentTxt(null);
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      {no && <p className="text-center text-14 font-bold enter" role="alert" style={{ color: "var(--color-gold)" }}>{no}</p>}
      {nohost && <AgreeCard pub={pub} mine={mine} busy={busy} act={(m) => void nxt(m)} />}
      {sc === "majorityIntro" && <MajorityList pub={pub} me={me} act={nohost ? fire : undefined} />}
      <Head pub={pub} me={me} canArm={(t) => t === mine} onArm={() => void act("lifeline", { key: "dbl" })} busy={busy} />

            <OnScreen pub={pub} counting={nohost && sc === "auctionRun" && A?.by === theirs} small={sc === "pinQ"} />
      {/^majority(Q|Reveal)$/.test(sc) && <MajorityPad pub={pub} me={me} code={code} />}
      <Result pub={pub} mine={mine} headOnly={CALL_SCREENS.includes(sc)} />
      {/* the app's calls, each with a small Contest (the other captain, or the host, decides) */}
      {(CALL_SCREENS.includes(sc) || SD_CALL_SCREENS.includes(sc)) && <Calls pub={pub} mine={mine} busy={busy} act={(m) => void nxt(m)} />}


      {/* no host, Call a Friend: the calling captain starts the friend's clock once they're through, and closes the card */}
      {nohost && pub.lifeline?.key === "friend" && pub.lifeline.team === mine && pub.lifeline.wait && (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/startCall" })}>Start the call ({pub.timers?.friend ?? 30} s)</button>)}
      {nohost && pub.lifeline?.key === "friend" && pub.lifeline.team === mine && (
        <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => void nxt({ type: "ui/closeLifeline" })}>Back to the question</button>)}
      {/* no host, Call a Friend: the lead captain can stop the call's clock */}
      {nohost && lead && pub.lifeline?.key === "friend" && !pub.lifeline.wait && (pub.lifeline.deadline || pub.lifeline.left) && (
        <button className="btn btn-sm self-center" onClick={() => fire({ type: "ui/pauseFriend" })}>{pub.lifeline.deadline ? "Pause the call" : "Resume the call"}</button>)}

      {canBuzz && !buzzed && <button className="btn btn-lg btn-block display" style={{ minHeight: 110, fontSize: 48, background: tc(mine), color: "#04050e", borderColor: "transparent" }} disabled={busy}
        onClick={() => { buzzHand(40); setBuzzed(true); void act("buzz", {}).then((ok) => { if (!ok) setBuzzed(false); }); }}>BUZZ</button>}
      {canBuzz && buzzed && <div className="display text-center rounded-[16px] grid place-items-center" role="status" style={{ minHeight: 110, fontSize: 40, background: tc(mine), color: "#04050e", opacity: 0.85 }}>BUZZED!</div>}

      {canType && (
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="field-label !mb-0" htmlFor="ans">{sc === "miniQ" ? "Your number" : dip ? "Your two answers" : "Your answer"}</label>
            {/* the cocktail or dish: you buzzed, now type it before your own clock runs out */}
            {sc === "dishQ" && pub.dish?.typeBy && <div className="flex items-center gap-2 text-13 font-bold" role="timer"><Clock deadline={pub.dish.typeBy} size={52} />to type it</div>}
            {(sc === "sudden" || sc === "battleTie") && pub.typeBy && <div className="flex items-center gap-2 text-13 font-bold" role="timer"><Clock deadline={pub.typeBy} size={52} />to type it</div>}
          </div>
          <input id="ans" {...np.props} className="input" value={a} maxLength={80} autoComplete="off" autoCorrect="off" spellCheck={false}
            /* Closest: the number pad, fastest (the reader still takes "1.5 million" if a keyboard sends it) */
            inputMode={sc === "miniQ" ? "decimal" : "text"} placeholder={sc === "miniQ" ? "e.g. 236" : "Type it"} onChange={(e) => setA(e.target.value)} />
          {sc === "miniQ" && a.trim() && (Number.isFinite(guess)
            ? ![String(guess), guess.toLocaleString("en-GB")].includes(a.trim()) && <div className="text-13 text-[var(--color-ink-2)]">Counts as <b>{guess.toLocaleString("en-GB")}{per ? ` ${per}` : ""}</b></div>
            : <p className="text-13 text-[var(--color-no)]" role="alert">That isn&rsquo;t a number.</p>)}
          {dip && <input {...np.props} className="input" aria-label="Your second answer" value={b} maxLength={80} placeholder="Second answer" onChange={(e) => setB(e.target.value)} />}
          {np.hint}
          <button className="btn btn-gold btn-lg" disabled={busy || !a.trim() || (sc === "miniQ" && !Number.isFinite(guess))} onClick={() => void send()}>{sc === "miniQ" ? "Lock in" : "Send"}</button>
          {(sc === "ask" || sc === "steal") && <div className="text-13 text-[var(--color-ink-3)]">One go: once you send it, it&rsquo;s locked{nohost ? " and the app checks it" : " until the host decides"}.</div>}
        </div>)}
      {canPin && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-13 text-[var(--color-ink-3)]">{pinAt ? "Drag your pin to move it. Zoom in (pinch, or +) to place it exactly." : "Tap the map to drop your pin."}</p>
          <PinMap value={pinAt} onChange={setPinAt} color={TEAM_HEX[mine]} height="min(520px, max(300px, calc(100dvh - 460px)))" />
          <button className="btn btn-gold btn-lg btn-block dock" disabled={busy || !pinAt} onClick={() => void sendPin()}>Lock in</button>
        </div>)}
      {!canType && sentHere && (["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ"].includes(sc) || (myTurn && !pub.pending) || (BUZZ_SCREENS.includes(sc) && pub.buzz === mine && !pub.pending)) && (
        <p className="text-center font-bold text-16" role="status">Locked in{sentTxt && sc !== "pinQ" ? `: ${sentTxt}` : ""}.</p>)}
      {sc === "pinQ" && sentHere && pinAt && <PinMap value={pinAt} color={TEAM_HEX[mine]} height="min(40vh, 340px)" label="Your pin" />}

      {/* the lifelines: everyone sees them; the captain whose question it is taps */}
      {sc === "ask" && <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" busy={busy}
        onUse={myTurn && !locked ? (k) => void act("lifeline", { key: k }) : undefined} />}

      {/* the Auction: bidding is always the captains' */}
      {sc === "auctionBid" && A && A.turn === mine && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">{A.bid ? `Beat ${A.bid}, or pass` : "Open the bidding"}</div>
          <p className="text-13 text-[var(--color-ink-2)]">Whoever wins the bid has <b>{pub.timers?.auction ?? 30} seconds</b> to name them, out loud.</p>
          {/* a number typed in the box: its Bid is the big button, and +1 steps back (people typed 15, then tapped "Raise to 2") */}
          {A.bid < MAX_BID && <button className={"btn " + (bid ? "btn-sm self-start" : "btn-gold btn-lg")} disabled={busy} onClick={() => void nxt({ type: "auction/raise", n: A.bid + 1 })}>Raise to {A.bid + 1}</button>}
          <div className="flex gap-2">
            <input {...np.props} className="input" aria-label="Custom bid" inputMode="numeric" value={bid} placeholder="Or type your bid" onChange={(e) => setBid(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            <button className={"btn shrink-0 " + (bid ? "btn-gold btn-lg" : "")} disabled={busy || !(Number(bid) > A.bid) || Number(bid) > MAX_BID} onClick={() => void nxt({ type: "auction/raise", n: Number(bid) })}>{bid && Number(bid) > A.bid ? `Bid ${Number(bid)}` : "Bid"}</button>
          </div>
          {bid !== "" && !(Number(bid) > A.bid) && <p className="text-13 text-[var(--color-no)]" role="alert">A bid has to beat {A.bid}.</p>}
          {Number(bid) > MAX_BID && <p className="text-13 text-[var(--color-no)]" role="alert">Bids go up to {MAX_BID}.</p>}
          {A.bid > 0 && (
            <button className="btn btn-lg btn-block pass-btn" disabled={busy} onClick={() => void nxt({ type: "auction/pass" })}>
              <span className="text-18">Pass</span>
              <span className="text-13 font-semibold text-[var(--color-ink-2)]"><b style={{ color: tc(A.by ?? theirs) }}>{T[A.by ?? theirs].name}</b> must name {A.bid}</span>
            </button>)}
        </div>)}
      {/* no host: the other captain counts the names */}
      {nohost && sc === "auctionRun" && A && A.by === theirs && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">You&rsquo;re counting. Only fair ones count.</div>
          <Counter A={A} fire={fire} h={92} fs={44} />
        </div>)}

      {/* the end of the night, no host: either captain sends everyone home */}
      {nohost && sc === "final" && (<>
        <button className="btn btn-gold btn-lg btn-block mt-auto" disabled={busy} onClick={() => void nxt({ type: "ui/again" })}>Play again: same teams</button>
        <p className="text-center text-13 text-[var(--color-ink-3)]">Exit takes every phone and the TV back to the home screen.</p>
        <button className="btn btn-lg btn-block" disabled={busy} onClick={() => { void nxt({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
      </>)}
      {/* no host, won with legs to spare: the lead captain picks */}
      {nohost && sc === DECIDED && mayNext && pub.nextBy && (
        <div className="flex flex-col gap-3 mt-auto dock-group">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "decided/stop" })}>Stop here</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "decided/more" })}>Keep playing for fun</button>
        </div>)}
      {/* no host, level at the end of a mini-game: the lead captain picks */}
      {nohost && TIE_SCREENS.includes(sc) && mayNext && pub.nextBy && (
        <div className="flex flex-col gap-3 mt-auto dock-group">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/stop" })}>A point each</button>
        </div>)}

      {/* no host: start, go and next — the lead captain (Team A's) */}
      {showNext && next && (
        <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: next[1] })}>{next[0]}</button>)}
      {nohost && mayNext && pub.nextBy && sc === "sudden" && !pub.sudden?.ready && <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: "sudden/go" })}>Go</button>}
      {pub.nextBy && !lead && open && <p className="text-center text-13 text-[var(--color-ink-3)]">{pub.nextBy} hasn&rsquo;t tapped it, so you can.</p>}
      {pub.nextBy && !lead && !open && <WaitingFor pub={pub} />}
      {/* no host: either captain can stop the clock (the question hides until it restarts), and, before anyone has
          answered, ask for a new question (the other captain agrees) */}
      {nohost && (PAUSABLE.includes(sc) || canSwap) && !pub.lifeline && !pub.pending && !pub.tvAway && (pub.deadline || pub.paused) && pub.agree?.kind !== "swap" && (
        <div className="flex justify-center gap-2">
          {PAUSABLE.includes(sc) && <button className="btn btn-sm" disabled={busy} onClick={() => void nxt({ type: "ui/pause", on: pub.paused ? "resume" : "pause" })}>{pub.paused ? "Resume" : "Pause"}</button>}
          {canSwap && <button className="btn btn-sm btn-ghost" disabled={busy || !!pub.agree} onClick={() => void nxt({ type: "ui/askSwap" })}>Change the {swapWord}</button>}
        </div>)}

      {sugs.length > 0 && (canType || ANSWERING.includes(sc)) && (
        <div className="card">
          <div className="eyebrow mb-2">Your team suggests{canType ? ". Tap one to use it." : ""}</div>
          <div className="flex flex-col gap-1">
            {sugs.map((s) => (
              <button key={s.id} className="text-left text-15 min-h-[44px] px-2 -mx-2 rounded-[12px] active:bg-white/10" disabled={!canType} onClick={() => setA(s.text)}>
                <b style={{ color: tc(mine) }}><bdi>{members.find((m) => m.user_id === s.user_id)?.name}</bdi>:</b> {s.text}</button>))}
          </div>
        </div>)}

    </div>
  );
}
