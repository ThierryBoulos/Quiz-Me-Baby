"use client";
/* MANY TEAMS: the phones, laid out as the two-team phones are (components/PhoneGame.tsx): the host's answer
   card on top and one main button docked at the bottom; a captain's answer box, the pin map, the four answers
   of Majority Rules; a result as a headline, then the rows. No score strip: the scores sit behind the Scores
   button in the header, and the tracker says whose side you're on. */
import { useEffect, useMemo, useState } from "react";
import { Clock } from "../Clock";
import { Board, FlagImg, PinPhoto, RulingPicker } from "../GameParts";
import { MapView } from "../MapView";
import { PinMap } from "../PinMap";
import { sendAction, sb } from "@/lib/supabase";
import { showKm, showNum, type LatLon } from "@/lib/game";
import type { Member } from "@/lib/room";
import type { PubMany, SecretMany } from "@/lib/many/view";
import { LETTERS, typedKey } from "@/lib/many/logic";
import { useNoPaste, useSuggestions } from "../PhoneGame";
import { ToSide } from "../Side";
import { Dot, IntroMany, paid, pct, place, revealOf, splitIng, takes, SAY_WHY } from "./PartsMany";
import { useRevealHold, WatchTv } from "../WatchTv";
import { useNoTv } from "../NoTv";
import { AnswerLine, AwardList, Pts, ResultTable, TitleLine, WinnerCard, YouPill, type RRow, type Tone } from "../ResultTable";
import { RrPhone, RrPhoneReveal, rrLevelWord, signed, useSpun } from "../Roulette";
import { StakesBet, StakesPhone } from "../Stakes";
import { SeeCredit, SeePicture, seeWho } from "../See";
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
  const rr = pub.roulette, spun = useSpun(rr?.spinAt), rrT = pub.teams.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }));
  const spinning = pub.game?.key === "roulette" && pub.screen === "q" && !spun;
  const suggest = async () => { const t = sug.trim(); if (!t || mine == null) return; try { await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSugSent(t); setSug(""); } catch { /* the phone says so */ } };
  /* the host's change of a call shows at once, until the TV's own update says the same */
  const [flips, setFlips] = useState<Record<string, boolean>>({});
  useEffect(() => { setFlips((f) => { const n = { ...f }; let ch = false; for (const k of Object.keys(n)) { const [q, t] = k.split("|"); if (q !== String(pub.qid) || pub.reveal?.ok?.[Number(t)] === n[k]) { delete n[k]; ch = true; } } return ch ? n : f; }); }, [pub.reveal, pub.qid]);
  const move = (type: string, extra: Record<string, unknown> = {}) => void send("judge", { move: { type, ...extra } });
  const opts = useMemo(() => order(pub.options || [], me.name + (pub.qid || "")), [pub.options, me.name, pub.qid]);
  const sentMine = mine != null && pub.sent[mine];
  /* Secret Stakes: the captain's bet being made (a theme, a level), cleared each round */
  const sk = pub.stakes, [skTheme, setSkTheme] = useState<number | null>(null), [skLevel, setSkLevel] = useState<string | null>(null);
  const skRound = `${sk?.round}|${sk?.themes?.join()}`;
  useEffect(() => { setSkTheme(null); setSkLevel(null); }, [skRound]);
  /* a tap locks in at once on this phone (the owner, 1 Nov: the four stayed up a second while the TV answered) */
  const [tapped, setTapped] = useState<string | null>(null);
  const voted = !!pub.voted?.includes(me.name) || tapped === `${pub.qid}`, onList = !!pub.roster?.includes(me.name);
  /* the host's one main button, docked in thumb reach */
  const Main = ({ label, on }: { label: string; on: () => void }) => <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={on}>{label}</button>;
  /* a big outcome headline, no box (boxes are for things you can tap) */
  const Big = ({ eyebrow, text, color, size = 32, sub }: { eyebrow?: string; text: React.ReactNode; color?: string; size?: number; sub?: React.ReactNode }) => (
    <div className="text-center flex flex-col gap-1" role="status" aria-live="polite">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="display leading-tight" style={{ fontSize: typeof text === "string" && text.length > 18 ? 28 : size, color: color ?? "var(--color-gold)" }}>{text}</div>
      {sub && <div className="text-13 font-bold">{sub}</div>}
    </div>);
  /* "That's your team!", under who takes it */
  const W = takes(pub);
  /* a game's result waits on the phones while the TV reveals it, last place first (the owner, 31 Oct) */
  const held = useRevealHold(sc === "summary" && g && pub.summary ? `${g.key}:${g.index}` : null, pub.summary ? revealOf(pub.summary, T.length).done + 0.3 : 0);

  /* what's on screen, close up: the flag, the photo, the question, and the clock. It can't be selected or copied */
  const OnScreen = ({ small }: { small?: boolean }) => sc !== "q" || !g ? null : (
    <div className="noselect contents" {...noCopy}>
      {g.key === "flag" && <ToSide order={4} className="noselect" {...noCopy}><FlagImg name={pub.flag} h={small ? 110 : 150} /></ToSide>}
      {/* What Do You See?: the picture, clearing from the TV's clock */}
      {/* (stays in the right column sideways, sized to the screen: under the scores on the left it was cut off) */}
      {g.key === "see" && pub.see && <div className="flex justify-center noselect" {...noCopy}><SeePicture see={pub.see} deadline={pub.deadline} left={pub.left} w={small ? 220 : 340} /></div>}
      {g.key === "airport" && <Board air={pub.airport} size="phone" flip />}
      {g.key === "map" && pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={false} hint={!!pub.map.hint} maxH={small ? 180 : 240} legend={false} />}
      {g.key === "dish" && pub.dish && (<ToSide order={4} className="noselect" {...noCopy}>
        <div className="card !py-2">
          <div className="eyebrow mb-1" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div>
          <ol className="flex flex-col gap-0.5 text-15">{pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{name}</b>{qty && <span className="text-13 text-[var(--color-ink-2)]">{qty}</span>}</li>; })}</ol>
        </div></ToSide>)}
      {g.key === "quiz" && pub.theme && <ToSide order={2}><div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>{pub.theme}</div></ToSide>}
      {g.key === "roulette" && rr && <ToSide order={3}><RrPhone rr={rr} me={host ? null : mine ?? null} teams={rrT} host={host} /></ToSide>}
      {/* (stays in the right column sideways: under the scores your question was cut off) */}
      {g.key === "stakes" && sk && <div className="noselect contents" {...noCopy}><StakesPhone sk={sk} screen="stakesQ" teams={rrT} me={host ? null : mine ?? null} /></div>}
      {g.key === "pin" && <ToSide order={4} className="noselect" {...noCopy}>{small
        ? <div className="flex items-center justify-center gap-4 pin-row"><PinPhoto pin={pub.pin} h={112} small zoom /><span className="main-clock"><Clock deadline={pub.deadline} left={pub.left} size={64} /></span></div>
        : <PinPhoto pin={pub.pin} h={230} small zoom />}</ToSide>}
      {pub.question && <ToSide order={3} className="noselect" {...noCopy}><p className={"font-bold leading-snug text-center " + (pub.question.length > 120 ? "text-16" : "text-20")}>{pub.question}</p></ToSide>}
      {!(small && g.key === "pin") && !spinning && <ToSide order={9} className="side-clock" when={g.key !== "closest"}><div className={"grid place-items-center main-clock" + (g.key === "closest" ? " clock-last" : "")}><Clock deadline={pub.deadline} left={pub.left} size={small ? 70 : 90} /></div></ToSide>}
    </div>);
  /* the answer, on a reveal: big, in gold, with the fact behind it */
  const Answer = () => !R || !g ? null : (
    <div className="noselect" {...noCopy}>
      <AnswerLine question={["quiz", "say", "majority", "sudden"].includes(g.key) ? pub.question : null}
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
    if (g.only && !g.only.includes(mine)) return null;
    /* Russian Roulette: right or wrong, and what the chamber paid (the bullet can cost 3) */
    if (g.key === "roulette" && rr?.rev) { const got = rr.rev.got[mine] ?? 0, x = R.typed?.[mine], bullet = rr.rev.level[mine] === "bullet";
      if (R.ok?.[mine]) return { text: `Your team: right · ${signed(got)}`, tone: "ok" };
      return { text: `Your team: ${x ? "wrong" : "no answer"}${bullet ? ` on the bullet · ${signed(got)}` : ""}`, tone: got < 0 || x ? "no" : "mid" }; }
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
      {host && sc === "intro" && g && (<>
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
        <div className="flex items-center justify-between"><div className="eyebrow">Secret Stakes · placing bets</div><Clock deadline={pub.deadline} left={pub.left} size={60} /></div>
        <StakesPhone sk={sk} screen="stakesPick" teams={rrT} me={null} />
        <p className="text-center text-13 text-[var(--color-ink-3)]">No bet by time&rsquo;s up: the safe one, Easy on the first theme.</p>
        <div className="flex flex-wrap justify-center gap-2 mt-auto dock-group py-2" style={{ background: "var(--color-bg)" }}>
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>
          <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>Change the themes</button>
        </div>
      </>)}
      {host && sc === "q" && g && (<>
        <OnScreen />
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
          </div>)}
        {(g.key === "roulette" ? !spinning && !secret.answers : g.key === "stakes" ? !secret.answers : !secret.answer) && <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Getting the answer…</p>}
        {/* who's in: every team, as the TV shows them */}
        {/* who has answered, live (the owner, 31 Oct): a count, then each team ticked green as it locks in */}
        {(() => { const who = T.map((_, i) => i).filter((i) => !g.only || g.only.includes(i)), n = who.filter((i) => pub.sent[i]).length; return (
          <div className="card !py-2 flex flex-col gap-1.5" role="status" aria-label="Who has answered">
            <p className="text-center text-14 font-bold">{g.key === "majority" ? `${pub.voted?.length ?? 0} of ${pub.roster?.length ?? 0} players answered` : `${n} of ${who.length} teams answered`}</p>
            <div className={"who-grid grid gap-x-3 gap-y-1 " + (T.some((t) => t.name.length > 8) ? "grid-cols-1" : "grid-cols-2")}>
              {who.map((i) => { const out = (secret.out ?? pub.out)?.[i], t = T[i], on = pub.sent[i] && !out; return (
                <span key={i} className="flex items-center gap-2 min-w-0 text-14 font-bold" style={{ color: pub.sent[i] ? t.color : "var(--color-ink-3)" }}>
                  <Dot t={i} color={t.color} size={14} /><span className="truncate flex-1"><bdi>{t.name}</bdi></span>
                  <span className="shrink-0 font-bold" style={{ color: out ? "var(--color-no)" : on ? "var(--color-ok)" : "var(--color-ink-3)" }}>{out ? "✗ out" : on ? (g.key === "majority" ? "✓ all in" : "✓ in") : "waiting"}</span>
                </span>); })}
            </div>
          </div>); })()}
        {/* the same controls as with two teams: Pause, Change question, Reveal now (the 4 Nov audit, 3.11) */}
        {/* (docked: sideways, the question pushed these below the fold; 5 Nov review) */}
        <div className="flex flex-wrap justify-center gap-2 mt-auto dock-group py-2" style={{ background: "var(--color-bg)" }}>
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>
          {g.key !== "sudden" && (g.key === "majority" ? !(pub.voted?.length) : !pub.sent.some(Boolean)) && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>{g.key === "stakes" ? "Change the themes" : "Change question"}</button>}
          {/* Guess the Map: one hint a map, as with two teams (8 Nov) */}
          {g.key === "map" && !pub.map?.hint && <button className="btn btn-sm" disabled={busy} onClick={() => move("m/hint")}>Show hint</button>}
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button>
        </div>
      </>)}
      {host && sc === "reveal" && g && R && (<>
        {g.key === "roulette" && rr ? <RrPhoneReveal rr={rr} me={null} teams={rrT} /> : g.key === "stakes" && sk ? <StakesPhone sk={sk} screen="stakesReveal" teams={rrT} me={null} /> : <Answer />}
        {typedKey(g.key) ? (<>
          {/* the host is told the calls are theirs to change (the reviewers, 31 Oct) */}
          <p className="text-center text-13 text-[var(--color-ink-2)]">The app made these calls. Tap one to change it.</p>
          {/* each team's answer, and its ruling beside it, which the host can always flip (the TV confirms it a beat later) */}
          <div className="flex flex-col gap-3">{T.map((t, i) => { const x = R.typed?.[i], v = R.ok?.[i]; if (g.only && !g.only.includes(i)) return null; return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="eyebrow flex items-center gap-2" style={{ color: t.color, letterSpacing: ".1em" }}><Dot t={i} color={t.color} size={14} /><span className="truncate"><bdi>{t.name}</bdi></span></div>
                {x ? <div className="font-bold text-18 leading-snug break-words"><bdi>{x}</bdi></div> : <div className="text-14 text-[var(--color-ink-3)]">No answer</div>}
                {g.key === "roulette" && rr?.rev && <div className="text-13 text-[var(--color-ink-2)] leading-snug">{rr.draw[i]?.theme} · {rrLevelWord(rr.rev.level[i])} · Answer: <b><bdi>{rr.rev.answer[i]}</bdi></b></div>}
                {g.key === "stakes" && sk?.rev && <div className="text-13 text-[var(--color-ink-2)] leading-snug">{sk.rev.theme[i]} · {skLevelWord(sk.rev.level[i])} · Answer: <b><bdi>{sk.rev.answer[i]}</bdi></b></div>}
              </div>
              {x && <div className="w-[188px] shrink-0"><RulingPicker compact sticky value={flips[`${pub.qid}|${i}`] ?? v} say={g.key === "say"} neg={g.key === "say" ? SAY_WHY[R.why?.[i] || ""] : undefined} label={`Rule on ${t.name}’s answer`} busy={false}
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
        <IntroMany pub={pub} size="phone" />
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
        <div className="grid place-items-center main-clock"><Clock deadline={pub.deadline} left={pub.left} size={70} /></div>
        {cap && mine != null && !sk.locked[mine] ? <StakesBet sk={sk} theme={skTheme} level={skLevel} setTheme={setSkTheme} setLevel={setSkLevel} busy={busy}
            onLock={() => { if (skTheme != null && skLevel) void send("next", { move: { type: "m/bet", k: skTheme, level: skLevel } }); }} />
          : <StakesPhone sk={sk} screen="stakesPick" teams={rrT} me={mine ?? null} cap={false} />}
      </>)}
      {/* sudden death: a captain whose team isn't level at the top watches */}
      {cap && sc === "q" && g?.only && mine != null && !g.only.includes(mine) && (<><OnScreen /><Line>Sudden death: only the teams tied at the top answer this one.</Line></>)}
      {/* THE CAPTAIN answers the rest */}
      {cap && sc === "q" && !pub.paused && g && g.key !== "majority" && !(g.only && mine != null && !g.only.includes(mine)) && (<>
        <OnScreen small={g.key === "pin" && !sentMine} />
        {sentMine ? <p className="text-center font-bold text-16" role="status">
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
              {np.hint}
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => { const t = text.trim(); void send("answer", g.key === "closest" ? { n: t, k: `${pub.qid}|q` } : { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) setSentTxt(t); }); }}>{g.key === "closest" ? "Lock in" : "Send"}</button>
              <div className="text-13 text-[var(--color-ink-3)]">{g.key === "dish" ? "One guess for your team: a wrong one puts you out of this recipe. The faster your right answer, the more points." : g.key === "see" ? "One guess for your team. The faster your right answer, the more points." : g.key === "say" ? "One answer. No points for the app's secret answer, or the same word as another team." : "Once you send it, it’s locked."}</div>
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
      {!host && !cap && sc === "q" && !pub.paused && g && g.key !== "majority" && (<>
        <OnScreen />
        {/* a box to suggest an answer to the captain, as with two teams (the 4 Nov audit, 3.13); not on a map pin */}
        {spinning ? null : mine != null && !pub.sent[mine] && g.key !== "pin" && !(g.only && !g.only.includes(mine)) ? (
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
          : <Line>{mine != null && pub.sent[mine] ? <>Locked in. The answer comes up when the time&rsquo;s up.</> : "Your captain answers this one."}</Line>}
      </>)}

      {/* the result, on every phone that isn't the host's: who takes it, the answer, then the rows */}
      {!host && sc === "reveal" && g && R && (<>
        {/* sudden death keeps its headline: it's the night's winner */}
        {g.key === "sudden" && <Big text={W.text} color={W.color} />}
        {(() => { const y = youOf(); return y && <YouPill text={y.text} tone={y.tone} />; })()}
        {g.key === "roulette" && rr ? <RrPhoneReveal rr={rr} me={mine ?? null} teams={rrT} /> : g.key === "stakes" && sk ? <StakesPhone sk={sk} screen="stakesReveal" teams={rrT} me={mine ?? null} /> : <Answer />}
        {g.key !== "stakes" && <Table />}
        <ContestMany pub={pub} mine={cap ? mine : null} host={false} busy={busy} act={(mv) => void send("next", { move: mv })} />
      </>)}
      {!host && sc === "summary" && <Summary />}
      {!host && sc === "final" && <Final />}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
    </div>);
}
