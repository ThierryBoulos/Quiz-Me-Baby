"use client";
/* MANY TEAMS: the phones, laid out as the two-team phones are (components/PhoneGame.tsx): the host's answer
   card on top and one main button docked at the bottom; a captain's answer box, the pin map, the four answers
   of Majority Rules; a result as a headline, then the rows. No score strip: the scores sit behind the Scores
   button in the header, and the tracker lights your team. */
import { useEffect, useMemo, useState } from "react";
import { Clock } from "../Clock";
import { Board, FlagImg, PinPhoto, RulingPicker, verdictWord } from "../GameParts";
import { MapView } from "../MapView";
import { PinMap } from "../PinMap";
import { sendAction, sendDraft, sb } from "@/lib/supabase";
import { poss, showKm, showNum, type LatLon } from "@/lib/game";
import { QMB } from "@/lib/engine";
import type { Member } from "@/lib/room";
import type { PubMany, SecretMany } from "@/lib/many/view";
import { LETTERS, typedKey } from "@/lib/many/logic";
import { useNoPaste, useSuggestions } from "../PhoneGame";
import { ToSide, useSideways } from "../Side";
import { Dot, IntroMany, paid, pct, place, resultDone, splitIng, takes, SAY_WHY } from "./PartsMany";
import { ComebackIntro, ComebackResult, ComebackStatus } from "../Comeback";
import { listNames } from "@/lib/comeback";
import { useRevealHold, WatchTv } from "../WatchTv";
import { useNoTv } from "../NoTv";
import { WhoAnswered } from "../WhoAnswered";
import { AnswerLine, AwardList, Pts, ResultTable, TitleLine, WinnerCard, YouPill, type RRow, type Tone } from "../ResultTable";
import { RrPhone, RrPhoneReveal, rrLevelWord, rrPill, SPINNING, useSpinTap, useSpun } from "../Roulette";
import { StakesBet, StakesPhone } from "../Stakes";
import { FoolFact, FoolOptions, FoolPredict, FoolReveal, FoolStatus, foolAwardList, ownIndex } from "../Fool";
import { FOOL_MAX } from "@/lib/fool";
import { SeeCredit, SeePicture, SeeTicks, seeWho } from "../See";
import { seeAsk } from "@/lib/see";
import { signedPts, skLevelWord } from "@/lib/stakes";

/* the host's answer card: read straight from the secrets row (only the TV and the host can) */
/* (only the one for this very question: the TV writes the screen first and the answer just after, so a read in between
   brought the last question's answer for a second or more; it asks again until they match. The 4 Nov audit, 1.12) */
function useSecretMany(code: string, on: boolean, step: number, again = "") {
  const [s, setS] = useState<SecretMany>({});
  useEffect(() => {
    if (!on) return;
    let live = true, n = 0, t: ReturnType<typeof setTimeout> | undefined;
    const pull = () => void sb().from("secrets").select("data").eq("room", code).maybeSingle().then(({ data }) => {
      if (!live) return;
      const d = (data?.data || {}) as SecretMany;
      if (d.step === step || d.step == null) { setS(d); return; }
      if (++n < 12) t = setTimeout(pull, Math.min(3000, 400 * n));
    }, () => { if (live && ++n < 12) t = setTimeout(pull, 1500); });
    pull();
    return () => { live = false; clearTimeout(t); };
  }, [code, on, step, again]);
  return s.step == null || s.step === step ? s : {};
}
/* each phone its own order of the four (seeded by the player's name: a neighbour's screen tells you nothing) */
function order<T>(xs: T[], seed: string) {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
const Line = ({ children, className = "" }: { children: React.ReactNode; className?: string }) =>
  <p className={"text-center text-15 text-[var(--color-ink-2)] " + className} role="status">{children}</p>;

/* Contesting a call on the reveal (8 Nov, the owner: the same as with two teams, the host decides). A captain: their own
   team's WRONG, or another team's RIGHT, once each. The host: Agree or No. Everyone else: who contests, and that the host decides */
function ContestMany({ pub, mine, host, busy, act }: { pub: PubMany; mine: number | null; host: boolean; busy: boolean; act: (move: Record<string, unknown>) => void }) {
  const R = pub.reveal, T = pub.teams, K = pub.contest, g = pub.game;
  if (!R || !g || !typedKey(g.key)) return null;
  const say = g.key === "say", word = (ok: boolean) => (say ? (ok ? "scores" : "doesn't score") : ok ? "RIGHT" : "WRONG");
  const nm = (t: number) => <b style={{ color: T[t].color }}><bdi>{T[t].name}</bdi></b>;
  if (K) return host ? (
    <div className="card flex flex-col gap-2 text-center" role="alert">
      <div className="text-14">{nm(K.by)} say {K.t !== K.by ? <>{nm(K.t)}&rsquo;s </> : null}&ldquo;<bdi>{K.text}</bdi>&rdquo; {say ? (K.ok ? "shouldn't score" : "should score") : <>was <b>{word(!K.ok)}</b></>}. Your call.</div>
      <div className="flex gap-2 justify-center">
        <button className="btn btn-sm" disabled={busy} onClick={() => act({ type: "m/contestOk", v: true })}>{say ? (K.ok ? "Make it not score" : "Make it score") : `Make it ${word(!K.ok)}`}</button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => act({ type: "m/contestOk", v: false })}>{say ? "Keep the call" : `Keep ${word(K.ok)}`}</button>
      </div>
    </div>)
    : <Line>{nm(K.by)} contest {K.t !== K.by ? <>{nm(K.t)}&rsquo;s</> : "their"} &ldquo;<bdi>{K.text}</bdi>&rdquo;. The host decides.</Line>;
  if (host || mine == null) return null;
  const can = T.map((_, t) => t).filter((t) => R.typed?.[t] != null && !(pub.contested || []).includes(t) && (t === mine ? !R.ok?.[t] : !!R.ok?.[t]));
  if (!can.length) return null;
  return (
    <div className="card flex flex-col gap-2 !p-3">
      <div className="eyebrow">Think a call is wrong? The host decides</div>
      {can.map((t) => (
        <div key={t} className="flex items-center gap-3">
          <div className="flex-1 min-w-0 text-15 leading-snug break-words">{nm(t)}: &ldquo;<bdi>{R.typed?.[t]}</bdi>&rdquo; <span className="text-[var(--color-ink-3)]">{word(!!R.ok?.[t])}</span></div>
          <button className="btn btn-sm shrink-0" disabled={busy} onClick={() => act({ type: "m/contest", t })}>Contest</button>
        </div>))}
    </div>);
}

/* the host's Adjust the scores, in the teams sheet (8 Nov, the owner: as with two teams): every team's total, an
   "Are you sure?", and the TV and every phone show the new scores at once */
export function ScoreFixMany({ pub, code }: { pub: PubMany; code: string }) {
  const noTv = useNoTv(), T = pub.teams;
  const [open, setOpen] = useState(false), [v, setV] = useState<number[]>(T.map((t) => t.score)), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const now = T.map((t) => t.score).join();
  useEffect(() => { if (!open) setV(T.map((t) => t.score)); }, [open, now]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return <button className="btn btn-sm btn-ghost self-center" onClick={() => setOpen(true)}>Adjust the scores</button>;
  const step = (t: number, d: number) => setV((x) => x.map((n, i) => (i === t ? Math.max(0, n + d) : n)));
  const changed = v.some((n, t) => n !== T[t].score);
  const save = async () => {
    const what = T.map((t, i) => (v[i] !== t.score ? `${t.name}: ${t.score} → ${v[i]}` : null)).filter(Boolean).join(". ");
    if (!window.confirm(`Are you sure? ${what}.`)) return;
    setBusy(true); setErr(null);
    try { await sendAction(code, "judge", { move: { type: "m/setScores", scores: v }, step: pub.step }); setOpen(false); }
    catch { setErr(noTv ? "That didn't go through. Try again." : "That didn't reach the TV. Try again."); } finally { setBusy(false); }
  };
  return (
    <div className="card flex flex-col gap-3">
      <div className="eyebrow">Adjust the scores</div>
      <p className="text-13 text-[var(--color-ink-2)]">Only if something went wrong. {noTv ? "Every phone shows" : "The TV and every phone show"} the new scores at once.</p>
      {T.map((t, i) => (
        <div key={i} className="flex items-center gap-3">
          <b className="flex-1 truncate" style={{ color: t.color }}><bdi>{t.name}</bdi></b>
          <button className="btn btn-sm" aria-label={`${t.name} minus one`} onClick={() => step(i, -1)}>−</button>
          <span className="display text-32 w-14 text-center">{v[i]}</span>
          <button className="btn btn-sm" aria-label={`${t.name} plus one`} onClick={() => step(i, 1)}>+</button>
        </div>))}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-gold flex-1" disabled={busy || !changed} onClick={() => void save()}>Save the scores</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>);
}

/* the line at the top of a captain's phone on a question, the 2-team words (PhoneGame's status) */
const TOP_CAP: Record<string, string> = { roulette: "Your chamber\u2019s question. Type your answer.", flag: "Which flag?", closest: "Type a number. Nearest wins." };
export function PhoneMany({ pub, me, code, members = [] }: { pub: PubMany; me: Member; code: string; members?: Member[] }) {
  const host = me.role === "host", cap = me.role === "captain", mine = me.team as number | null;
  const g = pub.game, R = pub.reveal, T = pub.teams, sc = pub.screen;
  const noTv = useNoTv();
  /* (read again as answers come in during the Cocktail or Dish: who's out is on the host's card only; 5 Nov review) */
  const secret = useSecretMany(code, host, pub.step, pub.screen === "q" ? (pub.sent || []).join() : "");
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState(""), [pin, setPin] = useState<LatLon | null>(null), [sentTxt, setSentTxt] = useState<string | null>(null);
  useEffect(() => { setText(""); setPin(null); setErr(null); setSentTxt(null); }, [pub.qid]);
  /* a tap holds the buttons (no second tap) but they only dim if the TV takes more than half a second (1 Nov) */
  const [busyLong, setBusyLong] = useState(false);
  useEffect(() => { if (!busy) { setBusyLong(false); return; } const t = setTimeout(() => setBusyLong(true), 450); return () => clearTimeout(t); }, [busy]);
  /* the TV's receipt for the last tap: one it turned down says why (the 4 Nov audit, 3.3: the reasons were written, never shown) */
  const [lastTap, setLastTap] = useState<string | null>(null);
  const got = lastTap ? pub.ack?.[me.user_id]?.[lastTap] : undefined;
  useEffect(() => { if (got && got !== "+" && got !== "-") { setErr(got); setSentTxt(null); } }, [got]);
  /* What Do You See?: a BUZZ shows at once on this phone (the TV confirms it a moment later, or says who was first) */
  const [buzzed, setBuzzed] = useState(false);
  const seeKey = `${pub.qid}|${pub.see?.buzz ?? ""}|${(pub.see?.out || []).join("")}|${got ?? ""}`;
  useEffect(() => { setBuzzed(false); }, [seeKey]);
  /* ...and a teammate's buzz is felt on the captain's phone: it's the one that types the answer */
  const seeTeam = cap && mine != null && pub.see?.buzz === mine;
  useEffect(() => { if (seeTeam) { try { navigator.vibrate?.([60, 40, 60]); } catch { /* not supported */ } } }, [seeTeam]);
  const send = async (kind: string, payload: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { setLastTap(await sendAction(code, kind, { ...payload, step: pub.step })); return true; } catch { setErr(noTv ? "That didn't go through. Try again." : "That didn't reach the TV. Try again."); return false; } finally { setBusy(false); }
  };
  /* players suggest, the captain sees their own team's suggestions (the 4 Nov audit, 3.13) */
  const [sug, setSug] = useState(""), [sugSent, setSugSent] = useState<string | null>(null);
  useEffect(() => { setSug(""); setSugSent(null); }, [pub.qid]);
  const sugs = useSuggestions(code, pub.qid, members, mine ?? -1, cap && sc === "q");
  const np = useNoPaste(code, pub.qid);   // (no pasting into an answer: refused, and flagged, as with two teams)
  /* Russian Roulette: the barrel spins first; the question (and the answer box) once it stops */
  const spinTap = useSpinTap(`${pub.screen}|${pub.roulette?.spinAt ?? ""}|${pub.game?.leg ?? ""}`);   // Spin, once tapped (lib in ../Roulette)
  const rr = pub.roulette, spun = useSpun(rr?.spinAt), rrT = pub.teams.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }));
  const spinning = pub.game?.key === "roulette" && pub.screen === "q" && !spun;
  const suggest = async () => { const t = sug.trim(); if (!t || mine == null) return; try { await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSugSent(t); setSug(""); } catch { /* the phone says so */ } };
  /* the host's change of a call shows at once, until the TV's own update says the same */
  const [flips, setFlips] = useState<Record<string, boolean>>({});
  useEffect(() => { setFlips((f) => { const n = { ...f }; let ch = false; for (const k of Object.keys(n)) { const [q, t] = k.split("|"); if (q !== String(pub.qid) || pub.reveal?.ok?.[Number(t)] === n[k]) { delete n[k]; ch = true; } } return ch ? n : f; }); }, [pub.reveal, pub.qid]);
  const move = (type: string, extra: Record<string, unknown> = {}) => void send("judge", { move: { type, ...extra } });
  const opts = useMemo(() => order(pub.options || [], me.name + (pub.qid || "")), [pub.options, me.name, pub.qid]);
  const sentMine = mine != null && pub.sent[mine];
  /* Closest To Wins: the number as the game reads it (units from the question: "in millions") */
  const guessN: number = g?.key === "closest" && text.trim() ? QMB.parseNumber(text, pub.question) as number : NaN;
  const perN = /\bin (thousand|million|billion)s\b/i.exec(pub.question || "")?.[1].toLowerCase();
  /* what the captain has typed (or the pin dropped) but not sent, quietly to the TV: if the clock runs out first, it
     counts, as with 2 teams (22 Nov, the owner) */
  const draftK = pub.qid ? `${pub.qid}|q` : null;
  useEffect(() => {
    if (!cap || sc !== "q" || !draftK || sentMine || (!text.trim() && !pin)) return;
    const t = setTimeout(() => sendDraft(code, { k: draftK, text: text.trim(), ...(pin ? { pin } : {}) }), 300);
    return () => clearTimeout(t);
  }, [text, pin, draftK, cap, sc, sentMine, code]);
  /* Secret Stakes: the captain's bet being made (a theme, a level), cleared each round */
  const sk = pub.stakes, [skTheme, setSkTheme] = useState<number | null>(null), [skLevel, setSkLevel] = useState<string | null>(null);
  const skRound = `${sk?.round}|${sk?.themes?.join()}`;
  /* Fool Me Twice: the captain's pick and the team it says will fall for its lie (changeable until Lock in), and its
     own lie (kept, so a reload still leaves it out of the picks) */
  const fool = g?.key === "fool" && (sc === "q" || sc === "pick" || sc === "reveal") && !!pub.fool;
  const [foolSel, setFoolSel] = useState<number | null>(null), [foolPred, setFoolPred] = useState<number | null>(null);
  useEffect(() => { setFoolSel(null); setFoolPred(null); }, [pub.qid, sc]);
  const lieKey = "qmb.fool.lie." + code + "." + pub.qid;
  const myLie = (() => { if (!fool || sc !== "pick") return null; try { return localStorage.getItem(lieKey); } catch { return null; } })();
  const foolOwn = ownIndex(pub.fool?.opts, myLie), foolT = T.map((t) => ({ name: t.name, color: t.color }));
  useEffect(() => { setSkTheme(null); setSkLevel(null); }, [skRound]);
  /* a tap locks in at once on this phone (the owner, 1 Nov: the four stayed up a second while the TV answered) */
  const [tapped, setTapped] = useState<string | null>(null);
  const sideways = useSideways();
  const voted = !!pub.voted?.includes(me.name) || tapped === `${pub.qid}`, onList = !!pub.roster?.includes(me.name);
  /* the host's one main button, docked in thumb reach */
  const Main = ({ label, on }: { label: string; on: () => void }) => { const spin = label === "Spin";
    return <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy || (spin && spinTap.pending)} onClick={() => { if (spin) spinTap.press(); on(); }}>{spin && spinTap.pending ? SPINNING : label}</button>; };
  /* a big outcome headline, no box (boxes are for things you can tap) */
  const Big = ({ eyebrow, text, color, size = 32, sub }: { eyebrow?: string; text: React.ReactNode; color?: string; size?: number; sub?: React.ReactNode }) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="display leading-tight" style={{ fontSize: typeof text === "string" && text.length > 18 ? 28 : size, color: color ?? "var(--color-gold)" }}>{text}</div>
      {sub && <div className="text-13 font-bold">{sub}</div>}
    </div>);
  /* "That's your team!", under who takes it */
  const W = takes(pub);
  /* the comeback (17 Nov, the owner): the teams as its pieces take them; is my team in it, and is it out; and the line
     for everyone who watches it */
  const cb = g?.key === "comeback" ? pub.comeback : undefined, cbT = T.map((t) => ({ name: t.name, color: t.color }));
  const cbIn = !!cb && mine != null && cb.teams.includes(mine), cbOut = cbIn && !!cb?.out[mine!];
  const cbLine = cb ? `${listNames(cb.teams.filter((t) => !cb.out[t]).map((t) => T[t].name))} are playing for a comeback.` : "";
  /* a game's result waits on the phones while the TV reveals it, last place first (the owner, 31 Oct) */
  const held = useRevealHold(sc === "summary" && g && pub.summary ? `${g.key}:${g.index}` : null, pub.summary ? resultDone(pub) + 0.3 : 0);

  /* what's on screen, close up: the flag, the photo, the question, and the clock. It can't be selected or copied */
  const OnScreen = ({ small }: { small?: boolean }) => sc !== "q" || !g ? null : (
    <div className="noselect contents" {...noCopy}>
      {/* the comeback: who is still in it, over the question */}
      {cb && <ComebackStatus teams={cbT} c={cb} />}
      {g.key === "flag" && <div className="flex justify-center"><FlagImg name={pub.flag} h={small ? 110 : 150} /></div>}
      {/* What Do You See?: the picture, clearing from the TV's clock */}
      {/* (stays in the right column sideways, sized to the screen: under the scores on the left it was cut off) */}
      {g.key === "see" && pub.see && <div className="flex flex-col items-center gap-1 noselect" {...noCopy}>
        {/* (the question, by kind: the owner, 12 Nov) */}
        <div className="text-15 font-bold text-center leading-snug" style={{ color: "var(--color-gold)" }}>{seeAsk(pub.see.kind)}</div>
        <SeePicture see={pub.see} deadline={pub.deadline} left={pub.left} w={small ? 220 : 340} /></div>}
      {/* (with no TV, what the TV shows beside the picture: who has buzzed, who is out of it) */}
      {g.key === "see" && pub.see && noTv && (pub.see.buzz != null || pub.see.out?.some(Boolean)) && <SeeTicks teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} out={pub.see.out} buzz={pub.see.buzz} size={15} />}
      {g.key === "airport" && <Board air={pub.airport} size="phone" flip />}
      {g.key === "map" && pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={false} hint={!!pub.map.hint} maxH={small ? 180 : 240} legend={false} />}
      {g.key === "dish" && pub.dish && (<div className="flex flex-col">
        <div className="card !py-2">
          <div className="eyebrow mb-1" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div>
          <ol className="flex flex-col gap-0.5 text-15">{pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{name}</b>{qty && <span className="text-13 text-[var(--color-ink-2)]">{qty}</span>}</li>; })}</ol>
        </div></div>)}
      {g.key === "quiz" && pub.theme && <ToSide order={2}><div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>{pub.theme}</div></ToSide>}
      {/* (the host: the clock in the barrel's empty top-right corner, as with 2 teams: 21 Nov, the owner; one look, 22 Nov) */}
      {g.key === "roulette" && rr && (host ? <div className="relative"><RrPhone rr={rr} me={null} teams={rrT} host />
        {!spinning && <div className="absolute right-0" style={{ top: 28 }}><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>}</div>
        : <RrPhone rr={rr} me={mine ?? null} teams={rrT} host={false} />)}
      {/* (no TV: how many teams have answered, as the 2-team phones say "Owls have answered." (22 Nov, the owner); the
         host's card has the full list) */}
      {g.key === "roulette" && rr && !host && noTv && sc === "q" && spun && !pub.paused && <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">{(pub.sent || []).filter(Boolean).length} of {T.length} teams have answered.</p>}
      {/* (stays in the right column sideways: under the scores your question was cut off) */}
      {g.key === "stakes" && sk && <div className="noselect contents" {...noCopy}><StakesPhone sk={sk} screen="stakesQ" teams={rrT} me={host ? null : mine ?? null} /></div>}
      {g.key === "pin" && (small
        ? <div className="flex items-center justify-center gap-4 pin-row"><PinPhoto pin={pub.pin} h={112} small zoom /><span className="main-clock"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={64} /></span></div>
        : <PinPhoto pin={pub.pin} h={230} small zoom />)}
      {pub.question && <p className={"font-bold leading-snug text-center " + (pub.question.length > 120 ? "text-16" : "text-20")}>{pub.question}</p>}
      {/* (What Do You See?, a buzz: one clock, the team's 10 seconds; the captain who buzzed has it on the answer card) */}
      {!(small && g.key === "pin") && !spinning && !(host && g.key === "roulette") && !(g.key === "see" && pub.see?.typeBy && cap && pub.see.buzz === mine) && <ToSide order={9} className="side-clock" when={g.key !== "closest"}><div className={"grid place-items-center main-clock" + (g.key === "closest" ? " clock-last" : "")}>
        <Clock deadline={g.key === "see" && pub.see?.typeBy ? pub.see.typeBy : pub.deadline} left={g.key === "see" && pub.see?.typeBy ? undefined : pub.left} timeUp={pub.timeUp} size={small || sideways ? 70 : 90} /></div></ToSide>}
    </div>);
  /* the answer, on a reveal: big, in gold, with the fact behind it */
  const Answer = () => !R || !g ? null : (
    <div className="noselect" {...noCopy}>
      <AnswerLine question={["quiz", "say", "majority", "sudden", "comeback", "closest"].includes(g.key) ? pub.question : null}
        media={g.key === "flag" ? <FlagImg name={pub.flag} h={96} />
          : g.key === "see" && pub.see ? <div className="flex flex-col items-center gap-1"><SeePicture see={pub.see} clear w={240} alt={R.answer} /><SeeCredit see={pub.see} size={11} />
            {(() => { const w = seeWho(pub.see, T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] })), R.winners?.length); return <span className="display text-18" style={{ color: w.color }}>{w.text}</span>; })()}</div>
          : g.key === "map" && pub.map ? <MapView id={pub.map.id} rev={pub.map.rev} reveal maxH={180} legend={false} />
          : g.key === "pin" && R.at ? <div className="w-full"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
            ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, ...(T.length > 4 ? { label: showKm(R.off?.[i] ?? 0), letter: LETTERS[i] } : { label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` }) } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
            fly height={220} label={`Where it is: ${R.place}`} /></div> : null}
        label={g.key === "say" ? "The app's secret answer" : undefined}
        answer={g.key === "closest" ? showNum(Number(R.answer)) : R.answer} fact={R.place || R.notes} />
    </div>);
  /* the result after a question (the owner's pick, 1 Nov): how your team did, in one pill */
  const youOf = (): { text: string; tone: Tone } | null => {
    if (mine == null || !R || !g) return null;
    if (g.key === "majority") { const r = R.right?.[mine] ?? 0, of = R.of?.[mine] ?? 0; return { text: `Your team: ${r} of ${of} right`, tone: r > 0 ? "ok" : "mid" }; }
    /* the comeback: still in it, or out (all three, or nothing) */
    if (cb) { if (!cbIn || cbOut) return null; const x = R.typed?.[mine];
      return R.ok?.[mine] ? { text: cb.i >= cb.of - 1 ? `Your team: all ${cb.of} right!` : "Your team: right · still in it", tone: "ok" } : { text: `Your team: ${x ? "wrong" : "no answer"} · no comeback`, tone: "no" }; }
    if (g.only && !g.only.includes(mine)) return null;
    /* Russian Roulette: right or wrong, and what the chamber paid (the bullet can cost 3) */
    if (g.key === "roulette" && rr?.rev) return rrPill(R.ok?.[mine], !!R.typed?.[mine], rr.rev.level[mine], rr.rev.got[mine] ?? 0);
    /* Secret Stakes: right or wrong, and what the bet came to */
    if (g.key === "stakes" && sk?.rev) { const d = sk.rev.delta[mine] ?? 0, lv = skLevelWord(sk.rev.level[mine]);
      return R.ok?.[mine] ? { text: `Your team: right on ${lv} · ${signedPts(d)}`, tone: d > 0 ? "ok" : "mid" } : { text: `Your team: ${R.typed?.[mine] ? "wrong" : "no answer"} on ${lv} · ${signedPts(d)}`, tone: d < 0 ? "no" : "mid" }; }
    const v = R.pts?.[mine] ?? 0, p = R.places?.[mine];
    if (v > 0) return { text: `Your team: ${p ? place(p) + " · " : ""}+${v}`, tone: "ok" };
    if (typedKey(g.key)) { const x = R.typed?.[mine]; if (!x) return { text: "Your team: no answer", tone: "mid" };
      if (R.ok?.[mine] === false) return { text: g.key === "say" ? `Your team: ${(SAY_WHY[R.why?.[mine] || ""] || "Said it").toLowerCase()}` : "Your team: wrong", tone: "no" }; }
    if (g.key === "pin" && !R.pins?.[mine]) return { text: "Your team: no pin", tone: "mid" };
    if (g.key === "closest" && R.nums?.[mine] == null) return { text: "Your team: no answer", tone: "mid" };
    return { text: "Your team: no points this time", tone: "mid" };
  };
  /* ...then one table, a row a team: its place, what it said (how far off, how many right), what it scored */
  const Table = () => { if (!R || !g) return null;
    const pl = (i: number) => R.places?.[i] ?? null, far = (i: number) => (g.key === "pin" || g.key === "closest" ? (R.off?.[i] ?? 1e15) : 0);
    const idx = T.map((_, i) => i).filter((i) => !(g.only && !g.only.includes(i)))
      .sort((a, b) => (pl(a) ?? 99) - (pl(b) ?? 99) || far(a) - far(b) || (R.ok?.[a] ? 0 : 1) - (R.ok?.[b] ? 0 : 1) || a - b);
    const rows: RRow[] = idx.map((i) => {
      const base = { team: i, name: T[i].name, color: T[i].color, letter: LETTERS[i], place: pl(i), me: i === mine, end: <Pts n={R.pts?.[i]} /> };
      if (typedKey(g.key)) { const x = R.typed?.[i]; return { ...base, val: x ?? "No answer", ok: x ? R.ok?.[i] ?? null : null,
        sub: g.key === "say" && x && R.ok?.[i] === false ? SAY_WHY[R.why?.[i] || ""] : g.key === "roulette" && rr?.rev ? `${rr.draw[i]?.theme} · ${rrLevelWord(rr.rev.level[i])}${R.ok?.[i] ? "" : ` · ${rr.rev.answer[i]}`}` : undefined }; }
      if (g.key === "closest") { const n = R.nums?.[i], off = R.off?.[i]; return { ...base, val: n == null ? "No answer" : showNum(n), sub: n == null ? undefined : off === 0 ? "Spot on!" : `Off by ${showNum(off ?? 0)}` }; }
      if (g.key === "pin") return { ...base, val: R.pins?.[i] ? showKm(R.off?.[i] ?? 0) : "No pin" };
      return { ...base, place: null, end: undefined, val: `${R.right?.[i] ?? 0} of ${R.of?.[i] ?? 0}` };
    });
    const head: [string, string?] = g.key === "majority" ? ["Right"] : [g.key === "closest" ? "Guess" : g.key === "pin" ? "Off by" : "Said", "Pts"];
    return <ResultTable rows={rows} head={head} places={g.key !== "majority" && idx.some((i) => pl(i) != null)} />; };
  /* a game's result and the night's end, the same on every phone */
  /* a game's result (the owner's pick, 1 Nov): your team in a pill, who won in one line, then the standings: place,
     team, the game's score, and what it adds to the night */
  const Summary = () => { if (!g || !pub.summary) return null; if (held) return <WatchTv />;
    /* the comeback: who made it, and where it took them */
    if (cb) { const ok = cbIn && !!cb.made?.[mine!], P = paid(pub); return (<>
      {cbIn && <YouPill text={ok ? `Your team: all ${cb.of} right · ${cb.before[mine!]} → ${cb.after?.[mine!] ?? cb.before[mine!]}` : "Your team: no comeback"} tone={ok ? "ok" : "no"} />}
      <TitleLine eyebrow={g.title} text={P.text} color={P.color} />
      <ComebackResult teams={cbT} c={cb} />
    </>); }
    /* Secret Stakes: no places and nothing more to the night, the bets were the points */
    if (g.key === "stakes" && sk?.sum) { const v = mine != null ? sk.sum.net[mine] ?? 0 : 0; return (<>
      {mine != null && <YouPill text={`Your team ${v > 0 ? "won" : v < 0 ? "lost" : "broke even"}${v ? ` ${Math.abs(v)}` : ""} on its bets`} tone={v > 0 ? "ok" : v < 0 ? "no" : "mid"} />}
      <TitleLine eyebrow={g.title} text="The bets are settled" color="var(--color-gold)" />
      <StakesPhone sk={sk} screen="stakesSummary" teams={rrT} me={mine ?? null} /></>); }
    const S = pub.summary, P = paid(pub), mineAw = mine != null ? S.award[mine] : 0;
    const order = T.map((_, t) => t).sort((a, b) => S.places[a] - S.places[b] || a - b);
    const rows: RRow[] = order.map((t) => ({ team: t, name: T[t].name, color: T[t].color, letter: LETTERS[t], place: S.award[t] > 0 ? S.places[t] : null,
      val: S.shares ? pct(S.shares[t]) : String(S.pts[t]), end: <Pts n={S.award[t]} />, me: t === mine }));
    return (<>
      {mine != null && <YouPill text={mineAw > 0 ? `Your team: ${place(S.places[mine])} · +${mineAw} to the night` : "Your team: no points this game"} tone={mineAw > 0 ? "ok" : "mid"} />}
      <TitleLine eyebrow={g.title} text={P.text} color={P.color} />
      <ResultTable rows={rows} head={[S.shares ? "Right" : "This game", "Tonight"]} places big />
      {S.line && <p className="text-13 text-center" style={{ color: "var(--color-gold)" }}>{S.line}</p>}
      {/* Fool Me Twice: its four awards under the result (16 Nov, the owner) */}
      {g.key === "fool" && S.fool && <AwardList awards={foolAwardList(S.fool, foolT, false)} />}
    </>); };
  /* the night's end (the owner, 1 Nov): the winner clear at the top, how your team did, then the standings */
  const Final = () => { if (!pub.final) return null; const F = pub.final, tops = F.order.filter((x) => x.place === 1).map((x) => x.team), c = tops.length === 1 ? T[tops[0]].color : "var(--color-gold)";
    const my = mine != null ? F.order.find((x) => x.team === mine)?.place : undefined;
    const rows: RRow[] = F.order.map((o) => ({ team: o.team, name: T[o.team].name, color: T[o.team].color, letter: LETTERS[o.team], place: o.place, val: String(T[o.team].score), me: o.team === mine }));
    return (<>
      <WinnerCard eyebrow={tops.length > 1 ? "A shared win" : "The winner"} name={tops.map((t) => T[t].name).join(" & ")} color={c} sub={`${T[tops[0]].score} points`} />
      {my != null && <YouPill text={my === 1 ? "You won the night!" : `Your team finished ${place(my)}`} tone={my === 1 ? "ok" : "mid"} />}
      <ResultTable rows={rows} head={["Points"]} places big />
      <AwardList awards={F.awards.map((a) => ({ ...a, color: a.team != null ? T[a.team].color : undefined }))} />
    </>); };

  return (
    <div className={"flex flex-col gap-4 flex-1" + (sc === "final" ? " over-confetti" : "")} data-soft={busy && !busyLong ? "" : undefined}>
      {/* (the score bar: the room page draws it, with your name, so a phone held sideways can keep it on the left) */}

      {/* THE HOST: the answer on top, one main button */}
      {host && sc === "intro" && g && cb && (<>
        <h1 className="display text-center" style={{ fontSize: 44, color: "var(--color-gold)" }}>{g.title}</h1>
        <ComebackIntro teams={cbT} c={cb} />
        <Main label="Start" on={() => move("m/start")} />
        <button className="btn btn-sm btn-ghost self-center" disabled={busy} onClick={() => move("m/cbSkip")}>Skip the comeback</button>
      </>)}
      {host && sc === "intro" && g && !cb && (<>
        <IntroMany pub={pub} size="phone" />
        {/* Majority Rules: someone who has left comes off their team's list before Start (8 Nov: as with two teams) */}
        {g.key === "majority" && (
          <div className="card flex flex-col gap-2 !p-3">
            <div className="eyebrow">Who plays: take off anyone who has left</div>
            {members.filter((m) => m.role !== "host" && m.team != null).map((m) => { const off = (pub.mrOut || []).includes(m.name); return (
              <div key={m.user_id} className="flex items-center gap-3" style={{ opacity: off ? 0.55 : 1 }}>
                <span className="flex-1 min-w-0 truncate text-15"><b style={{ color: T[m.team as number]?.color }}><bdi>{m.name}</bdi></b>{off ? " · off the list" : ""}</span>
                <button className="btn btn-sm shrink-0" disabled={busy} onClick={() => move("m/mrOut", { name: m.name })}>{off ? "Put back" : "Take off"}</button>
              </div>); })}
          </div>)}
        <Main label={g.key === "majority" ? "Start: everyone's in" : g.key === "roulette" ? "Spin" : "Start"} on={() => move("m/start")} />
      </>)}
      {/* Secret Stakes: the bets as they come in (the host sees every team's); Pause, Change question */}
      {host && sc === "pick" && g && sk && (<>
        <div className="flex items-center justify-between"><div className="eyebrow">Secret Stakes · placing bets</div><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={60} /></div>
        <StakesPhone sk={sk} screen="stakesPick" teams={rrT} me={null} />
        <p className="text-center text-13 text-[var(--color-ink-3)]">No bet by time&rsquo;s up: the safe one, Easy on the first theme.</p>
        {/* (after the bets, not over them: a band docked at the bottom covered them, the owner, 12 Nov; as with two teams) */}
        <div className="flex flex-wrap justify-center gap-2 mt-auto pt-1">
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>Change the themes</button>
        </div>
      </>)}
      {host && sc === "q" && g && !fool && (<>
        {/* (the host's picture small, as with two teams: the answer and who buzzed matter more on this phone) */}
        <OnScreen small={g.key === "see"} />
        {g.key === "stakes" && secret.answers && sk && (
          <div className="card cue-card flex flex-col gap-1" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answers. Only you see these</div>
            {secret.answers.map((a, i) => <div key={i} className="text-15"><b style={{ color: T[i]?.color }}><bdi>{T[i]?.name}</bdi></b>: <b style={{ color: "var(--color-gold)" }}><bdi>{a}</bdi></b></div>)}
          </div>)}
        {g.key === "roulette" && !spinning && secret.answers && rr && (
          <div className="card cue-card flex flex-col gap-1" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The answers. Only you see these</div>
            {secret.answers.map((a, i) => <div key={i} className="text-15"><b style={{ color: T[i]?.color }}><bdi>{T[i]?.name}</bdi></b> · {rr.draw[i]?.theme}: <b style={{ color: "var(--color-gold)" }}><bdi>{a}</bdi></b></div>)}
          </div>)}
        {g.key !== "roulette" && g.key !== "stakes" && secret.answer && (
          <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{g.key === "say" ? "The app's secret answer: it scores nothing. Only you see this" : "The answer. Only you see this"}</div>
            <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{g.key === "closest" ? showNum(Number(secret.answer)) : secret.answer}</div>
            {secret.notes && <div className="text-13 text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
            {(secret.accept?.length ?? 0) > 0 && <div className="text-13 text-[var(--color-ink-2)] mt-1"><b className="text-[var(--color-ink)]">Also accepted:</b> {secret.accept!.join(", ")}</div>}
          </div>)}
        {(g.key === "roulette" ? !spinning && !secret.answers : g.key === "stakes" ? !secret.answers : !secret.answer) && <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">{g.key === "roulette" || g.key === "stakes" ? "Getting the answers…" : "Getting the answer…"}</p>}
        {/* who's in: every team, as the TV shows them */}
        {/* who has answered, live (the owner, 31 Oct): a count, then each team ticked green as it locks in */}
        {(() => { const who = T.map((_, i) => i).filter((i) => (!g.only || g.only.includes(i)) && !cb?.out[i]), n = who.filter((i) => pub.sent[i]).length; return (
          <WhoAnswered oneCol={T.some((t) => t.name.length > 8)} head={g.key === "majority" ? `${pub.voted?.length ?? 0} of ${pub.roster?.length ?? 0} players answered`
              /* (What Do You See?: the buzzer: who buzzed and is saying it and typing it, or nobody yet) */
              : g.key === "see" ? (pub.see?.buzz != null ? <><bdi>{T[pub.see.buzz]?.name}</bdi> buzzed{pub.see.by ? <> (<bdi>{pub.see.by}</bdi>)</> : null}: saying it out loud, and typing it</> : "Waiting for a buzz…") : `${n} of ${who.length} teams answered`}
            rows={who.map((i) => { const out = (secret.out ?? pub.out)?.[i], t = T[i], bz = g.key === "see" && pub.see?.buzz === i, on = bz || (pub.sent[i] && !out);
              /* (what each team sent, under its name, the moment it's in, as with 2 teams: 23 Nov, the owner) */
              const x = typedKey(g.key) ? secret.typed?.[i] : g.key === "closest" && secret.nums?.[i] != null ? showNum(secret.nums[i]!) : null;
              return { key: i, name: t.name, color: t.color, dot: <Dot t={i} color={t.color} size={14} />, lit: !!(pub.sent[i] || bz),
                typed: x ? <div className="text-14 font-bold leading-snug pl-[22px] break-words"><bdi>{x}</bdi></div> : null,
                statusColor: out ? "var(--color-no)" : on ? "var(--color-ok)" : "var(--color-ink-3)", status: out ? "✗ out" : bz ? "buzzed!" : g.key === "see" ? "can buzz" : on ? (g.key === "majority" ? "✓ all in" : "✓ in") : "waiting" }; })} />); })()}
        {/* the same controls as with two teams: Pause, Change question, Reveal now (the 4 Nov audit, 3.11) */}
        {/* (after the answer and the list, not docked over them: the band covered the answer card and the list of who's
           in, the owner, 12 Nov; as with two teams, where these were never docked) */}
        <div className="flex flex-wrap justify-center gap-2 mt-auto pt-1">
          {/* (What Do You See?: a team that buzzed is answering: the clock is stopped for it already) */}
          {!(g.key === "see" && pub.see?.buzz != null) && <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>}
          {/* (shown even once answers are in: the new question clears them, every game: 23 Nov, the owner) */}
          {g.key !== "sudden" && !(g.key === "see" && pub.see?.buzz != null) && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>{g.key === "stakes" ? "Change the themes" : g.key === "flag" ? "Change flag" : "Change question"}</button>}
          {/* Guess the Map: one hint a map, as with two teams (8 Nov) */}
          {g.key === "map" && !pub.map?.hint && <button className="btn btn-sm" disabled={busy} onClick={() => move("m/hint")}>Show hint</button>}
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button>
        </div>
      </>)}
      {host && sc === "reveal" && g && R && !fool && (<>
        {g.key === "roulette" && rr ? <RrPhoneReveal rr={rr} me={null} teams={rrT} /> : g.key === "stakes" && sk ? <StakesPhone sk={sk} screen="stakesReveal" teams={rrT} me={null} /> : <Answer />}
        {typedKey(g.key) ? (<>
          {/* the host is told the calls are theirs to change (the reviewers, 31 Oct) */}
          <p className="text-center text-13 text-[var(--color-ink-2)]">The app made these calls. Tap one to change it.</p>
          {/* each team's answer, and its ruling beside it, which the host can always flip (the TV confirms it a beat later) */}
          <div className="flex flex-col gap-3">{T.map((t, i) => { const x = R.typed?.[i], v = R.ok?.[i]; if (g.only && !g.only.includes(i)) return null; if (cb?.out[i]) return null; return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="eyebrow flex items-center gap-2" style={{ color: t.color, letterSpacing: ".1em" }}><Dot t={i} color={t.color} size={14} /><span className="truncate"><bdi>{t.name}</bdi></span></div>
                {x ? <div className="font-bold text-18 leading-snug break-words"><bdi>{x}</bdi></div> : <div className="text-14 text-[var(--color-ink-3)]">No answer</div>}
                {/* (a call the host has changed says so, as with 2 teams: 22 Nov, the owner) */}
                {(() => { const now = flips[`${pub.qid}|${i}`] ?? v, app = R.app?.[i]; return x && now != null && app != null && now !== app
                  ? <div className="text-12 font-bold" style={{ color: now ? "var(--color-ok)" : "var(--color-no)" }}>You changed it: {verdictWord(now, g.key === "say")}</div> : null; })()}
                {g.key === "roulette" && rr?.rev && <div className="text-13 text-[var(--color-ink-2)] leading-snug">{rr.draw[i]?.theme} · {rrLevelWord(rr.rev.level[i])} · Answer: <b><bdi>{rr.rev.answer[i]}</bdi></b></div>}
                {g.key === "stakes" && sk?.rev && <div className="text-13 text-[var(--color-ink-2)] leading-snug">{sk.rev.theme[i]} · {skLevelWord(sk.rev.level[i])} · Answer: <b><bdi>{sk.rev.answer[i]}</bdi></b></div>}
              </div>
              {x && <div className="w-[188px] shrink-0"><RulingPicker compact sticky value={flips[`${pub.qid}|${i}`] ?? v} say={g.key === "say"} neg={g.key === "say" ? SAY_WHY[R.why?.[i] || ""] : undefined} label={`Rule on ${poss(t.name)} answer`} busy={false}
                onPick={(nv) => { if ((flips[`${pub.qid}|${i}`] ?? v) === nv) return; setFlips((f) => ({ ...f, [`${pub.qid}|${i}`]: nv })); move("m/flip", { t: i }); }} /></div>}
            </div>); })}</div></>
        ) : <Table />}
        {/* (the picture says who got it first, under the picture: not twice) */}
        {g.key !== "majority" && g.key !== "stakes" && g.key !== "see" && <Big text={W.text} color={W.color} />}
        <ContestMany pub={pub} mine={null} host busy={busy} act={(mv) => { const { type, ...x } = mv; move(String(type), x); }} />
        {/* (Next waits for the ruling, as with two teams) */}
        {pub.contest ? <p className="text-center text-13 text-[var(--color-ink-3)] mt-auto" role="status">Next comes back once you&rsquo;ve ruled on the contest.</p>
          : <Main label={g.key === "roulette" && g.leg < g.of ? "Spin" : "Next"} on={() => move("m/next")} />}
      </>)}
      {host && sc === "summary" && (<><Summary />{/* the host's Next waits with the result, so a tap can't skip the TV's reveal (the owner, 1 Nov) */}{!held && <Main label="Next" on={() => move("m/next")} />}</>)}
      {host && sc === "final" && (<>
        <Final />
        <div className="mt-auto flex flex-col gap-2">
          {/* (short, small and gold, side by side: the owner, 11 Nov) */}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-gold" disabled={busy} onClick={() => move("m/again")}>Play again</button>
            <button className="btn btn-gold-line" disabled={busy} onClick={() => { move("m/exit"); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
          </div>
          <p className="text-center text-13 text-[var(--color-ink-3)]">Play again: same teams. Exit takes every phone{noTv ? "" : " and the TV"} back to the home screen.</p>
        </div>
      </>)}

      {/* EVERYONE ELSE */}
      {!host && sc === "intro" && g && (<>
        {cb ? <><h1 className="display text-center" style={{ fontSize: 44, color: "var(--color-gold)" }}>{g.title}</h1><ComebackIntro teams={cbT} c={cb} /></> : <IntroMany pub={pub} size="phone" />}
        <Line className="mt-auto">{noTv ? "The host starts it." : "Eyes on the TV. The host starts it."}</Line>
      </>)}

      {/* MAJORITY RULES: everyone on the list answers, on their own phone */}
      {!host && (sc === "q" || sc === "pick") && pub.paused && (
        <div className="text-center py-8" role="status"><div className="display text-40" style={{ color: "var(--color-gold)" }}>Paused</div>
          <p className="text-14 text-[var(--color-ink-2)] mt-1">The host paused it. The question comes back when the clock restarts.</p></div>)}
      {!host && sc === "q" && !pub.paused && g?.key === "majority" && (<>
        <p className="text-center text-14 font-bold text-[var(--color-ink-2)]">Your own answer: eyes on your phone, no talking</p>
        <OnScreen />
        {!onList ? <Line>You joined after it started, so you&rsquo;re watching this one. You&rsquo;ll play the next Majority Rules.</Line>
          : voted ? <p className="text-center font-bold text-16" role="status">Locked in. The answer comes up when the time&rsquo;s up.</p>
          : <div className="flex flex-col gap-2">
            <div className="grid gap-2.5" role="group" aria-label="The four answers">
              {opts.map((o) => <button key={o} type="button" className="btn btn-lg btn-block mr-opt" disabled={busy} onClick={() => { setTapped(`${pub.qid}`); void send("answer", { pick: o, k: `${pub.qid}|q` }).then((ok) => { if (!ok) setTapped(null); }); }}><bdi>{o}</bdi></button>)}
            </div>
            <p className="text-center text-12 text-[var(--color-ink-3)]">One tap, and it&rsquo;s locked.</p>
          </div>}
      </>)}

      {/* Secret Stakes: the captain bets (a theme, a level, Lock in); everyone else sees the themes, and their captain's bet once it's in */}
      {!host && sc === "pick" && !pub.paused && g && sk && (<>
        <p className="text-center font-bold text-18" role="status" style={{ color: cap && mine != null && !sk.locked[mine] ? "var(--color-gold)" : undefined }}>
          {cap ? (mine != null && sk.locked[mine] ? "Bet locked in. Waiting for the others." : "Place your bet: a theme, then a level") : "Secret Stakes: your captain bets"}</p>
        <div className="grid place-items-center main-clock"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={70} /></div>
        {cap && mine != null && !sk.locked[mine] ? <StakesBet sk={sk} theme={skTheme} level={skLevel} setTheme={setSkTheme} setLevel={setSkLevel} busy={busy}
            onLock={() => { if (skTheme != null && skLevel) void send("next", { move: { type: "m/bet", k: skTheme, level: skLevel, theme: sk.themes[skTheme] } }); }} />
          : <StakesPhone sk={sk} screen="stakesPick" teams={rrT} me={mine ?? null} cap={false} />}
      </>)}
      {/* sudden death: a captain whose team isn't tied at the top watches */}
      {cap && sc === "q" && g?.only && mine != null && !g.only.includes(mine) && (<><OnScreen /><Line>{cb ? cbLine : "Sudden death: only the teams tied at the top answer this one."}</Line></>)}
      {/* the comeback: a captain whose team has missed one watches the rest */}
      {cap && sc === "q" && cbOut && (<><OnScreen /><Line>Your team is out of the comeback.</Line></>)}
      {/* THE CAPTAIN answers the rest */}
      {cap && sc === "q" && !pub.paused && g && g.key !== "majority" && !fool && !(g.only && mine != null && !g.only.includes(mine)) && !cbOut && (<>
        {/* the captain's line at the top, as with 2 teams (Russian Roulette 22 Nov, Guess the Flag 23 Nov, the owner) */}
        {TOP_CAP[g.key] && <p className="text-center text-balance leading-snug text-14 font-semibold text-[var(--color-ink-3)]" role="status">{TOP_CAP[g.key]}</p>}
        <OnScreen small={g.key === "pin" && !sentMine} />
        {/* What Do You See? (12 Nov, the owner: a buzzer): BUZZ, then 10 seconds to say it out loud and type it; a wrong
            answer (or none in time) and the team is out of this picture, and another team can buzz */}
        {g.key === "see" ? (() => { const S = pub.see, out = mine != null && !!S?.out?.[mine], bz = S?.buzz ?? null, me2 = bz != null && bz === mine, col = mine != null ? T[mine].color : undefined;
          /* typing starts the moment this captain taps BUZZ, before the TV's word comes back (the owner, 15 Nov: the
             buzzer felt slow); Send waits for the TV to give the buzz, and if another team was first the box closes */
          const typing = !out && (me2 || (buzzed && bz == null && !pub.paused)) && !sentMine && !sentTxt, early = !me2;
          const go = () => { const t = text.trim(); if (!t || early) return; void send("answer", { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) setSentTxt(t); }); };
          return (<>
          <p className="text-center font-bold text-18 text-balance" role="status" style={{ color: out ? "var(--color-no)" : me2 ? "var(--color-gold)" : bz != null ? "var(--color-ink-3)" : undefined }}>
            {out ? (sentMine ? "Wrong. You’re out of this picture." : "Time’s up. You’re out of this picture.") : me2 ? (sentMine || sentTxt ? "Answer sent. The app checks it." : <>{S?.by && S.by !== me.name ? <bdi>{S.by}</bdi> : "You"} buzzed! Say it out loud and type it.</>)
              : bz != null ? <><bdi>{T[bz]?.name}</bdi> buzzed</> : "Know it? BUZZ!"}</p>
          {!out && bz == null && !typing && (buzzed
            ? <div className="display text-center rounded-[16px] grid place-items-center" role="status" style={{ minHeight: 100, fontSize: 40, background: col, color: "#04050e", opacity: 0.85 }}>BUZZED!</div>
            : <button className="btn btn-lg btn-block display" style={{ minHeight: 100, fontSize: 48, background: col, color: "#04050e", borderColor: "transparent" }} disabled={busy}
                onClick={() => { setBuzzed(true); void send("buzz", {}).then((ok) => { if (!ok) setBuzzed(false); }); }}>BUZZ</button>)}
          {typing && (
            <div className="card flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="field-label !mb-0" htmlFor="mans">Your answer</label>
                {S?.typeBy && <div className="flex items-center gap-2 text-13 font-bold" role="timer"><Clock deadline={S.typeBy} size={52} />to say it and type it</div>}
              </div>
              <input id="mans" {...np.props} className="input" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={80} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type it"
                onKeyDown={(e) => { if (e.key === "Enter" && !busy && text.trim()) { e.preventDefault(); go(); } }} />
              {np.hint}
              <button className="btn btn-gold btn-lg" disabled={busy || early || !text.trim()} onPointerDown={(e) => e.preventDefault()} onClick={go}>Send</button>
              <div className="text-13 text-[var(--color-ink-3)]">Say it out loud too! Wrong, and you&rsquo;re out of this picture.</div>
            </div>)}
        </>); })()
        : sentMine ? <p className="text-center font-bold text-16" role="status">
            {`Locked in${sentTxt && g.key !== "pin" ? `: ${sentTxt}` : ""}.`}</p>
          : g.key === "pin" ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-13 text-[var(--color-ink-3)]">{pin ? "Tap anywhere to move your pin, or drag it. Zoom in (pinch, or +) to place it exactly, then Lock in." : "Tap the map to drop your pin. You can move it until you lock in."}</p>
              <PinMap value={pin} onChange={setPin} color={mine != null ? T[mine].color : undefined} height="min(520px, max(300px, calc(100dvh - 460px)))" />
              <button className="btn btn-gold btn-lg btn-block dock" disabled={busy || !pin} onClick={() => void send("answer", { pin, k: `${pub.qid}|q` })}>Lock in</button>
            </div>
          ) : spinning ? null : (
            <div className="card flex flex-col gap-2">
              <label className="field-label !mb-0" htmlFor="mans">{g.key === "closest" ? "Your number" : "Your answer"}</label>
              <input id="mans" {...np.props} className="input" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={80} inputMode={g.key === "closest" ? "decimal" : "text"} value={text} onChange={(e) => setText(e.target.value)} placeholder={g.key === "closest" ? "e.g. 236" : "Type it"} />
              {/* (Closest To Wins: what the number counts as, or that it isn't one, before it's sent, as with 2 teams: 23 Nov) */}
              {g.key === "closest" && text.trim() && (Number.isFinite(guessN)
                ? ![String(guessN), guessN.toLocaleString("en-GB")].includes(text.trim()) && <div className="text-13 text-[var(--color-ink-2)]">Counts as <b>{guessN.toLocaleString("en-GB")}{perN ? ` ${perN}` : ""}</b></div>
                : <p className="text-13 text-[var(--color-no)]" role="alert">That isn&rsquo;t a number.</p>)}
              {np.hint}
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim() || (g.key === "closest" && !Number.isFinite(guessN))} onPointerDown={(e) => e.preventDefault()} onClick={() => { const t = text.trim(); void send("answer", g.key === "closest" ? { n: t, k: `${pub.qid}|q` } : { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) setSentTxt(t); }); }}>{g.key === "closest" ? "Lock in" : "Send"}</button>
              {/* (no "Once you send it, it's locked." in Russian Roulette: 22 Nov, the owner) */}
              {g.key !== "roulette" && g.key !== "closest" && <div className="text-13 text-[var(--color-ink-3)]">{g.key === "dish" ? "One guess for your team: a wrong one puts you out of this recipe. The faster your right answer, the more points." : g.key === "say" ? "One answer. No points for the app's secret answer, or the same word as another team." : "Once you send it, it’s locked."}</div>}
            </div>)}
        {sentMine && g.key === "pin" && pin && <PinMap value={pin} color={mine != null ? T[mine].color : undefined} height="min(40vh, 340px)" label="Your pin" />}
        {!sentMine && sugs.length > 0 && g.key !== "pin" && (
          <div className="card">
            <div className="eyebrow mb-2">Your team suggests. Tap one to use it.</div>
            <div className="flex flex-col gap-1">
              {sugs.map((x) => (
                <button key={x.id} type="button" className="text-left text-15 min-h-[44px] px-2 -mx-2 rounded-[12px] active:bg-white/10" onClick={() => setText(x.text)}>
                  <b style={{ color: mine != null ? T[mine].color : undefined }}><bdi>{members.find((m) => m.user_id === x.user_id)?.name}</bdi>:</b> {x.text}</button>))}
            </div>
          </div>)}
      </>)}
      {!host && !cap && sc === "q" && !pub.paused && g && g.key !== "majority" && !fool && (<>
        {/* the players' line at the top, as with 2 teams */}
        {TOP_CAP[g.key] && <p className="text-center text-balance leading-snug text-14 font-semibold text-[var(--color-ink-3)]" role="status">{g.title}: help your captain</p>}
        <OnScreen />
        {/* What Do You See? (12 Nov, the owner): any player can buzz for the team (the captain types the answer); who
            buzzed, and whether your team is out of this picture */}
        {g.key === "see" && mine != null && (() => { const S = pub.see, out = !!S?.out?.[mine], bz = S?.buzz ?? null, col = T[mine]?.color; return (<>
          <p className="text-center font-bold text-18 text-balance" role="status" style={{ color: out ? "var(--color-no)" : bz === mine ? "var(--color-gold)" : bz != null ? "var(--color-ink-3)" : undefined }}>
            {out ? "Your team is out of this picture." : bz === mine ? <>{S?.by && S.by !== me.name ? <bdi>{S.by}</bdi> : "You"} buzzed! Say it out loud: your captain types it.</>
              : bz != null ? <><bdi>{T[bz]?.name}</bdi> buzzed</> : "Know it? BUZZ!"}</p>
          {!out && bz == null && (buzzed
            ? <div className="display text-center rounded-[16px] grid place-items-center" role="status" style={{ minHeight: 100, fontSize: 40, background: col, color: "#04050e", opacity: 0.85 }}>BUZZED!</div>
            : <button className="btn btn-lg btn-block display" style={{ minHeight: 100, fontSize: 48, background: col, color: "#04050e", borderColor: "transparent" }} disabled={busy}
                onClick={() => { setBuzzed(true); void send("buzz", {}).then((ok) => { if (!ok) setBuzzed(false); }); }}>BUZZ</button>)}
        </>); })()}
        {/* a box to suggest an answer to the captain, as with two teams (the 4 Nov audit, 3.13); not on a map pin */}
        {spinning || (g.key === "see" && mine != null && pub.see?.out?.[mine]) ? null : mine != null && !pub.sent[mine] && g.key !== "pin" && !(g.only && !g.only.includes(mine)) && !cbOut ? (
          <div className="card flex flex-col gap-2">
            <label className="field-label !mb-0" htmlFor="msug">Suggest to {T[mine]?.captain || "your captain"}</label>
            <div className="flex gap-2">
              <input id="msug" {...np.props} className="input" autoComplete="off" value={sug} maxLength={80} inputMode={g.key === "closest" ? "decimal" : "text"} placeholder={g.key === "closest" ? "A number" : "Your answer"}
                onChange={(e) => setSug(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
              <button className="btn" disabled={!sug.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => void suggest()}>Send</button>
            </div>
            {np.hint}
            {sugSent && <div className="text-13 text-[var(--color-ink-2)]">Sent: <b>{sugSent}</b></div>}
          </div>)
          /* (once the captain has sent it, say so: 12 Nov) */
          : g.key === "see" ? null : <Line>{cb && cbOut ? "Your team is out of the comeback." : cb && !cbIn ? cbLine : mine != null && pub.sent[mine] ? <>Locked in. The answer comes up when the time&rsquo;s up.</> : "Your captain answers this one."}</Line>}
      </>)}

      {/* the result, on every phone that isn't the host's: who takes it, the answer, then the rows */}
      {!host && sc === "reveal" && g && R && !fool && (<>
        {/* sudden death keeps its headline: it's the night's winner */}
        {g.key === "sudden" && <Big text={W.text} color={W.color} />}
        {(() => { const y = youOf(); return y && <YouPill text={y.text} tone={y.tone} />; })()}
        {g.key === "roulette" && rr ? <RrPhoneReveal rr={rr} me={mine ?? null} teams={rrT} /> : g.key === "stakes" && sk ? <StakesPhone sk={sk} screen="stakesReveal" teams={rrT} me={mine ?? null} /> : <Answer />}
        {g.key !== "stakes" && <Table />}
        <ContestMany pub={pub} mine={cap ? mine : null} host={false} busy={busy} act={(mv) => void send("next", { move: mv })} />
      </>)}
      {/* FOOL ME TWICE (16 Nov, the owner): the fact, the lie (captains), the answers to pick from and who'll fall for your
          lie (captains), the reveal; the host sees the truth and every lie as it comes in, and runs it */}
      {fool && pub.fool && !(sc !== "reveal" && pub.paused && !host) && (() => { const F = pub.fool, picking = sc === "pick", done = mine != null && !!pub.sent[mine];
        /* (many teams, many answers: compact, so every answer and the teams to predict fit in one screen, the owner, 16 Nov:
           from 4 teams smaller rows, from 5 two columns and the teams as one row of letters) */
        const cmp: 0 | 1 | 2 = picking ? (T.length >= 5 ? 2 : 1) : 0, seed = me.user_id + "|" + pub.qid;
        /* (the clock only: no "Fact 6 of 6" line, the tracker at the top says it, the owner, 16 Nov) */
        const head = sc !== "reveal" ? <div className="grid place-items-center"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={cmp ? 48 : 60} /></div> : null;
        const sendLie = () => { const t = text.trim(); if (!t || busy) return;
          void send("answer", { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) { setSentTxt(t); try { localStorage.setItem(lieKey, t); } catch { /* in memory only */ } } }); };
        const status = <FoolStatus teams={foolT} done={(picking ? F.picked : F.wrote) || T.map(() => false)} doing={T.length > 4 ? "…" : picking ? ": picking…" : ": writing…"} finished={T.length > 4 ? "✓" : picking ? ": picked" : ": lie in"} />;
        if (sc === "reveal" && F.rev) { const my = mine != null && !host ? F.rev.pts[mine] ?? 0 : null; return (<>
          {my != null && <YouPill text={`Your team: ${my > 0 ? `+${my}` : my < 0 ? `−${-my}` : "0"}`} tone={my > 0 ? "ok" : my < 0 ? "no" : "mid"} />}
          <FoolFact fool={F} size={19} truth={F.rev.answer} />
          <FoolReveal rev={F.rev} teams={foolT} />
          {host && <Main label="Next" on={() => move("m/next")} />}
        </>); }
        if (host) return (<>
          {head}
          <FoolFact fool={F} size={18} />
          {secret.answer && (
            <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
              <div className="eyebrow" style={{ color: "var(--color-gold)" }}>The truth. Only you see this</div>
              <div className="display text-28 mt-1" style={{ color: "var(--color-gold)" }}><bdi>{secret.answer}</bdi></div>
            </div>)}
          {picking && F.opts && <FoolOptions opts={F.opts} seed={seed} compact={cmp} />}
          {/* each team's lie as it comes in (only this phone sees them) */}
          <div className="card !py-2 flex flex-col gap-1.5" role="status" aria-label="Who's in">
            <p className="text-center text-14 font-bold">{`${pub.sent.filter(Boolean).length} of ${T.length} teams ${picking ? "picked" : "wrote a lie"}`}</p>
            {T.map((t, i) => { const lie = secret.typed?.[i]; return (
              <span key={i} className="flex items-center gap-2 min-w-0 text-14 font-bold" style={{ color: pub.sent[i] ? t.color : "var(--color-ink-3)" }}>
                <Dot t={i} color={t.color} size={14} /><span className="truncate shrink-0 max-w-[40%]"><bdi>{t.name}</bdi></span>
                <span className="truncate flex-1 font-normal text-[var(--color-ink-2)]">{lie ? <bdi>{lie}</bdi> : null}</span>
                <span className="shrink-0" style={{ color: pub.sent[i] ? "var(--color-ok)" : "var(--color-ink-3)" }}>{pub.sent[i] ? "✓ in" : "waiting"}</span>
              </span>); })}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-auto pt-1">
            <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>
            {!picking && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>Change fact</button>}
            <button className="btn btn-sm" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button>
          </div>
        </>);
        /* a captain writes the lie */
        if (cap && !picking) return (<>
          {head}
          <FoolFact fool={F} size={19} />
          {done ? <p className="text-center font-bold text-16" role="status">{sentTxt ? <>Lie sent: <bdi>{sentTxt}</bdi>. Waiting for the others.</> : "Lie sent. Waiting for the others."}</p> : (
            <div className="card flex flex-col gap-2">
              <label className="field-label !mb-0" htmlFor="mlie">Your lie</label>
              <input id="mlie" {...np.props} className="input" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={FOOL_MAX} enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} placeholder="A lie that sounds true"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendLie(); } }} />
              {text.length >= FOOL_MAX && <div className="text-13 font-bold" style={{ color: "var(--color-gold)" }} role="status">Limit reached.</div>}
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim()} onPointerDown={(e) => e.preventDefault()} onClick={sendLie}>Send</button>
              {np.hint}
              <div className="text-13 text-[var(--color-ink-3)]">Write a lie that sounds true. Once you send it, it&rsquo;s locked.</div>
            </div>)}
          {!done && sugs.length > 0 && (
            <div className="card">
              <div className="eyebrow mb-2">Your team suggests. Tap one to use it.</div>
              <div className="flex flex-col gap-1">
                {sugs.map((x) => (
                  <button key={x.id} type="button" className="text-left text-15 min-h-[44px] px-2 -mx-2 rounded-[12px] active:bg-white/10" onClick={() => setText(x.text.slice(0, FOOL_MAX))}>
                    <b style={{ color: mine != null ? T[mine].color : undefined }}><bdi>{members.find((m) => m.user_id === x.user_id)?.name}</bdi>:</b> {x.text}</button>))}
              </div>
            </div>)}
          {status}
        </>);
        /* a captain picks the truth, and the team that will fall for its lie */
        if (cap && picking && F.opts && mine != null) { const needPred = foolOwn >= 0; return (
          <div className={"flex flex-col " + (cmp ? "gap-2" : "gap-4")}>
          {head}
          <FoolFact fool={F} size={cmp ? 15 : 17} />
          <FoolOptions opts={F.opts} hide={foolOwn >= 0 ? [foolOwn] : []} mine={foolSel} busy={busy} locked={done} onPick={(k) => setFoolSel(k)} seed={seed} compact={cmp} />
          {/* (under the answers, as with 2 teams: 21 Nov, the owner) */}
          {/* (the 2-team phone's look: small, grey, not bold, 21 Nov, the owner) */}
          <p className="text-13 text-center text-[var(--color-ink-3)]" role="status">{done ? "Picked. Wait for the reveal." : "Which one is the truth?"}</p>
          {needPred && (<>
            {/* (the team picked, or what it costs them, on the same line: one line less) */}
            <p className="text-center font-bold text-14 mt-1 truncate">Who will fall for your lie? {foolPred != null && cmp === 2 ? <bdi style={{ color: T[foolPred]?.color }}>{T[foolPred]?.name}</bdi> : <span className="font-normal text-[var(--color-ink-3)]">They lose 1.</span>}</p>
            <FoolPredict teams={foolT} me={mine} value={foolPred} busy={busy} locked={done} onPick={setFoolPred} compact={cmp === 2} />
          </>)}
          {/* (after the answers and the teams, not docked over them: a docked bar covered an answer, as the owner found on 12 Nov) */}
          {!done && <button className={"btn btn-gold btn-block " + (cmp ? "" : "btn-lg")} disabled={busy || foolSel == null || (needPred && foolPred == null)}
            onClick={() => void send("answer", { pick: foolSel, ...(needPred ? { pred: foolPred } : {}), k: `${pub.qid}|pick` })}>Lock in</button>}
          </div>); }
        /* everyone else: the fact, a lie to suggest to the captain, the answers (the captain picks) */
        return (<>
          {head}
          <FoolFact fool={F} size={cmp ? 15 : 19} />
          {picking && F.opts && <FoolOptions opts={F.opts} seed={seed} compact={cmp} />}
          {!picking && mine != null && !done ? (
            <div className="card flex flex-col gap-2">
              <label className="field-label !mb-0" htmlFor="msug">Suggest a lie to {T[mine]?.captain || "your captain"}</label>
              <div className="flex gap-2">
                <input id="msug" {...np.props} className="input" autoComplete="off" value={sug} maxLength={FOOL_MAX} placeholder="A lie that sounds true"
                  onChange={(e) => setSug(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
                <button className="btn" disabled={!sug.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => void suggest()}>Send</button>
              </div>
              {sug.length >= FOOL_MAX && <div className="text-13 font-bold" style={{ color: "var(--color-gold)" }} role="status">Limit reached.</div>}
              {np.hint}
              {sugSent && <div className="text-13 text-[var(--color-ink-2)]">Sent: <b>{sugSent}</b></div>}
            </div>)
            : <Line>{mine == null ? "Eyes on the TV." : picking ? (done ? "Picked. Wait for the reveal." : "Your captain picks the truth.") : "Lie sent. Waiting for the others."}</Line>}
          {status}
        </>); })()}
      {!host && sc === "summary" && <Summary />}
      {!host && sc === "final" && <Final />}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
    </div>);
}
