"use client";
import { twoDone } from "./TwoResults";
import { useRevealHold, WatchTv } from "./WatchTv";
import { useNoTv } from "./NoTv";
import { NEXT_MOVES, WAITS_FOR_NEXT } from "@/lib/tv/rules";
import { AwardList, Pts, ResultTable, TitleLine, WinnerCard, YouPill, type RRow, type Tone } from "./ResultTable";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { DECIDED, iso, MAX_BID, offBy, showKm, showNum, T_AGREE, TIE_SCREENS, type LatLon, type Pub, type Secret, type Two, poss } from "@/lib/game";
import type { Member } from "@/lib/room";
import { QMB } from "@/lib/engine";
import { joinLive, newTap, note, rpc, sb, sendAction, sendDraft } from "@/lib/supabase";
import { friendly } from "@/lib/errors";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { RrPhone, RrPhoneReveal, rrLevelWord, signed, useSpun, type RrTeam } from "./Roulette";
import { StakesBet, StakesPhone } from "./Stakes";
import { signedPts, skLevelWord } from "@/lib/stakes";
import { MapView } from "./MapView";
import { PinMap } from "./PinMap";
import { ToSide } from "./Side";
import { sayCount, useLiveCount } from "@/lib/liveCount";
import { AskHead, battleNeeds, Board, decidedCall, decidedHead, decidedSub, FlagImg, PinPhoto, pinMarks, LifelineStrip, MiniIntro, RoundIntro, RulingPicker, ScoreBoard, silent, SuddenRules, TEAM_HEX, tieCall, tieHead, Verdict, verdictWord } from "./GameParts";

const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };
export const ANSWERING = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ", "stakesQ", "sudden", "battleQ", "battleTie"];
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

/* where a captain buzzes, then types (sudden death and the Battle's tie-breaker have no buzzer since 7 Nov: both type) */
const BUZZ_SCREENS = ["dishQ"];
const RACE = (pub: Pub) => (pub.screen === "sudden" && !!pub.sudden?.ready) || pub.screen === "battleTie";
/* A captain's inbox: what their own players suggest for the question on
   screen, newest first, with who said it. */
type Sug = { id: number; user_id: string; text: string };
export function useSuggestions(code: string, qid: string | undefined, members: Member[], team: number, on: boolean) {
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
export function useNoPaste(code: string, qid?: string) {
  const noTv = useNoTv();
  const [said, setSaid] = useState(false);
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(false), 3500); return () => clearTimeout(t); }, [said]);
  const block = (e: { preventDefault: () => void }) => { e.preventDefault(); setSaid(true); note(code, { paste: { qid } }); };
  const props = {
    onPaste: block, onDrop: block,
    onBeforeInput: (e: React.FormEvent<HTMLInputElement>) => { const t = (e.nativeEvent as InputEvent).inputType || ""; if (/^insertFrom(Paste|Drop)/.test(t)) block(e); },
  };
  const hint = said ? <p className="text-13 font-bold text-[var(--color-no)]" role="alert">No pasting: type it yourself. {noTv ? "It's been flagged." : "The TV has been told."}</p> : null;
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
  /* (and says its number on the room's live channel: the other phones and the TV show it at once, lib/liveCount) */
  const tap = (d: 1 | -1) => { const n = Math.max(0, shown + d); setOpt({ leg, n }); sayCount(leg, n); fire({ type: d > 0 ? "auction/tick" : "auction/untick" }); buzzHand(15); };
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

/* the Auction's count on a phone that isn't counting: the counting phone's number, live (lib/liveCount) */
function LiveN({ A }: { A: NonNullable<Pub["auction"]> }) { return <>{useLiveCount(`${A.leg}:${A.cat}`, A.count)}</>; }

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
  const noTv = useNoTv();
  const M = pub.majority, key = `${pub.qid}|majorityQ`;
  const [mine, setMine] = useState<{ key: string; pick: string; tap: string } | null>(null);
  const [no, setNo] = useState<string | null>(null);
  /* this phone's pick, kept for the question, so a reload doesn't turn it into "You didn't answer" (the 4 Nov audit, 3.14) */
  const store = "qmb.mr." + code;
  useEffect(() => { try { const x = JSON.parse(sessionStorage.getItem(store) || "null"); if (x?.key === key && !mine) setMine({ ...x, tap: "" }); } catch { /* none */ } }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => phoneOrder(M?.options || [], `${me.user_id}|${pub.qid}`), [M?.options, me.user_id, pub.qid]);
  /* the TV's receipt: a tap it turned down says why, and lets go of it */
  const got = mine ? pub.ack?.[me.user_id]?.[mine.tap] : undefined;
  useEffect(() => { if (mine && got && got !== "+" && pub.screen === "majorityQ") { setNo(got === "-" ? (noTv ? "That didn't go through. Tap again." : "The TV didn't take that. Tap again.") : got); setMine(null); } }, [got]);   // eslint-disable-line react-hooks/exhaustive-deps
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
    try { sessionStorage.setItem(store, JSON.stringify({ key, pick })); } catch { /* in memory only */ }
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
  const noTv = useNoTv();
  const T = pub.teams, turn = pub.turn ?? 0;
  /* only trust the secret when it belongs to this very screen: the question
     and the answer travel separately, and the answer must never be the last one */
  const fresh = !pub.qid || (raw.qid === pub.qid && (raw.step ?? 0) >= pub.step);
  const secret: Secret = fresh ? raw : {};
  const loading = !!pub.qid && !fresh;
  const rrSpun = useSpun(pub.roulette?.spinAt);   // Russian Roulette: the answers once the barrel stops
  /* A ruling on a reveal is a switch, and it shows the moment it's tapped (the TV confirms a beat later):
     on a slow server a tap looked like it did nothing (20 Oct). Unconfirmed after 8 s, the TV's call shows again. */
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const pickKey = (t: 0 | 1) => `${pub.qid}|${pub.screen}|${t}`;
  const okNow = `${pub.reveal?.ok?.[0]}|${pub.reveal?.ok?.[1]}`;
  useEffect(() => { setPicked({}); }, [pub.qid, pub.screen, okNow]);
  /* (Next waits while a captain's contest waits for the host's ruling: the 4 Nov audit, 3.11) */
  const Main = ({ label, move, off }: { label: string; move: Record<string, unknown>; off?: boolean }) => {
    const wait = !!pub.contest && NEXT_MOVES.has(String(move.type));
    /* (not docked meanwhile: sideways, the docked button sat over the contest's two buttons: the 4 Nov audit, 1.20) */
    if (wait) return <p className="text-center text-13 text-[var(--color-ink-3)] mt-auto" role="status">{label} comes back once you&rsquo;ve ruled on the contest.</p>;
    return <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy || off} onClick={() => send(move)}>{label}</button>; };
  /* the host's private answer: the one box on this phone that isn't a button, so it can't be missed */
  const AnswerCard = () => loading ? <Line>Getting the answer…</Line> : secret.you ? (
    <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>This one&rsquo;s about you</div>
      <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>You know the answer</div>
      <div className="text-13 text-[var(--color-ink-2)] mt-1">Tap Right or Wrong for what they say.</div>
    </div>) : secret.answer ? (
    <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
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
    return <Said t={t} text={x?.join("  /  ")} label={x ? `${T[t].name} typed${pub.saidLate === t ? " after time’s up" : ""}` : T[t].name} empty={pub.timeUp ? "No answer" : `Waiting for ${T[t].name}’s captain to type…`} />;
  };
  /* RIGHT / WRONG under the answer, once there IS an answer (or the clock ran out with none: then the
     app suggests WRONG). The app's call is pre-selected; either button rules. `aloud`: the Battle with a
     host is answered out loud, so the buttons are there from the start, with no suggestion. */
  const Judge = ({ t, right, wrong, aloud }: { t: 0 | 1; right: Record<string, unknown>; wrong: Record<string, unknown>; aloud?: boolean }) => {
    const x = !loading && !!secret.typed?.[t], late = !x && !!pub.timeUp;
    if (!x && !late && !aloud) return null;
    const app = x ? secret.match?.[t] ?? null : late ? false : null;
    return (<>{app != null && <p className="text-center text-13 text-[var(--color-ink-2)]">The app&rsquo;s call is filled in. Tap one to rule.</p>}
      <RulingPicker value={app} app={app} busy={busy || loading} label={`Rule on ${T[t].name}’s answer`} onPick={(v) => send(v ? right : wrong)} /></>);
  };
  /* the reveal screens: each team's answer, and its ruling beside it, which the host can always flip */
  const Rulings = ({ type, say, empty }: { type: string; say?: boolean; empty: string }) => (<><p className="text-center text-13 text-[var(--color-ink-2)]">The app made these calls. Tap one to change it.</p>{([0, 1] as const).map((t) => {
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
  const resultHeld = useTwoHold(pub);
  const Results = ({ children, act }: { children: React.ReactNode; act?: Send }) => (
    <div className="flex flex-col gap-4 flex-1">
      <OnScreen pub={pub} />
      <Result pub={pub} host act={act} />
      {/* (the host sees the result at once; Next waits until the TV has shown it, so it can't be skipped by mistake) */}
      {resultHeld ? <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Next comes up once the TV has shown it.</p> : children}
    </div>);
  /* (short, small and gold, side by side: the owner, 11 Nov) */
  const Exit = () => (
    <div className="mt-auto flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-gold" onClick={() => send({ type: "ui/again" })}>Play again</button>
        {/* home on this phone too, even if the TV is slow to answer */}
        <button className="btn btn-gold-line" onClick={() => { send({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
      </div>
      <p className="text-center text-13 text-[var(--color-ink-3)]">Play again: same teams. Exit takes every phone{noTv ? "" : " and the TV"} back to the home screen.</p>
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
        {/* whether the captains have armed Double Points yet, before the host starts (the 4 Nov audit, 3.11) */}
        <p className="text-center text-13 text-[var(--color-ink-2)]" role="status">Double Points: {([0, 1] as const).map((t) => <span key={t}>{t ? " · " : ""}<b style={{ color: tc(t) }}>{T[t].name}</b> {pub.dbl?.[t] ? "armed" : T[t].ll?.dbl === false ? "used" : "not armed"}</span>)}</p>
        <Main label={`Start: question for ${T[pub.first ?? 0].name}`} move={{ type: "round/begin" }} />
      </div>);
    case "ask": case "steal": return (
      <div className="flex flex-col gap-3 flex-1">
        <ToSide order={2}>
        <AskHead pub={pub} size="phone" />
        <div className="flex items-start gap-3">
          <p className={qCls(pub.question) + " leading-snug flex-1"}>{pub.question}</p>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} />
        </div>
        </ToSide>
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
    /* one table, with Change in each row (the owner's pick on the 4 Nov audit, 3.5: the calls were listed twice) */
    case "answer": return <Results act={send}><Calls pub={pub} host cardOnly busy={busy} act={send} /><Main label="Next" move={{ type: "round/afterAnswer" }} /></Results>;
    case "roundScore": return <Results><Main label="Next" move={{ type: "round/next" }} /></Results>;
    case "sudden": return !pub.sudden?.ready ? (
      <div className="flex flex-col gap-4 flex-1">
        <Big size={40} text="Sudden death" />
        <SuddenRules pub={pub} size="phone" />
        <Main label="Start" move={{ type: "sudden/go" }} />
      </div>) : (
      <div className="flex flex-col gap-3 flex-1">
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <Calls pub={pub} host busy={busy} act={send} />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-26 text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} answered first</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </div>) : (<>
          <Waiting>Waiting for the captains&rsquo; answers…{pub.out?.some(Boolean) ? ` (${T[pub.out[0] ? 0 : 1].name} are out)` : ""}</Waiting>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, next question" move={{ type: "sudden/win", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "sudden/swap" }} />
          </div>
        </>)}
      </div>);
    /* (no list of calls here: sudden death's last one showed as a stray row under the awards: the 4 Nov audit, 1.17) */
    case "final": return <Results><Exit /></Results>;

    /* ---- the mini-games ---- */
    case "miniIntro": case "flagIntro": case "dishIntro": case "mapIntro": case "auctionIntro": case "sayIntro": case "pinIntro": case "airportIntro": case "majorityIntro": case "rouletteIntro": case "stakesIntro": case "battleIntro": return (
      <div className="flex flex-col gap-4 flex-1">
        {pub.screen === "majorityIntro" && <MajorityList pub={pub} me={{ role: "host" } as Member} act={fire} />}
        <MiniIntro pub={pub} size="phone" />
        <Main label={mk === "roulette" ? "Spin" : "Start"} move={{ type: mk === "auction" ? "auction/begin" : mk + "/start" }} />
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
        {/* (sideways, the picture and the clock go to the left column, so the host's calls fit on the right: the 4 Nov audit, 3.7) */}
        <ToSide order={2}><div className="flex items-center justify-between"><div className="eyebrow">Flag {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <FlagImg name={pub.flag} h={110} /></ToSide>
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change flag" move={{ type: "flag/swap" }} /></div>
      </div>);
    case "flagReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} host headOnly />
        <Rulings type="ui/flagOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "pinQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <ToSide order={2}><div className="flex items-center justify-between"><div className="eyebrow">Landmark {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <PinPhoto pin={pub.pin} h={150} small zoom /></ToSide>
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
        <ToSide order={2}><div className="flex items-center justify-between"><div className="eyebrow">Board {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <Board air={pub.airport} size="small" /></ToSide>
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change board" move={{ type: "airport/swap" }} /></div>
      </div>);
    case "airportReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} host headOnly />
        <Rulings type="ui/airportOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    /* Russian Roulette: the barrel spins; then each team's chamber, its question and (only here) its answer */
    case "rouletteQ": return (
      <div className="flex flex-col gap-3 flex-1">
        {pub.roulette && <RrPhone rr={pub.roulette} me={null} teams={rr2(pub)} host />}
        {rrSpun && (loading ? <Line>Getting the answers…</Line> : secret.answers && pub.roulette ? (
          <div className="card cue-card flex flex-col gap-1" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answers. Only you see these</div>
            {([0, 1] as const).map((t) => <div key={t} className="text-15"><b style={{ color: tc(t) }}>{T[t].name}</b> · {pub.roulette!.draw[t]?.theme}: <b style={{ color: "var(--color-gold)" }}>{secret.answers![t]}</b></div>)}
          </div>) : null)}
        {rrSpun && <><Typed t={0} /><Typed t={1} /></>}
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change question" move={{ type: "roulette/swap" }} /></div>
      </div>);
    case "rouletteReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        {pub.roulette && <RrPhoneReveal rr={pub.roulette} me={null} teams={rr2(pub)} />}
        {pub.roulette?.rev && <div className="flex flex-col gap-0.5 text-13 text-[var(--color-ink-2)] text-center">{([0, 1] as const).map((t) => (
          <span key={t}><b style={{ color: tc(t) }}>{T[t].name}</b> · {pub.roulette!.draw[t]?.theme} · {rrLevelWord(pub.roulette!.rev!.level[t])} · Answer: <b className="text-[var(--color-ink)]">{pub.roulette!.rev!.answer[t]}</b></span>))}</div>}
        <Rulings type="ui/rouletteOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label={(pub.mini?.leg ?? 0) < (pub.mini?.of ?? 0) ? "Spin" : "Next"} move={{ type: "ui/next" }} />
      </div>);
    /* Secret Stakes: the bets as they come in (the host sees every team's), then each team's own question and its answer */
    case "stakesPick": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Secret Stakes · placing bets</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        {pub.stakes && <StakesPhone sk={pub.stakes} screen="stakesPick" teams={rr2(pub)} me={null} />}
        <p className="text-center text-13 text-[var(--color-ink-3)]">No bet by time&rsquo;s up: the safe one, Easy on the first theme.</p>
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small ghost label="Change the themes" move={{ type: "stakes/swap" }} /></div>
      </div>);
    case "stakesQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between"><div className="eyebrow">Secret Stakes · round {pub.stakes?.round} of {pub.stakes?.rounds}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        {pub.stakes && <StakesPhone sk={pub.stakes} screen="stakesQ" teams={rr2(pub)} me={null} />}
        {loading ? <Line>Getting the answers…</Line> : secret.answers && pub.stakes ? (
          <div className="card cue-card flex flex-col gap-1" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answers. Only you see these</div>
            {([0, 1] as const).map((t) => <div key={t} className="text-15"><b style={{ color: tc(t) }}>{T[t].name}</b>: <b style={{ color: "var(--color-gold)" }}>{secret.answers![t]}</b></div>)}
          </div>) : null}
        <Typed t={0} /><Typed t={1} />
        <div className="flex gap-2 justify-center mt-auto"><Pause /><Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change the themes" move={{ type: "stakes/swap" }} /></div>
      </div>);
    case "stakesReveal": return (
      <div className="flex flex-col gap-3 flex-1">
        {pub.stakes && <StakesPhone sk={pub.stakes} screen="stakesReveal" teams={rr2(pub)} me={null} />}
        <Rulings type="ui/stakesOk" empty="No answer" />
        <Calls pub={pub} host cardOnly busy={busy} act={send} />
        <Main label="Next" move={{ type: "ui/next" }} />
      </div>);
    case "stakesSummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <Result pub={pub} host />
        <Main label="Next" move={{ type: "stakes/done" }} />
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
          <Waiting>{pub.dish?.late != null ? `Time's up for ${T[pub.dish.late].name}. ` : ""}Waiting for a buzz…{[0, 1].filter((t) => pub.out?.[t]).map((t) => ` ${T[t].name} are out.`).join("")}</Waiting>
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
    case "miniTie": case "sayTie": case "flagTie": case "dishTie": case "mapTie": case "pinTie": case "airportTie": case "majorityTie": case "rouletteTie": case "battleLevel": return (
      <div className="flex flex-col gap-4 flex-1">
        <Big eyebrow={pub.mini?.title} size={34} text={tieHead(pub)} sub={tieCall(pub)} />
        <div className="flex flex-col gap-3 mt-auto">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => send({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => send({ type: "tie/stop" })}>{pub.screen === "battleLevel" ? "Share the points" : "A point each"}</button>
        </div>
      </div>);
    case "miniSummary": case "flagSummary": case "dishSummary": case "mapSummary": case "saySummary": case "pinSummary": case "airportSummary": case "majoritySummary": case "rouletteSummary": return (
      <div className="flex flex-col gap-4 flex-1">
        <Result pub={pub} host />
        {S?.note && <Line className="!text-13">{S.note}</Line>}
        {S?.needsHost ? (<>
          <div className="eyebrow text-center">Still a tie. Who gets the {pub.mini?.pts} points?</div>
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <button className="btn btn-a" disabled={busy} onClick={() => send({ type: mk + "/award", w: 0 })}>{T[0].name}</button>
            <button className="btn" disabled={busy} onClick={() => send({ type: mk + "/award", w: "split" })}>Split</button>
            <button className="btn btn-b" disabled={busy} onClick={() => send({ type: mk + "/award", w: 1 })}>{T[1].name}</button>
          </div>
        </>) : <Main label="Next" move={{ type: mk + "/done" }} />}
      </div>);
    case "mapQ": return (
      <div className="flex flex-col gap-3 flex-1">
        <ToSide order={2}><div className="flex items-center justify-between"><div className="eyebrow">Map {pub.mini?.leg} of {pub.mini?.of}</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        {pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={false} hint={!!pub.map.hint} maxH={200} legend={false} />}</ToSide>
        <AnswerCard />
        <Typed t={0} /><Typed t={1} />
        <div className="flex flex-wrap gap-2 justify-center mt-auto"><Pause />{!pub.map?.hint && <Small label="Show hint" move={{ type: "map/hint" }} />}<Small label="Reveal now" move={{ type: "ui/reveal" }} /><Small ghost label="Change map" move={{ type: "map/swap" }} /></div>
      </div>);
    case "mapReveal": { const unruled = pub.reveal?.ok?.some((v) => v == null); return (
      <div className="flex flex-col gap-3 flex-1">
        <OnScreen pub={pub} small />
        <Result pub={pub} host headOnly />
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
        <Result pub={pub} host headOnly />
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
        <Main label={`Start ${poss(T[1].name)} questions`} move={{ type: "battle/start" }} />
      </div>);
    case "battleTie": return (
      <div className="flex flex-col gap-3 flex-1">
        <div className="eyebrow">Battle tie-breaker: the first right answer takes it</div>
        <p className={qCls(pub.question)}>{pub.question}</p>
        <AnswerCard />
        <Calls pub={pub} host busy={busy} act={send} />
        {pub.buzz != null ? (<div className="flex flex-col gap-2 mt-auto">
          <div className="display text-26 text-center" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} answered first</div>
          <Typed t={pub.buzz} />
          <Judge t={pub.buzz} right={{ type: "ui/sdRight" }} wrong={{ type: "ui/sdWrong" }} />
        </div>) : (<>
          <Waiting>Waiting for the captains&rsquo; answers…{pub.out?.some(Boolean) ? ` (${T[pub.out[0] ? 0 : 1].name} are out)` : ""}</Waiting>
          <div className="flex gap-2 justify-center">
            <Small label="Neither, another one" move={{ type: "battle/tbWin", w: "none" }} />
            <Small ghost label="Change question" move={{ type: "battle/tbSwap" }} />
          </div>
        </>)}
      </div>);
    case "battleSummary": return <Results><Calls pub={pub} host busy={busy} act={send} /><Main label="Next" move={{ type: "battle/done" }} /></Results>;
    default: return <div className="eyebrow text-center">{noTv ? "Get ready" : "Eyes on the TV"}</div>;
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
/* the flagged list: the host's, and with no host both captains' (8 Nov, the owner); color: a team's colour (3-8 teams) */
export function AwayLog({ flags, color = (t) => tc(t === 0 || t === 1 ? t : null) }: { flags?: { id: number; name: string; team: number | null; label: string; ms: number | null; kind?: string }[] | null; color?: (t: number | null) => string }) {
  const all = flags || [];
  const noTv = useNoTv();
  return (
    <div className="card flex flex-col gap-2">
      <div className="eyebrow" style={{ color: "var(--color-no)" }}>Flagged: left the screen or pasted</div>
      {all.length ? [...all].reverse().map((f) => (
        <div key={f.id} className="text-14"><b style={{ color: color(f.team) }}>{f.name}</b> · {f.label} · {f.kind === "paste" ? "tried to paste an answer" : f.ms != null ? `left the screen ${Math.round(f.ms / 1000)}s` : "left the screen, still away"}</div>))
        : <p className="text-14 text-[var(--color-ink-2)]">Nobody so far. A phone that switches app or tab during a question shows up here{noTv ? "" : " and on the TV"}.</p>}
    </div>);
}

/* The host, if something went wrong (a call that couldn't be put right, a bug): set the total scores
   by hand. Out of the way at the bottom of the Players panel, and it asks first.
   ask: a captain with no host, who asks for it instead: the other captain has to agree. */
/* The host (with no host, either captain: 8 Nov): the TV laptop died? A 6-digit code for a new one (29 Oct, B9). The new laptop opens the site,
   taps "Take over as the TV", types the room and this code, and the night carries on from its last save. */
export function TvTakeover({ code }: { code: string }) {
  const [open, setOpen] = useState(false), [got, setGot] = useState<{ code: string; saved: number } | null>(null), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  if (!open) return <button className="btn btn-sm btn-ghost self-center" onClick={() => setOpen(true)}>The TV died?</button>;
  const ask = async () => {
    setBusy(true); setErr(null);
    try { const r = await rpc<{ ok?: boolean; code?: string; saved?: number; error?: string }>("qmb_tv_code", { r: code }); if (r?.error) setErr(r.error === "not_host" ? "Only the host can get a code. With no host, either captain can." : friendly(new Error(r.error))); else if (r?.code) setGot({ code: r.code, saved: r.saved ?? 0 }); }
    catch (e) { setErr(friendly(e)); }
    setBusy(false);
  };
  return (
    <div className="card flex flex-col gap-2">
      <div className="eyebrow">Move the TV to another laptop</div>
      <p className="text-13 text-[var(--color-ink-2)]">Only if the TV laptop is really dead. On the new one, open the site, tap <b>Join a game</b>, then <b>The TV died?</b> at the very bottom, then type the room code and this code. The night carries on from the TV&rsquo;s last save; the old laptop stops being the TV.</p>
      {got ? (<>
        <div className="display text-52 text-center tracking-[.2em]" style={{ color: "var(--color-gold)" }}>{got.code}</div>
        <p className="text-12 text-[var(--color-ink-3)] text-center">Room {code} · good for 10 minutes · last saved {got.saved < 60 ? `${got.saved} s` : `${Math.round(got.saved / 60)} min`} ago</p>
      </>) : <button className="btn btn-gold" disabled={busy} onClick={() => void ask()}>{busy ? "Getting a code…" : "Get a code"}</button>}
      {err && <p className="text-13" style={{ color: "var(--color-bad)" }} role="alert">{err}</p>}
      <button className="btn btn-sm btn-ghost self-center" onClick={() => { setOpen(false); setGot(null); setErr(null); }}>Close</button>
    </div>);
}

export function ScoreFix({ pub, send, busy, ask }: { pub: Pub; send: Send; busy: boolean; ask?: boolean }) {
  const noTv = useNoTv();
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
        : "Only if something went wrong. " + (noTv ? "Every phone shows" : "The TV and every phone show") + " the new scores at once."}</p>
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
      {/* in the results table's frame (the owner's pick, 1 Nov), with the Contest beside each call */}
      {/* (3 Nov, the owner: no RIGHT/WRONG word, which crowded the row: what was typed in green or red, with a tick or a
          cross for anyone who can't tell the two apart, and the right answer after a wrong one, in grey. A long list (the
          Battle's twenty) puts each team's name once, as a heading, and numbers its rows) */}
      {!cardOnly && <div className={"rtable-box grid items-center gap-x-3 gap-y-1.5 text-14" + (C.length > 6 ? " max-h-[52vh] overflow-y-auto pr-1" : "")}
        style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
        {lastQ && <div className="eyebrow text-center col-span-3">The last question</div>}
        {C.map((c, i) => { const dim = { opacity: K && K.id !== c.id ? 0.6 : 1 }, grouped = C.length > 4, head = grouped && (i === 0 || C[i - 1].team !== c.team);
          const col = c.skipped ? "var(--color-ink-2)" : c.ok ? "var(--color-ok)" : "var(--color-no)", said = c.text || (c.ok && c.answer) || (say ? "" : "No answer"); return (
          <Fragment key={c.id}>
            {head && <div className={"col-span-3 font-bold text-13 eyebrow" + (i ? " mt-2" : "")} style={{ color: tc(c.team) }}>{T[c.team].name}</div>}
            {/* the name cut short, the answer whole: this list is the only place a captain sees what was typed (29 Oct) */}
            {/* (its note, "steal" or "a new question", on its own line under the name: beside it, it was cut to "s…", 3 Nov) */}
            <span className="max-w-[96px] min-w-0 flex flex-col leading-tight" style={dim}>
              {!grouped && <span className="font-bold truncate" style={{ color: tc(c.team) }} title={T[c.team].name}>{T[c.team].name}</span>}
              {c.note && !lastQ && <span className={grouped ? "text-13 tabular-nums text-[var(--color-ink-3)]" : "text-12 text-[var(--color-ink-3)]"}>{c.note}</span>}
              {c.changed && <span className="text-12 text-[var(--color-gold)]">{nohost ? "changed" : "host’s call"}</span>}
              {/* Don't Say the Same: why, in the game's own words (the owner's pick on the 4 Nov audit, 1.21: a red cross under
                  "A point each" read as a loss) */}
              {say && c.text && <span className="text-12 text-[var(--color-ink-3)]">{c.ok ? "Dodged it" : pub.reveal?.offList?.[c.team] ? "Not on the list" : "Said the app’s word"}</span>}</span>
            <span className="min-w-0 break-words leading-snug" style={dim}>
              <span className="font-bold" style={{ color: col }}><span aria-label={say ? (c.ok ? "dodged it:" : "said it:") : c.ok ? "right:" : "wrong:"} className="mr-1">{c.skipped ? "–" : c.ok ? "\u2713" : "\u2717"}</span>{said}</span>
              {c.answer && !c.ok && <span className="text-[var(--color-ink-3)]">{said ? " · " : ""}{c.answer}</span>}</span>
            <span className="justify-self-end min-h-[36px] flex items-center" style={dim}>
              {c.skipped ? null : host ? <button className="text-13 font-bold underline underline-offset-4 min-h-[36px] px-1" disabled={busy} onClick={() => act({ type: "ui/flip", id: c.id })}>Change</button>
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

/* a game's or a round's result waits on the phones while the TV reveals it (the winner comes in last): true while it
   waits. The host's buttons wait with it, so Next can't skip the reveal by mistake (the owner, 1 Nov) */
function useTwoHold(pub: Pub) {
  const sc = pub.screen, m = pub.mini;
  const won = sc === "auctionResult" ? pub.auction?.winner : sc === "battleSummary" ? pub.battle?.winner
    : sc === "roundScore" ? (pub.roundPts && pub.roundPts[0] !== pub.roundPts[1] ? (pub.roundPts[0] > pub.roundPts[1] ? 0 : 1) : null) : pub.summary?.winner;
  const holdKey = /Summary$|^auctionResult$|^roundScore$/.test(sc) ? `${sc}:${m?.key ?? ""}:${pub.r}` : null;
  return useRevealHold(holdKey, twoDone(won) + 0.3);
}

/* part: "pill" is only how your team did (it goes at the top of the phone, above the question), "rest" the result without it */
/* host: the host's phone sees the result at once; everyone else gets "Eyes on the TV" while the TV reveals it (the owner,
   on the 4 Nov audit, 3.9) */
function Result({ pub, mine, headOnly, part, host = false, act }: { pub: Pub; mine?: 0 | 1; headOnly?: boolean; part?: "pill" | "rest"; host?: boolean; act?: (move: Record<string, unknown>) => void }) {
  const T = pub.teams, sc = pub.screen, m = pub.mini;
  const heldNow = useTwoHold(pub) && !host;
  /* a question's result (the owner's pick, 1 Nov): how your team did in one pill, then a table, a row a team */
  const pill = (text: string, tone: Tone) => <YouPill text={text} tone={tone} />;
  const row = (t: 0 | 1, val: React.ReactNode, ok: boolean | null | undefined, end?: React.ReactNode, sub?: React.ReactNode): RRow =>
    ({ team: t, name: T[t].name, color: tc(t), letter: "AB"[t], val, ok: ok ?? null, end, sub, me: t === mine });
  /* the mini-games' last column: the leg, to whoever takes it (both on a tie) */
  const leg = (t: 0 | 1, w: unknown) => (w === t || w === "tie" ? <span style={{ color: "var(--color-ok)" }}>✓</span> : <span style={{ color: "var(--color-ink-3)" }}>–</span>);
  const legPill = (w: unknown) => mine == null ? null : w === mine ? pill("Your team takes the leg", "ok") : w === "tie" ? pill("A point each", "ok")
    : w === "none" ? pill("Nobody gets it", "mid") : w === 0 || w === 1 ? pill("Not this time", "no") : null;
  const legW = (w: unknown) => (w === 0 || w === 1 ? w : null) as 0 | 1 | null;
  /* how your team did on this question, in one pill */
  const dishW = legW(pub.reveal?.w), MR = pub.majority?.reveal;
  const you: React.ReactNode = mine == null ? null
    : sc === "answer" && pub.result ? (pub.result.by === mine ? pill(`Your team +${pub.result.pts}${pub.result.stolen ? ", stolen!" : ""}`, "ok")
      : (pub.calls || []).some((c) => c.team === mine && !c.ok) ? pill("Your team: wrong", "no")
      : pub.result.by != null ? pill(`${T[pub.result.by].name} +${pub.result.pts}${pub.result.stolen ? ", stolen" : ""}`, "mid") : pill("Nobody scores", "mid"))
    : sc === "closestReveal" || sc === "pinReveal" ? legPill(pub.reveal?.w)
    : sc === "majorityReveal" && MR ? pill(`Your team: ${MR.right[mine]} of ${pub.majority?.n?.[mine] ?? 0} right`, MR.right[mine] > 0 ? "ok" : "mid")
    : sc === "sayReveal" && pub.reveal?.w === "tie" ? pill(pub.reveal.ok?.[0] === false && pub.reveal.ok?.[1] === false ? (!pub.reveal.typed?.[0]?.length && !pub.reveal.typed?.[1]?.length ? "Nobody answered · a point each" : "Both said it · a point each") : "Both dodged it · a point each", "ok")
    : /^(flag|say|map|airport)Reveal$/.test(sc) && pub.reveal ? (sc !== "mapReveal" || (pub.map?.ruled?.[0] != null && pub.map?.ruled?.[1] != null) ? legPill(pub.reveal.w) : null)
    : sc === "dishReveal" && pub.reveal ? (dishW === mine ? pill("Your team got it", "ok") : dishW != null ? pill(`${T[dishW].name} got it`, "no") : pill("Nobody got it", "mid"))
    /* Russian Roulette: right or wrong, and what the chamber paid (the bullet can cost 3) */
    : sc === "rouletteReveal" && pub.roulette?.rev ? (() => { const R = pub.roulette!.rev!, got = R.got[mine] ?? 0, bullet = R.level[mine] === "bullet";
      return pub.reveal?.ok?.[mine] ? pill(`Your team: right · ${signed(got)}`, "ok") : pill(`Your team: ${pub.reveal?.typed?.[mine]?.length ? "wrong" : "no answer"}${bullet ? ` on the bullet · ${signed(got)}` : ""}`, got < 0 ? "no" : "mid"); })()
    /* Secret Stakes: right or wrong, and what the bet came to */
    : sc === "stakesReveal" && pub.stakes?.rev ? (() => { const R = pub.stakes!.rev!, d = R.delta[mine] ?? 0, lv = skLevelWord(R.level[mine]);
      return R.ok[mine] ? pill(`Your team: right on ${lv} · ${signedPts(d)}`, d > 0 ? "ok" : "mid") : pill(`Your team: ${R.typed[mine] ? "wrong" : "no answer"} on ${lv} · ${signedPts(d)}`, d < 0 ? "no" : "mid"); })()
    : sc === "stakesSummary" && pub.stakes?.sum ? (() => { const v = pub.stakes!.sum!.net[mine] ?? 0; return pill(`Your team ${v > 0 ? "won" : v < 0 ? "lost" : "broke even"}${v ? ` ${Math.abs(v)}` : ""} on its bets`, v > 0 ? "ok" : v < 0 ? "no" : "mid"); })()
    : null;
  if (part === "pill") return heldNow ? null : <>{you}</>;
  if (heldNow) return <WatchTv />;
  const P = part === "rest" ? null : you;
  const name = (t: 0 | 1) => <b style={{ color: tc(t) }}>{T[t].name}</b>;
  /* the outcome: a big headline, no box (boxes are for things you can tap) */
  const head = (t: 0 | 1 | null | undefined, text: string, sub?: string) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      <div className="display text-32 leading-tight" style={{ color: t == null ? "var(--color-ink-2)" : tc(t) }}>{text}</div>
      {t != null && mine != null && <div className="text-13 font-bold" style={{ color: t === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{t === mine ? "That's your team!" : "Not this time."}</div>}
      {sub && <div className="text-13 text-[var(--color-ink-2)]">{sub}</div>}
    </div>);
  /* the mini-game's own score, big: TEAM A 3 – 4 TEAM B (the same board as the TV's) */
  const board = (w: Two<number>, label: string, win: 0 | 1 | null) => <ScoreBoard pub={pub} w={w} win={win} label={label} size="phone" />;
  /* a game's (or a round's) result, as the 3-8 night's (the owner's pick, 1 Nov): your team in a pill, who won in one
     line, then the two teams' standings: the game's score, and what it adds to the night (or the night's total) */
  const standings = (o: { title: string; text: string; w: 0 | 1 | null; vals: Two<string | number>; col: string; endCol?: string;
    end?: (t: 0 | 1) => React.ReactNode; note?: string | null; you?: [string, Tone] | null }) => (<>
    {o.you && pill(o.you[0], o.you[1])}
    <TitleLine eyebrow={o.title} text={o.text} color={o.w == null ? "var(--color-gold)" : tc(o.w)} />
    <ResultTable big head={[o.col, o.endCol]} rows={(o.w === 1 ? [1, 0] as const : [0, 1] as const).map((t) => row(t, String(o.vals[t]), null, o.end?.(t)))} />
    {o.note && <div className="text-13 text-center" style={{ color: "var(--color-gold)" }}>{o.note}</div>}
  </>);
  const won3 = (w: 0 | 1 | null, aw: number | undefined, what: string): [string, Tone] | null => mine == null ? null
    : w == null ? [aw ? `A tie: +${aw} each` : `A tie`, aw ? "ok" : "mid"] : w === mine ? [`Your team wins ${what} · +${aw ?? 0}`, "ok"] : ["Not this time", "no"];
  if (sc === "answer" && pub.result) {
    const Rr = pub.result, by = Rr.by;
    const quiet = ([0, 1] as const).filter((t) => silent(pub, t)).map((t) => `${T[t].name}: ${silent(pub, t)}`).join(" · ");
    const top = P;
    if (headOnly) return <>{top}</>;
    /* a row for each team that answered: the team asked, then the steal */
    /* (the host: Change in each row, which flips the call, as the list under it used to) */
    const rows = (pub.calls || []).map((c) => row(c.team, c.text || "No answer", c.text && !c.skipped ? c.ok : null, <Pts n={by === c.team && c.ok ? Rr.pts : 0} />,
      /* (wraps under the answer on a narrow phone: on a 360-wide one it ran over the points, 11 Nov) */
      host && act ? <span className="flex flex-wrap items-center gap-x-2">{c.note && <span>{c.note}</span>}{c.changed && <span style={{ color: "var(--color-gold)" }}>host&rsquo;s call</span>}
        <button type="button" className="text-13 font-bold underline underline-offset-4 min-h-[32px]" style={{ color: "var(--color-ink-2)" }} onClick={() => act({ type: "ui/flip", id: c.id })}>Change</button></span> : c.note));
    return (<>{top}{rows.length > 0 && <ResultTable rows={rows} head={["Said", "Pts"]} />}
      {quiet && <p className="text-center text-13 text-[var(--color-ink-3)]">{quiet}</p>}</>);
  }
  if (sc === "roundScore") { const rp = pub.roundPts ?? [0, 0], w = rp[0] === rp[1] ? null : rp[0] > rp[1] ? 0 : 1;
    return standings({ title: `Round ${pub.r + 1}`, text: w == null ? "A tied round" : `${T[w].name} win the round`, w,
      vals: [`+${rp[0]}`, `+${rp[1]}`], col: "This round", endCol: "Total", end: (t) => <span>{T[t].score}</span>,
      you: mine == null ? null : w == null ? ["A tied round", "mid"] : w === mine ? ["Your team wins the round", "ok"] : ["Not this round", "no"] }); }
  if (sc === "closestReveal" && pub.reveal) { const w = pub.reveal.w, ans = Number(pub.reveal.answer); return (<>
    {P}
    <ResultTable head={["Guess", "Leg"]} rows={([0, 1] as const).map((t) => { const g = pub.reveal?.guesses?.[t]; const o = g == null ? 0 : offBy(g, ans);
      return row(t, g == null ? "No answer" : showNum(g), null, leg(t, w), g == null ? undefined : o === 0 ? "Spot on!" : `Off by ${showNum(o)}`); })} />
    {pub.reveal.notes && <div className="text-13 text-[var(--color-ink-3)] text-center">{pub.reveal.notes}</div>}</>); }
  if (sc === "majorityReveal" && pub.majority?.reveal) { const M = pub.majority, R = M.reveal!; return (<>
    {P}
    <ResultTable head={["Right"]} rows={([0, 1] as const).map((t) => row(t, `${R.right[t]} of ${M.n?.[t] ?? 0}`, null))} />
    {pub.mrFire && <p className="text-center text-15 font-bold">{pub.mrFire.map((f) => <span key={f.name} className="mx-2"><span className="flame">🔥</span>{f.name} · {f.n} in a row</span>)}</p>}
    {/* (the game so far is in the bar at the top: no second line saying it again, the owner, 1 Nov) */}</>); }
  if (sc === "pinReveal" && pub.pin?.reveal) { const R = pub.pin.reveal, w = pub.reveal?.w; return (<>
    {P}
    <ResultTable head={["Off by", "Leg"]} rows={([0, 1] as const).map((t) => row(t, R.pins[t] ? showKm(R.km[t] ?? 0) : "No pin", null, leg(t, w)))} /></>); }
  if ((sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal" || sc === "airportReveal") && pub.reveal) {
    const say = sc === "sayReveal", w = pub.reveal.w;
    const ok = (t: 0 | 1) => sc === "mapReveal" ? pub.map?.ruled?.[t] : pub.reveal?.ok?.[t];
    const top = P;
    if (headOnly) return <>{top}</>;
    return (<>
      {top}
      <ResultTable head={["Said", "Leg"]} rows={([0, 1] as const).map((t) => { const v = ok(t), x = pub.reveal?.typed?.[t]?.[0];
        return row(t, x ?? (say ? "Nothing" : "No answer"), x ? v : null, leg(t, w),
          v == null && x ? "Waiting for a ruling" : say && x && !v ? (pub.reveal?.offList?.[t] ? "Not on the list" : "Said it") : undefined); })} /></>);
  }
  if (sc === "rouletteReveal" && pub.reveal && pub.roulette?.rev) { const R = pub.roulette.rev, D = pub.roulette.draw;
    if (headOnly) return <>{P}</>;
    return (<>{P}
      <ResultTable head={["Said", "Pts"]} rows={([0, 1] as const).map((t) => { const v = pub.reveal?.ok?.[t], x = pub.reveal?.typed?.[t]?.[0];
        return row(t, x ?? "No answer", x ? v : null, <Pts n={R.got[t]} />, `${D[t]?.theme} · ${rrLevelWord(R.level[t])}${v ? "" : ` · ${R.answer[t]}`}`); })} /></>); }
  if (sc === "stakesReveal" && pub.stakes?.rev) return <>{P}</>;
  if (sc === "stakesSummary" && pub.stakes?.sum) return (<>{P}
    <TitleLine eyebrow="Secret Stakes" text="The bets are settled" color="var(--color-gold)" />
    <StakesPhone sk={pub.stakes} screen="stakesSummary" teams={rr2(pub)} me={mine ?? null} /></>);
  if (sc === "dishReveal" && pub.reveal) { const w = legW(pub.reveal.w);
    return mine == null ? head(w, w != null ? `${T[w].name} got it` : "Nobody got it") : <>{P}</>; }
  if (sc === "auctionLeg" && pub.auction?.last) { const L = pub.auction.last; return (<>
    {/* one headline (who takes the leg); the how, small; the legs, as a board */}
    <div className="text-center flex flex-col items-center gap-2" role="status" aria-live="polite">
      <span className={"verdict text-13 " + (L.made ? "pos" : "neg")}>{L.made ? "Delivered" : "Short"}</span>
      <div className="display text-32 leading-none" style={{ color: tc(L.won) }}>{T[L.won].name} take the leg</div>
      <div className="text-14 text-[var(--color-ink-2)]">{name(L.by)} bid {L.bid}, named {L.count}.</div>
      {mine != null && <div className="text-13 font-bold" style={{ color: L.won === mine ? "var(--color-ok)" : "var(--color-ink-3)" }}>{L.won === mine ? "That's your team!" : "Not this time."}</div>}
    </div>
    {board(pub.auction.wins, "Legs so far", null)}</>); }
  if (sc === "auctionResult" && pub.auction) { const A = pub.auction, w = A.winner ?? null, aw = w != null ? A.award?.[w] ?? m?.pts : A.award?.[0];
    return standings({ title: "The Auction", text: w == null ? "A tie" : `${T[w].name} +${aw}`, w, vals: A.wins, col: "Legs", endCol: "Night",
      end: (t) => <Pts n={A.award?.[t]} />, you: won3(w, aw, "the Auction") }); }
  if (/Summary$/.test(sc) && sc !== "battleSummary" && pub.summary) { const S = pub.summary, w = S.winner, aw = w != null ? S.award?.[w] ?? m?.pts : S.award?.[0];
    return standings({ title: m?.title ?? "Result", text: S.needsHost ? "Still a tie" : w == null ? "A split" : `${T[w].name} +${aw}`, w,
      vals: S.wins.map((v) => (m?.pct ? `${v}%` : v)) as Two<string | number>, col: m?.pct ? "Right" : "Legs", endCol: "Night", end: (t) => <Pts n={S.award?.[t]} />,
      note: S.needsHost ? "The host decides." : S.who, you: S.needsHost ? (mine == null ? null : ["Still a tie: the host decides", "mid"]) : won3(w, aw, m?.title ?? "it") }); }
  if (sc === "battleSummary" && pub.battle) { const B = pub.battle, w = B.winner ?? null, aw = w != null ? B.award?.[w] ?? m?.pts : B.award?.[0];
    return standings({ title: "Battle of the Captains", text: w == null ? (B.note || "A tie") : `${T[w].name} +${aw}`, w, vals: B.score, col: "Right", endCol: "Night",
      end: (t) => <Pts n={B.award?.[t]} />, note: B.predict, you: won3(w, aw, "the Battle") }); }
  /* the night's end (the owner, 1 Nov): the winner clear at the top, how your team did, then the two teams' points */
  if (sc === "final") { const w = pub.winner ?? null; return (<>
    <WinnerCard eyebrow={w == null ? "The night ends" : "The winner"} name={w == null ? "A draw" : T[w].name} color={tc(w)} sub={w != null ? `${T[w].score} points` : `${T[0].score} each`} />
    {mine != null && <YouPill text={w == null ? "A draw" : w === mine ? "You won the night!" : "Not tonight"} tone={w === mine ? "ok" : w == null ? "mid" : "no"} />}
    <ResultTable big places head={["Points"]} rows={(w === 1 ? [1, 0] as const : [0, 1] as const).map((t) => ({ ...row(t, String(T[t].score), null), place: w == null || w === t ? 1 : 2 }))} />
    {/* the night's awards, as the TV shows them (30 Oct: they took the nutshell's place) */}
    <AwardList awards={(pub.recap?.awards || []).map((a) => ({ ...a, color: a.team != null ? tc(a.team) : undefined }))} />
  </>); }
  return null;
}

/* what's on screen, close up: the question, the flag or the ingredients.
   It can't be selected or copied (no pasting it into a chatbot), and while
   the clock is paused it's hidden. */
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
/* counting: this phone counts the Auction's names, and shows its own count */
/* side: on a phone held sideways, the question, the flag, the photo, the recipe and the clock go to the left column
   (components/Side; upright nothing moves) */
function OnScreen({ pub, counting, small, side, mine, captain }: { pub: Pub; counting?: boolean; small?: boolean; side?: boolean; mine?: 0 | 1 | null; captain?: boolean }) {
  const spun = useSpun(pub.roulette?.spinAt);
  if (pub.paused && pub.agree?.kind === "swap") return <div className="text-center py-8" role="status"><div className="display text-40" style={{ color: "var(--color-gold)" }}>A new {pub.agree.what}?</div><p className="text-14 text-[var(--color-ink-2)] mt-1">The clock is stopped while {pub.teams[pub.agree.team === 0 ? 1 : 0].name}&rsquo;s captain decides.</p></div>;
  if (pub.paused) return <div className="text-center py-8" role="status"><div className="display text-40" style={{ color: "var(--color-gold)" }}>Paused</div><p className="text-14 text-[var(--color-ink-2)] mt-1">{pub.pausedBy ? <><bdi>{pub.pausedBy}</bdi> paused it. </> : null}The question comes back when the clock restarts.</p></div>;
  return (<div className="noselect contents" {...noCopy}>
    {pub.screen === "sudden" && !pub.sudden?.ready && <SuddenRules pub={pub} size="phone" />}
    {pub.question && ["ask", "steal", "answer", "sudden", "miniQ", "closestReveal", "sayQ", "sayReveal", "majorityQ", "majorityReveal", "battleQ", "battleTie"].includes(pub.screen) && <ToSide when={side} order={3} className="noselect" {...noCopy}><p className={(/Reveal$|^answer$/.test(pub.screen) ? "text-15 text-[var(--color-ink-2)]" : qCls(pub.question, 20)) + " leading-snug text-center"}>{pub.question}</p></ToSide>}
    {pub.screen === "majorityReveal" && pub.majority?.reveal && <div className="display text-30 text-center" style={{ color: "var(--color-gold)" }}>{pub.majority.reveal.answer}</div>}
    {/* the fact behind it, right under the answer */}
    {pub.screen === "majorityReveal" && pub.majority?.reveal?.notes && <p className="text-14 text-[var(--color-ink-2)] text-center leading-snug -mt-1">{pub.majority.reveal.notes}</p>}
    {(pub.screen === "flagQ" || pub.screen === "flagReveal") && <ToSide when={side} order={4} className="noselect" {...noCopy}><FlagImg name={pub.flag} h={small ? 96 : 150} /></ToSide>}
    {pub.screen === "pinQ" && <ToSide when={side} order={4} className="noselect" {...noCopy}>{small
      /* the captain's phone: the photo beside the clock, so the map gets the room */
      ? <div className="flex items-center justify-center gap-4 pin-row"><PinPhoto pin={pub.pin} h={112} small zoom /><span className="main-clock"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={64} /></span></div>
      : <PinPhoto pin={pub.pin} h={230} small zoom />}</ToSide>}
    {pub.screen === "pinReveal" && pub.pin?.reveal && <PinMap marks={pinMarks(pub)} fly height={small ? 220 : 300} label={`Where it is: ${pub.pin.reveal.place}`} />}
    {pub.screen === "pinReveal" && pub.pin?.reveal && <div className="text-center"><div className="display text-30" style={{ color: "var(--color-gold)" }}>{pub.pin.reveal.name}</div>
      <div className="text-14 text-[var(--color-ink-2)] mt-1">{pub.pin.reveal.place}</div></div>}
    {(pub.screen === "airportQ" || pub.screen === "airportReveal") && <Board air={pub.airport} size={small ? "small" : "phone"} />}
    {pub.screen === "rouletteQ" && pub.roulette && <ToSide when={side} order={3} className="noselect" {...noCopy}><RrPhone rr={pub.roulette} me={mine ?? null} teams={rr2(pub)} host={mine == null} /></ToSide>}
    {pub.screen === "rouletteReveal" && pub.roulette && <RrPhoneReveal rr={pub.roulette} me={mine ?? null} teams={rr2(pub)} />}
    {/* Secret Stakes: the themes (a captain's own buttons are below), your team's question, the reveal */}
    {/^stakes(Pick|Q|Reveal)$/.test(pub.screen) && pub.stakes && <ToSide when={side && pub.screen === "stakesQ"} order={3} className="noselect" {...noCopy}>
      <StakesPhone sk={pub.stakes} screen={pub.screen} teams={rr2(pub)} me={mine ?? null} cap={captain} /></ToSide>}
    {pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={small ? 170 : 260} title={pub.map.title} />}
    {pub.map?.reveal && <div className="display text-26 text-center" style={{ color: "var(--color-gold)" }}>{pub.map.title}</div>}
    {pub.auction && pub.screen === "auctionLeg" && <p className="text-center text-14 text-[var(--color-ink-2)]"><span className="eyebrow mr-2">Leg {pub.auction.wins[0] + pub.auction.wins[1]}</span>{pub.auction.cat}</p>}
    {pub.auction && /^auction(Bid|Run)$/.test(pub.screen) && <div className="text-center"><div className="eyebrow">Category</div><div className="display text-28" style={{ color: "var(--color-gold)" }}>{pub.auction.cat}</div>
      {pub.screen === "auctionBid" && <BidBoard pub={pub} />}
      {pub.screen === "auctionRun" && !counting && <div className="display text-44 mt-1"><LiveN A={pub.auction} /> / {pub.auction.bid}</div>}
      {pub.screen === "auctionRun" && pub.auction.countedBy && <div className="text-13 text-[var(--color-ink-2)] mt-1">Counted by <b>{pub.auction.countedBy}</b></div>}</div>}
    {(pub.screen === "dishQ" || pub.screen === "dishReveal") && pub.dish && <ToSide when={side} order={4} className="noselect" {...noCopy}><div className="card"><div className="eyebrow mb-2">Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div><Ings ings={pub.dish.ings} /></div></ToSide>}
    {pub.reveal && /Reveal$/.test(pub.screen) && !["mapReveal", "sayReveal", "pinReveal", "rouletteReveal"].includes(pub.screen) && <div className="display text-30 text-center" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div>}
    {pub.screen === "airportReveal" && pub.airport?.code && <p className="text-center text-14 text-[var(--color-ink-2)] -mt-1"><b className="text-[var(--color-ink)]">{pub.airport.code}</b> · {pub.airport.city}{pub.airport.cityOk === false && <span className="block mt-1 text-13 font-bold" style={{ color: "var(--color-gold)" }}>{pub.airport.city} alone doesn&rsquo;t count: it has more than one big airport.</span>}{pub.reveal?.notes ? <span className="block mt-1 text-13">{pub.reveal.notes}</span> : null}</p>}
    {pub.reveal && pub.screen === "sayReveal" && <div className="text-center"><div className="eyebrow">The app&rsquo;s word</div><div className="display text-30" style={{ color: "var(--color-gold)" }}>{pub.reveal.answer}</div></div>}
    {pub.screen === "answer" && pub.result && <div className="display text-32 text-center" style={{ color: "var(--color-gold)" }}>{pub.result.answer}</div>}
    {(["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "majorityQ", "stakesPick", "stakesQ", "battleQ"].includes(pub.screen) || (pub.screen === "rouletteQ" && spun)
      /* sudden death and the tie-breaker: their clock (with no host; a host's has none) */
      || (RACE(pub) && (!!pub.deadline || (pub.left ?? 0) > 0))) && !(small && pub.screen === "pinQ") && !(pub.screen === "dishQ" && pub.dish?.typeBy) && <ToSide when={side && pub.screen !== "miniQ"} order={9} className="side-clock"><div className={"grid place-items-center main-clock" + (pub.screen === "miniQ" ? " clock-last" : "")}><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "dishQ" || pub.screen === "airportQ" || pub.screen === "mapQ" || small ? 64 : pub.screen === "ask" || pub.screen === "steal" ? 72 : 90} /></div></ToSide>}
    {/* the Battle: the last answer, once there's no new question to read (during the questions it's on the TV only) */}
    {pub.battle?.half?.length && pub.screen === "battleHandoff" ? <BattleHalf half={pub.battle.half} />
      : pub.battle?.last && /^battle(Handoff|Summary)$/.test(pub.screen) && <BattleAnswer last={pub.battle.last} />}
  </div>);
}

/* the Battle at halfway: every one of the first captain's answers, the right one beside each miss */
/* (3 Nov, the owner: no RIGHT/WRONG word, which ran off a phone's edge: the captain's answer in green or red, with a
   small tick or cross in front for anyone who can't tell the two apart, and the right answer after a wrong one, in
   grey. Long ones wrap, nothing is cut) */
export function BattleHalf({ half, size = 14, cols = 1 }: { half: NonNullable<NonNullable<Pub["battle"]>["half"]>; size?: number; cols?: number }) {
  return (
    <div className="grid grid-flow-col gap-x-14 gap-y-1.5 w-full" style={{ fontSize: size, gridTemplateRows: `repeat(${Math.ceil(half.length / cols)}, auto)`, gridAutoColumns: "minmax(0, 1fr)" }}>
      {half.map((e, i) => { const c = e.got === true ? "var(--color-ok)" : e.got === false ? "var(--color-no)" : "var(--color-ink-2)"; return (
        <div key={i} className="flex items-baseline gap-2 text-left min-w-0">
          <span className="text-[var(--color-ink-3)] shrink-0 tabular-nums" style={{ width: size * 1.6 }}>{i + 1}</span>
          <span className="flex-1 min-w-0 break-words leading-snug">
            <span className="font-bold" style={{ color: c }}>
              {e.got != null && <span aria-label={e.got ? "right:" : "wrong:"} className="mr-1">{e.got ? "\u2713" : "\u2717"}</span>}
              {/* (said aloud, with a host, nothing was typed: the answer itself when right, "Missed" when not) */}
              {e.said || (e.got && e.answer) || (e.got === false ? "Missed" : <span className="font-normal text-[var(--color-ink-3)]">No answer</span>)}</span>
            {!e.got && e.answer && <span className="text-[var(--color-ink-3)]"> · {e.answer}</span>}</span>
        </div>); })}
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
  const noTv = useNoTv();
  if (pub.screen === "roundIntro") return <RoundIntro pub={pub} size="phone" canArm={canArm} onArm={onArm} busy={busy} />;
  if (pub.screen === "ask" || pub.screen === "steal") return <AskHead pub={pub} size="phone" you={youLine(pub, me, capName)} go={pub.turn === me.team && !pub.lifeline && !pub.pending} />;
  if (/Intro$/.test(pub.screen) && pub.mini) return <MiniIntro pub={pub} size="phone" />;
  if (RESULT.test(pub.screen)) return null;            // the result says it
  /* on a question, the question (or flag, or map) is the thing to look at: the instruction steps back */
  const quiet = QUIET.includes(pub.screen) && !pub.paused;
  /* your move now (gold) or stay out of it (grey), so "Type it fast!" and "Not a word!" can't be mixed up (3 Nov) */
  const tone = statusTone(pub, me);
  return <p className={"text-center leading-snug " + (quiet ? "text-14 font-semibold text-[var(--color-ink-3)]" : "font-bold text-18")} role="status" aria-live="polite"
    style={!quiet && tone ? { color: tone === "go" ? "var(--color-gold)" : "var(--color-ink-3)" } : undefined}>{status(pub, me, noTv)}</p>;
}
function statusTone(pub: Pub, me: Member): "go" | "hush" | null {
  const mine = me.team, cap = me.role === "captain", sc = pub.screen;
  if (pub.lifeline || pub.paused) return null;
  if (sc === "battleQ") return cap && pub.battle?.cap === mine ? "go" : "hush";
  if (sc === "battleTie" || sc === "sudden") return cap ? "go" : "hush";
  if (sc === "dishQ" && cap && pub.buzz === mine && !pub.sent?.[mine as 0 | 1]) return "go";
  return null;
}

const QUIET = ["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ", "rouletteQ", "stakesQ"];
/* Russian Roulette: the two teams as the barrel draws them (their colour and letter) */
const rr2 = (pub: Pub): RrTeam[] => [0, 1].map((t) => ({ name: pub.teams[t].name, color: `var(--color-${t ? "b" : "a"})`, letter: "AB"[t] }));
/* a phone held sideways: on these, the top line (the question's title, or what to do) goes to the left column too */
const SIDE_Q = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ", "rouletteQ", "stakesQ", "battleQ"];
function status(pub: Pub, me: Member, noTv = false) {
  const T = pub.teams, mine = me.team as 0 | 1, cap = me.role === "captain";
  if (pub.lifeline) return pub.lifeline.team === mine ? (pub.lifeline.key === "friend" ? "Your team is calling a friend" : "Double Dip: two answers") : `${T[pub.lifeline.team].name} used a lifeline`;
  if (TIE_SCREENS.includes(pub.screen)) return `${tieHead(pub)}. ${tieCall(pub)}`;
  if (pub.screen === DECIDED) return `${decidedHead(pub)} ${decidedCall(pub)}`;
  switch (pub.screen) {
    case "ask": return pub.turn === mine ? (cap ? "Your question. Type your answer." : "Your team's question. Help your captain!") : `${T[pub.turn ?? 0].name} are answering. Get ready to steal.`;
    case "steal": return pub.turn === mine ? (cap ? "Steal! Type your answer." : "Steal! Help your captain.") : `${T[pub.turn ?? 0].name} can steal it`;
    case "answer": return pub.result?.by == null ? "Nobody scored" : pub.result.by === mine ? `+${pub.result.pts} to your team!` : `${T[pub.result.by].name} scored`;
    case "roundIntro": return `Round ${pub.r + 1}: ${pub.theme}`;
    case "roundScore": return `End of round ${pub.r + 1}`;
    case "sudden": return !pub.sudden?.ready ? "Sudden death: you're tied" : cap ? (pub.out?.[mine] ? "Wrong. You're out of this one." : pub.sent?.[mine] ? `Answer sent. ${pub.mode === "nohost" ? "The app checks it." : "The host decides."}` : "Type it and send it. First right answer wins!") : "Sudden death: captains only. Not a word!";
    case "miniQ": return cap ? "Type a number. Nearest wins." : "Closest To Wins: help your captain";
    case "flagQ": return cap ? "Which country?" : "Guess the Flag: help your captain";
    case "pinQ": return cap ? "Where is it? Drop your pin, then lock it in." : "Drop the Pin: help your captain";
    case "airportQ": return cap ? "Which airport?" : "Guess the Airport: help your captain";
    case "rouletteQ": return cap ? "Your chamber's question. Type your answer." : "Russian Roulette: help your captain";
    case "stakesPick": return cap ? (pub.stakes?.locked[mine] ? "Bet locked in. Waiting for the others." : "Place your bet: a theme, then a level") : "Secret Stakes: your captain bets";
    case "stakesQ": return cap ? "The question you bet on. Type your answer." : "Secret Stakes: help your captain";
    case "stakesReveal": return "The reveal: from last place up";
    case "rouletteReveal": return pub.roulette?.rev && pub.roulette.rev.hit >= 0 ? `BANG! ${T[pub.roulette.rev.hit].name} drew the bullet` : pub.roulette?.rev && pub.roulette.rev.bullet < 0 ? "Tie-breaker: no bullet in this one." : "Nobody drew the bullet this time.";
    case "majorityQ": return "Your own answer: eyes on your phone, no talking";
    case "dishQ": return pub.buzz === mine ? (pub.sent?.[mine] ? `Answer sent. ${pub.mode === "nohost" ? "The app checks it." : "The host decides."}` : cap ? "You buzzed! Type it, quick." : "Your captain buzzed!") : pub.buzz != null ? `${T[pub.buzz].name} buzzed` : pub.out?.[mine] ? (pub.dish?.late === mine ? "Time's up. You're out of this one." : "You're out of this one") : cap ? "Know it? BUZZ!" : "Guess the Cocktail or Dish: help your captain";
    case "sayQ": return cap ? "Type an answer the app won't think of" : "Don't Say the Same as Me: help your captain";
    case "sayReveal": return pub.reveal?.ok?.[mine] ? "You dodged the app's word" : "You said the app's word";
    /* Team A's captain plays the first half, then Team B's: the one who's finished isn't "next" */
    case "battleQ": return pub.battle?.cap === mine ? (cap ? (pub.mode === "nohost" ? "Your question. Type it fast!" : "Your question. Say it out loud!") : "Your captain's battle. Not a word!")
      : cap ? (mine === 0 ? `Your half is done. ${poss(T[1].name)} captain now. Stay quiet.` : "Your turn is next. Stay quiet.") : "Captains only. Not a word!";
    case "battleHandoff": return `${poss(T[1].name)} captain is next`;
    case "battleTie": return cap ? (pub.out?.[mine] ? "Wrong. You're out of this one." : pub.sent?.[mine] ? `Answer sent. ${pub.mode === "nohost" ? "The app checks it." : "The host decides."}` : "Tie-breaker: type it and send it. First right answer takes it!") : "Captains only. Not a word!";
    case "mapQ": return cap ? "What does the map show?" : "Guess the Map: help your captain";
    case "mapReveal": return noTv ? "The answer" : "The answer's on the TV";
    case "auctionBid": return pub.auction?.turn === mine ? (cap ? "Your bid: raise, or pass" : "Your captain is bidding") : `${T[pub.auction?.turn ?? 0].name} are bidding`;
    case "auctionRun": return pub.auction?.by === mine ? (cap ? `Name ${pub.auction?.bid}! Out loud!` : `Name ${pub.auction?.bid}! Out loud!`) : `${T[pub.auction?.by ?? 0].name} have to name ${pub.auction?.bid}`;
    default: return pub.mini ? pub.mini.title : noTv ? "Get ready" : "Eyes on the TV";
  }
}

/* A PLAYER's phone: what's on screen, the scores, and a box to suggest an
   answer to the captain. Players never answer directly. */
export function PlayerGame({ pub, me, members, code }: { pub: Pub; me: Member; members: Member[]; code: string }) {
  const noTv = useNoTv();
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
      <ToSide order={2} when={SIDE_Q.includes(pub.screen) && !pub.paused}><Head pub={pub} me={me} capName={cap?.name} /></ToSide>
      <Result pub={pub} mine={mine} part="pill" />
      <OnScreen pub={pub} side mine={mine} />
      {/^majority(Q|Reveal)$/.test(pub.screen) && <MajorityPad pub={pub} me={me} code={code} />}
      <Result pub={pub} mine={mine} part="rest" />
      {pub.screen === "final" && <Line className="!text-13">{pub.mode === "nohost" ? "A captain chooses" : "The host chooses"}: play again with the same teams, or end the night.</Line>}
      {/* the Battle's twenty calls, read-only, on every phone (the 4 Nov audit, 3.12: players only saw "Waiting for…") */}
      {pub.screen === "battleReview" && <Calls pub={pub} act={() => {}} />}
      <WaitingForHost pub={pub} members={members} />
      {canSuggest && (
        <div className="card flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="sug">Suggest to {cap?.name || "your captain"}</label>
          <div className="flex gap-2">
            <input id="sug" {...np.props} className="input" value={text} maxLength={80} inputMode={pub.screen === "miniQ" ? "decimal" : "text"} placeholder={pub.screen === "miniQ" ? "A number" : "Your answer"} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
            <button className="btn" disabled={!text.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => void suggest()}>Send</button>
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
          <p className="text-12 text-[var(--color-ink-3)] text-center">{noTv ? "The game\u2019s" : "The TV\u2019s"} count is the one that counts: {pub.auction?.count ?? 0} so far.</p>
        </div>)}
      {/* (not while paused: just "Paused", 11 Nov, the owner) */}
      {pub.screen === "ask" && !pub.paused && <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" />}
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
  rouletteIntro: ["Spin", "roulette/start"], rouletteReveal: ["Next", "ui/next"], rouletteSummary: ["Next", "roulette/done"],
  stakesIntro: ["Start", "stakes/start"], stakesReveal: ["Next", "ui/next"], stakesSummary: ["Next", "stakes/done"],
  majorityIntro: ["Start: everyone's in", "majority/start"], majorityReveal: ["Next question", "ui/next"], majoritySummary: ["Next", "majority/done"],
  answer: ["Next", "round/afterAnswer"], roundScore: ["Next", "round/next"], closestReveal: ["Next", "ui/next"], flagReveal: ["Next", "ui/next"],
  dishReveal: ["Next", "dish/next"], auctionLeg: ["Next", "auction/nextLeg"], auctionResult: ["Next", "auction/done"], battleReview: ["Settle the Battle", "battle/reviewDone"],
  miniSummary: ["Next", "closest/done"], flagSummary: ["Next", "flag/done"], dishSummary: ["Next", "dish/done"], mapSummary: ["Next", "map/done"],
};
/* no host: whose tap the room is waiting for */
function WaitingFor({ pub }: { pub: Pub }) {
  const label = pub.screen === "sudden" ? "Start" : NEXT_LABEL[pub.screen]?.[0] || "Next";
  const open = useAfter(pub.nextOpenAt), auto = useSecondsLeft(pub.autoAt);
  const tie = TIE_SCREENS.includes(pub.screen), decided = pub.screen === DECIDED;
  if (pub.autoAt && auto > 0) return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">{
    tie ? `${pub.screen === "battleLevel" ? "The points are shared" : "A point each"} in ${auto} s, unless a captain picks one more.`
    : decided ? `Playing on for fun in ${auto} s, unless a captain stops here.` : `Next in ${auto} s, or ${pub.nextBy} taps Next.`}</p>;
  const who = tie || decided ? "a captain" : open && pub.nextOther ? `${pub.nextBy} or ${pub.nextOther}` : pub.nextBy;
  return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Waiting for {who} to {TIE_SCREENS.includes(pub.screen) ? "choose: one more, or a point each" : pub.screen === DECIDED ? "choose: keep playing for fun, or stop here" : `tap ${/^Start/.test(label) ? "Start" : label}`}.</p>;
}
/* (the other team's lifelines were a line of text here; they're now the TV's own tiles, read only, so the phone and
   the TV show them the same way: 11 Nov, the owner) */
/* with a host: the screens that wait for the host's tap say so on the other phones, as with no host (the 4 Nov audit, 3.9) */
function WaitingForHost({ pub, members }: { pub: Pub; members: Member[] }) {
  const h = members.find((m) => m.role === "host");
  if (pub.mode === "nohost" || !h || !WAITS_FOR_NEXT.has(pub.screen) || pub.screen === "final" || (pub.screen === "sudden" && pub.sudden?.ready)) return null;
  return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Waiting for <bdi>{h.name}</bdi> to move the night on.</p>;
}
/* the screens a clock runs on, and so the ones a Pause makes sense on */
/* where the app's calls are listed, and can be contested */
const CALL_SCREENS = ["answer", "flagReveal", "sayReveal", "mapReveal", "airportReveal", "rouletteReveal", "stakesReveal", "dishReveal", "battleReview"];
/* ...and sudden death / the tie-breaker: the question just decided, on the screen after it */
const SD_CALL_SCREENS = ["battleSummary", "sudden", "battleTie"];
/* no host: the screens where both captains can agree to a new one, and what it's called */
const SWAP_WORDS: Record<string, string> = { ask: "question", miniQ: "question", flagQ: "flag", pinQ: "landmark", airportQ: "board", majorityQ: "question", dishQ: "dish", mapQ: "map", sayQ: "prompt", rouletteQ: "barrel", stakesPick: "themes", stakesQ: "themes", battleQ: "question" };
const PAUSABLE = ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "majorityQ", "rouletteQ", "stakesPick", "stakesQ", "battleQ"];

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
        ? <p className="text-15"><b style={{ color: tc(A.team) }}>{T[A.team].name}</b>&rsquo;s captain wants a new {A.what}, just as hard.
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
  const noTv = useNoTv();
  const mine = me.team as 0 | 1, T = pub.teams, sc = pub.screen, nohost = pub.mode === "nohost";
  const theirs = (mine === 0 ? 1 : 0) as 0 | 1;
  const [a, setA] = useState(""), [b, setB] = useState(""), [sending, setBusy] = useState(false), [sentTxt, setSentTxt] = useState<string | null>(null);
  const [bid, setBid] = useState("");
  const [pinAt, setPinAt] = useState<LatLon | null>(null);   // Drop the Pin: where this captain's pin is
  const rrSpun = useSpun(pub.roulette?.spinAt);              // Russian Roulette: the box opens once the barrel stops
  const [skTheme, setSkTheme] = useState<number | null>(null), [skLevel, setSkLevel] = useState<string | null>(null);   // Secret Stakes: the bet being made
  const skRound = `${pub.stakes?.round}|${pub.stakes?.themes?.join()}`;
  useEffect(() => { setSkTheme(null); setSkLevel(null); }, [skRound]);
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
    if (L.kind === "answer" && !mineIn) { setSentTxt(null); setNo(ack.no || (noTv ? "That answer didn't go through. Send it again." : "The TV didn't take that answer. Send it again.")); }
    else if (L.kind === "buzz" && pub.buzz !== mine && `${pub.qid}|${sc}` === L.q) { setBuzzed(false); setNo(ack.no || (noTv ? "That buzz didn't go through. Tap again." : "The TV didn't take the buzz. Tap again.")); }
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
  /* (time's up with a host: nothing more to type or use, the host rules on what's in: the 4 Nov audit, 1.15) */
  const canType = !pub.paused && ((myTurn && !locked && !pub.timeUp) || (sc === "miniQ" && !sentHere) || ((sc === "flagQ" || sc === "mapQ" || sc === "sayQ" || sc === "airportQ" || sc === "stakesQ" || (sc === "rouletteQ" && rrSpun)) && !sentHere)
    /* a buzz: one answer, and once it's sent the box closes (it stayed open, with its Send, and got sent twice: 20 Oct) */
    || (BUZZ_SCREENS.includes(sc) && pub.buzz === mine && !pub.pending && !sentHere)
    /* sudden death and the tie-breaker: both captains type at once, one answer each */
    || (RACE(pub) && !pub.out?.[mine] && !sentHere && !pub.contest)
    /* the Battle: typed with no host; with a host it's said out loud */
    || (sc === "battleQ" && nohost && pub.battle?.cap === mine && !locked));
  const canBuzz = sc === "dishQ" && pub.buzz == null && !pub.out?.[mine];
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
  /* (the Battle's review: either captain settles it, the owner's pick on the 4 Nov audit, decision 8) */
  /* (Russian Roulette: Next on a reveal spins the barrel again, so it says Spin) */
  const spinNext = sc === "rouletteReveal" && (pub.mini?.leg ?? 0) < (pub.mini?.of ?? 0);
  const next = nohost && (mayNext || sc === "battleReview") && pub.nextBy ? (spinNext ? ["Spin", "ui/next"] as [string, string] : NEXT_LABEL[sc]) : undefined;
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
      <ToSide order={2} when={SIDE_Q.includes(sc) && !pub.paused}><Head pub={pub} me={me} canArm={(t) => t === mine} onArm={() => void act("lifeline", { key: "dbl" })} busy={busy} /></ToSide>
      <Result pub={pub} mine={mine} part="pill" />
      <OnScreen pub={pub} counting={nohost && sc === "auctionRun" && A?.by === theirs} small={sc === "pinQ"} side mine={mine} captain />
      {/* Secret Stakes: your bet, a theme and a level, then Lock in */}
      {sc === "stakesPick" && pub.stakes && !pub.stakes.locked[mine] && !pub.paused && <StakesBet sk={pub.stakes} theme={skTheme} level={skLevel} setTheme={setSkTheme} setLevel={setSkLevel} busy={busy}
        onLock={() => { if (skTheme != null && skLevel) void nxt({ type: "stakes/pick", k: skTheme, level: skLevel }); }} />}
      {sc === "stakesPick" && pub.stakes?.locked[mine] && pub.stakes.picks?.[mine] && <p className="text-center font-bold text-16" role="status">Locked in: {skLevelWord(pub.stakes.picks[mine]!.level)} on {pub.stakes.themes[pub.stakes.picks[mine]!.k]}.</p>}
      {/^majority(Q|Reveal)$/.test(sc) && <MajorityPad pub={pub} me={me} code={code} />}
      <Result pub={pub} mine={mine} headOnly={CALL_SCREENS.includes(sc)} part="rest" />
      {/* the app's calls, each with a small Contest (the other captain, or the host, decides) */}
      {(CALL_SCREENS.includes(sc) || SD_CALL_SCREENS.includes(sc) || (nohost && sc === "final")) && <Calls pub={pub} mine={mine} busy={busy} act={(m) => void nxt(m)} />}


      {/* Call a Friend: the calling captain has the script and the call's clock; with no host they start it, with a host the
          host does (the owner's pick on the 4 Nov audit, 3.10) */}
      {pub.lifeline?.key === "friend" && pub.lifeline.team === mine && (
        <div className="card flex flex-col items-center gap-2 text-center">
          <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Your lifeline · Call a Friend</div>
          <p className="text-14 text-[var(--color-ink-2)]">Read this to your friend first: &ldquo;Hi, quick quiz question. No ChatGPT, no Google, no asking anyone else. Straight off the top of your head. Ready?&rdquo;</p>
          <Clock deadline={pub.lifeline.deadline} left={pub.lifeline.left} size={72} timeUp={!pub.lifeline.deadline && !pub.lifeline.left} />
          {pub.lifeline.wait && !nohost && <p className="text-13 text-[var(--color-ink-3)]">The host starts the {pub.timers?.friend ?? 30} seconds when you&rsquo;re through.</p>}
        </div>)}
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
          </div>
          <input id="ans" {...np.props} className="input" value={a} maxLength={80} autoComplete="off" autoCorrect="off" spellCheck={false}
            /* Closest: the number pad, fastest (the reader still takes "1.5 million" if a keyboard sends it) */
            inputMode={sc === "miniQ" ? "decimal" : "text"} enterKeyHint="send" placeholder={sc === "miniQ" ? "e.g. 236" : "Type it"} onChange={(e) => setA(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !dip && !busy && a.trim()) { e.preventDefault(); void send(); } }} />
          {sc === "miniQ" && a.trim() && (Number.isFinite(guess)
            ? ![String(guess), guess.toLocaleString("en-GB")].includes(a.trim()) && <div className="text-13 text-[var(--color-ink-2)]">Counts as <b>{guess.toLocaleString("en-GB")}{per ? ` ${per}` : ""}</b></div>
            : <p className="text-13 text-[var(--color-no)]" role="alert">That isn&rsquo;t a number.</p>)}
          {dip && <input {...np.props} className="input" aria-label="Your second answer" value={b} maxLength={80} placeholder="Second answer" onChange={(e) => setB(e.target.value)} />}
          {np.hint}
          <button className="btn btn-gold btn-lg" disabled={busy || !a.trim() || (sc === "miniQ" && !Number.isFinite(guess))} onPointerDown={(e) => e.preventDefault()} onClick={() => void send()}>{sc === "miniQ" ? "Lock in" : "Send"}</button>
          {["ask", "steal", "flagQ", "airportQ", "mapQ"].includes(sc) && <div className="text-13 text-[var(--color-ink-3)]">Once you send it, it&rsquo;s locked.</div>}
        </div>)}
      {canPin && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-13 text-[var(--color-ink-3)]">{pinAt ? "Tap anywhere to move your pin, or drag it. Zoom in (pinch, or +) to place it exactly, then Lock in." : "Tap the map to drop your pin. You can move it until you lock in."}</p>
          <PinMap value={pinAt} onChange={setPinAt} color={TEAM_HEX[mine]} height="min(520px, max(300px, calc(100dvh - 460px)))" />
          <button className="btn btn-gold btn-lg btn-block dock" disabled={busy || !pinAt} onClick={() => void sendPin()}>Lock in</button>
        </div>)}
      {!canType && sentHere && (["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ", "stakesQ"].includes(sc) || (myTurn && !pub.pending) || (BUZZ_SCREENS.includes(sc) && pub.buzz === mine && !pub.pending)) && (
        <p className="text-center font-bold text-16" role="status">Locked in{sentTxt && sc !== "pinQ" ? `: ${sentTxt}` : ""}.</p>)}
      {sc === "pinQ" && sentHere && pinAt && <PinMap value={pinAt} color={TEAM_HEX[mine]} height="min(40vh, 340px)" label="Your pin" />}

      {/* the lifelines: everyone sees them; the captain whose question it is taps */}
      {/* (the other team's: a line of text, not tiles that look tappable: 3.10) */}
      {sc === "ask" && !pub.paused && (pub.turn === mine ? <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" busy={busy}
        onUse={myTurn && !locked && !pub.timeUp ? (k) => void act("lifeline", { key: k }) : undefined} /> : <LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="phone" />)}

      {/* the Auction: bidding is always the captains' */}
      {sc === "auctionBid" && A && A.turn === mine && (
        <div className="card flex flex-col gap-2">
          <div className="eyebrow">{A.bid ? `Beat ${A.bid}, or pass` : "Open the bidding"}</div>
          <p className="text-13 text-[var(--color-ink-2)]">Whoever wins the bid has <b>{pub.timers?.auction ?? 30} seconds</b> to name them, out loud.</p>
          {/* a number typed in the box: its Bid is the big button, and +1 steps back (people typed 15, then tapped "Raise to 2") */}
          {A.bid < MAX_BID && <button className={"btn " + (bid ? "btn-sm self-start" : "btn-gold btn-lg")} disabled={busy} onClick={() => void nxt({ type: "auction/raise", n: A.bid + 1 })}>{A.bid ? `Raise to ${A.bid + 1}` : "Open at 1"}</button>}
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

      {/* a Know the Host answer, and the host gone 20 s: either captain can skip it (the owner's pick, 4 Nov audit, decision 7) */}
      {pub.skipHostQ && (sc === "ask" || sc === "steal") && (
        <div className="card flex flex-col gap-2 text-center">
          <p className="text-14">The host is away, and only they can rule on this one.</p>
          <button type="button" className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "ui/skipHostQ" })}>Skip it: no points</button>
        </div>)}
      {/* the end of the night, no host: either captain sends everyone home */}
      {/* what happens now, said (the 4 Nov audit, 3.14) */}
      {!nohost && sc === "final" && <Line className="!text-13">The host chooses: play again with the same teams, or end the night.</Line>}
      <WaitingForHost pub={pub} members={members} />
      {nohost && sc === "final" && (<>
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button className="btn btn-gold" disabled={busy} onClick={() => void nxt({ type: "ui/again" })}>Play again</button>
          <button className="btn btn-gold-line" disabled={busy} onClick={() => { void nxt({ type: "ui/exit" }); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
        </div>
        <p className="text-center text-13 text-[var(--color-ink-3)]">Play again: same teams. Exit takes every phone{noTv ? "" : " and the TV"} back to the home screen.</p>
      </>)}
      {/* no host, won with legs to spare, or level at the end of a mini-game: either captain picks, and if neither
          does in 10 s the night carries on (keep playing; a point each). The owner's pick on the 4 Nov audit, decision 8:
          the lead captain alone used to decide, and the other could only wait */}
      {nohost && sc === DECIDED && (
        <div className="flex flex-col gap-3 mt-auto dock-group">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "decided/stop" })}>Stop here</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "decided/more" })}>Keep playing for fun</button>
          <AutoPick at={pub.autoAt} what="Keep playing" />
        </div>)}
      {nohost && TIE_SCREENS.includes(sc) && (
        <div className="flex flex-col gap-3 mt-auto dock-group">
          <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/more" })}>One more</button>
          <button className="btn btn-lg" disabled={busy} onClick={() => void nxt({ type: "tie/stop" })}>{sc === "battleLevel" ? "Share the points" : "A point each"}</button>
          <AutoPick at={pub.autoAt} what="A point each" />
        </div>)}

      {/* no host: start, go and next — the lead captain (Team A's) */}
      {showNext && next && (
        <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: next[1] })}>{next[0]}</button>)}
      {nohost && mayNext && pub.nextBy && sc === "sudden" && !pub.sudden?.ready && <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={() => void nxt({ type: "sudden/go" })}>Start</button>}
      {pub.nextBy && !lead && open && <p className="text-center text-13 text-[var(--color-ink-3)]">{pub.nextBy} hasn&rsquo;t tapped it, so you can.</p>}
      {pub.nextBy && !lead && !open && sc !== DECIDED && !TIE_SCREENS.includes(sc) && sc !== "battleReview" && <WaitingFor pub={pub} />}
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

/* the default that happens if neither captain picks (no host: a tie, or a game won early) */
function AutoPick({ at, what }: { at?: number | null; what: string }) {
  const left = useSecondsLeft(at ?? undefined);
  if (!at || left <= 0) return null;
  return <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">{what} in {left} s if nobody picks.</p>;
}
