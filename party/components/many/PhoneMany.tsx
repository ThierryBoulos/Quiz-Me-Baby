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
import { useSuggestions } from "../PhoneGame";
import { ToSide } from "../Side";
import { Dot, IntroMany, paid, pct, place, revealOf, splitIng, takes, SAY_WHY } from "./PartsMany";
import { useRevealHold, WatchTv } from "../WatchTv";
import { useNoTv } from "../NoTv";
import { AnswerLine, AwardList, Pts, ResultTable, TitleLine, WinnerCard, YouPill, type RRow, type Tone } from "../ResultTable";

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
  const suggest = async () => { const t = sug.trim(); if (!t || mine == null) return; try { await sendAction(code, "suggest", { team: mine, qid: pub.qid, text: t.slice(0, 80) }); setSugSent(t); setSug(""); } catch { /* the phone says so */ } };
  /* the host's change of a call shows at once, until the TV's own update says the same */
  const [flips, setFlips] = useState<Record<string, boolean>>({});
  useEffect(() => { setFlips((f) => { const n = { ...f }; let ch = false; for (const k of Object.keys(n)) { const [q, t] = k.split("|"); if (q !== String(pub.qid) || pub.reveal?.ok?.[Number(t)] === n[k]) { delete n[k]; ch = true; } } return ch ? n : f; }); }, [pub.reveal, pub.qid]);
  const move = (type: string, extra: Record<string, unknown> = {}) => void send("judge", { move: { type, ...extra } });
  const opts = useMemo(() => order(pub.options || [], me.name + (pub.qid || "")), [pub.options, me.name, pub.qid]);
  const sentMine = mine != null && pub.sent[mine];
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
      {g.key === "airport" && <Board air={pub.airport} size="phone" flip />}
      {g.key === "map" && pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={false} maxH={small ? 180 : 240} legend={false} />}
      {g.key === "dish" && pub.dish && (<ToSide order={4} className="noselect" {...noCopy}>
        <div className="card !py-2">
          <div className="eyebrow mb-1" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}? {pub.dish.ings.length} of {pub.dish.n}</div>
          <ol className="flex flex-col gap-0.5 text-15">{pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return <li key={i} className="flex gap-2 items-baseline"><b>{name}</b>{qty && <span className="text-13 text-[var(--color-ink-2)]">{qty}</span>}</li>; })}</ol>
        </div></ToSide>)}
      {g.key === "quiz" && pub.theme && <ToSide order={2}><div className="eyebrow text-center" style={{ color: "var(--color-gold)" }}>{pub.theme}</div></ToSide>}
      {g.key === "pin" && <ToSide order={4} className="noselect" {...noCopy}>{small
        ? <div className="flex items-center justify-center gap-4 pin-row"><PinPhoto pin={pub.pin} h={112} small zoom /><span className="main-clock"><Clock deadline={pub.deadline} left={pub.left} size={64} /></span></div>
        : <PinPhoto pin={pub.pin} h={230} small zoom />}</ToSide>}
      {pub.question && <ToSide order={3} className="noselect" {...noCopy}><p className={"font-bold leading-snug text-center " + (pub.question.length > 120 ? "text-16" : "text-20")}>{pub.question}</p></ToSide>}
      {!(small && g.key === "pin") && <ToSide order={9} className="side-clock" when={g.key !== "closest"}><div className={"grid place-items-center main-clock" + (g.key === "closest" ? " clock-last" : "")}><Clock deadline={pub.deadline} left={pub.left} size={small ? 70 : 90} /></div></ToSide>}
    </div>);
  /* the answer, on a reveal: big, in gold, with the fact behind it */
  const Answer = () => !R || !g ? null : (
    <div className="noselect" {...noCopy}>
      <AnswerLine question={["quiz", "say", "majority", "sudden"].includes(g.key) ? pub.question : null}
        media={g.key === "flag" ? <FlagImg name={pub.flag} h={96} />
          : g.key === "map" && pub.map ? <MapView id={pub.map.id} rev={pub.map.rev} reveal maxH={180} legend={false} />
          : g.key === "pin" && R.at ? <div className="w-full"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
            ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
            fly height={220} label={`Where it is: ${R.place}`} /></div> : null}
        label={g.key === "say" ? "The app's secret answer" : undefined}
        answer={g.key === "closest" ? showNum(Number(R.answer)) : R.answer} fact={R.place || R.notes} />
    </div>);
  /* the result after a question (the owner's pick, 1 Nov): how your team did, in one pill */
  const youOf = (): { text: string; tone: Tone } | null => {
    if (mine == null || !R || !g) return null;
    if (g.key === "majority") { const r = R.right?.[mine] ?? 0, of = R.of?.[mine] ?? 0; return { text: `Your team: ${r} of ${of} right`, tone: r > 0 ? "ok" : "mid" }; }
    if (g.only && !g.only.includes(mine)) return null;
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
        sub: g.key === "say" && x && R.ok?.[i] === false ? SAY_WHY[R.why?.[i] || ""] : undefined }; }
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
        <Main label={g.key === "majority" ? "Start: everyone's in" : "Start"} on={() => move("m/start")} />
      </>)}
      {host && sc === "q" && g && (<>
        <OnScreen />
        {secret.answer && (
          <div className="card cue-card" style={{ borderColor: "rgba(245,197,24,.5)", background: "rgba(245,197,24,.08)" }}>
            <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{g.key === "say" ? "The app's secret answer: it scores nothing. Only you see this" : "The answer. Only you see this"}</div>
            <div className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{g.key === "closest" ? showNum(Number(secret.answer)) : secret.answer}</div>
            {secret.notes && <div className="text-13 text-[var(--color-ink-2)] mt-1">{secret.notes}</div>}
          </div>)}
        {!secret.answer && <p className="text-center text-13 text-[var(--color-ink-3)]" role="status">Getting the answer…</p>}
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
        <div className="flex flex-wrap justify-center gap-2 mt-auto">
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/pause")}>{pub.paused ? "Resume" : "Pause"}</button>
          {g.key !== "sudden" && (g.key === "majority" ? !(pub.voted?.length) : !pub.sent.some(Boolean)) && <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => move("m/swap")}>Change question</button>}
          <button className="btn btn-sm" disabled={busy} onClick={() => move("m/reveal")}>Reveal now</button>
        </div>
      </>)}
      {host && sc === "reveal" && g && R && (<>
        <Answer />
        {typedKey(g.key) ? (<>
          {/* the host is told the calls are theirs to change (the reviewers, 31 Oct) */}
          <p className="text-center text-13 text-[var(--color-ink-2)]">The app made these calls. Tap one to change it.</p>
          {/* each team's answer, and its ruling beside it, which the host can always flip (the TV confirms it a beat later) */}
          <div className="flex flex-col gap-3">{T.map((t, i) => { const x = R.typed?.[i], v = R.ok?.[i]; if (g.only && !g.only.includes(i)) return null; return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="eyebrow flex items-center gap-2" style={{ color: t.color, letterSpacing: ".1em" }}><Dot t={i} color={t.color} size={14} /><span className="truncate"><bdi>{t.name}</bdi></span></div>
                {x ? <div className="font-bold text-18 leading-snug break-words"><bdi>{x}</bdi></div> : <div className="text-14 text-[var(--color-ink-3)]">No answer</div>}
              </div>
              {x && <div className="w-[188px] shrink-0"><RulingPicker compact sticky value={flips[`${pub.qid}|${i}`] ?? v} say={g.key === "say"} neg={g.key === "say" ? SAY_WHY[R.why?.[i] || ""] : undefined} label={`Rule on ${t.name}’s answer`} busy={false}
                onPick={(nv) => { if ((flips[`${pub.qid}|${i}`] ?? v) === nv) return; setFlips((f) => ({ ...f, [`${pub.qid}|${i}`]: nv })); move("m/flip", { t: i }); }} /></div>}
            </div>); })}</div></>
        ) : <Table />}
        {g.key !== "majority" && <Big text={W.text} color={W.color} />}
        <Main label="Next" on={() => move("m/next")} />
      </>)}
      {host && sc === "summary" && (<><Summary />{/* the host's Next waits with the result, so a tap can't skip the TV's reveal (the owner, 1 Nov) */}{!held && <Main label="Next" on={() => move("m/next")} />}</>)}
      {host && sc === "final" && (<>
        <Final />
        <div className="mt-auto flex flex-col gap-2">
          <button className="btn btn-gold btn-lg btn-block" disabled={busy} onClick={() => move("m/again")}>Play again: same teams</button>
          <p className="text-center text-13 text-[var(--color-ink-3)]">Exit takes every phone{noTv ? "" : " and the TV"} back to the home screen.</p>
          <button className="btn btn-lg btn-block" disabled={busy} onClick={() => { move("m/exit"); setTimeout(() => location.assign("/"), 2500); }}>Exit</button>
        </div>
      </>)}

      {/* EVERYONE ELSE */}
      {!host && sc === "intro" && g && (<>
        <IntroMany pub={pub} size="phone" />
        <Line className="mt-auto">{noTv ? "The host starts it." : "Eyes on the TV. The host starts it."}</Line>
      </>)}

      {/* MAJORITY RULES: everyone on the list answers, on their own phone */}
      {!host && sc === "q" && pub.paused && (
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
          ) : (
            <div className="card flex flex-col gap-2">
              <label className="field-label !mb-0" htmlFor="mans">{g.key === "closest" ? "Your number" : "Your answer"}</label>
              <input id="mans" className="input" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={80} inputMode={g.key === "closest" ? "decimal" : "text"} value={text} onChange={(e) => setText(e.target.value)} placeholder={g.key === "closest" ? "e.g. 236" : "Type it"} />
              <button className="btn btn-gold btn-lg" disabled={busy || !text.trim()} onClick={() => { const t = text.trim(); void send("answer", g.key === "closest" ? { n: t, k: `${pub.qid}|q` } : { text: t, k: `${pub.qid}|q` }).then((ok) => { if (ok) setSentTxt(t); }); }}>{g.key === "closest" ? "Lock in" : "Send"}</button>
              <div className="text-13 text-[var(--color-ink-3)]">{g.key === "dish" ? "One guess for your team: a wrong one puts you out of this recipe. The faster your right answer, the more points." : g.key === "say" ? "One answer. No points for the app's secret answer, or the same word as another team." : "Once you send it, it’s locked."}</div>
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
        {mine != null && !pub.sent[mine] && g.key !== "pin" && !(g.only && !g.only.includes(mine)) ? (
          <div className="card flex flex-col gap-2">
            <label className="field-label !mb-0" htmlFor="msug">Suggest to {T[mine]?.captain || "your captain"}</label>
            <div className="flex gap-2">
              <input id="msug" className="input" autoComplete="off" value={sug} maxLength={80} inputMode={g.key === "closest" ? "decimal" : "text"} placeholder={g.key === "closest" ? "A number" : "Your answer"}
                onChange={(e) => setSug(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void suggest(); }} />
              <button className="btn" disabled={!sug.trim()} onClick={() => void suggest()}>Send</button>
            </div>
            {sugSent && <div className="text-13 text-[var(--color-ink-2)]">Sent: <b>{sugSent}</b></div>}
          </div>)
          : <Line>Your captain answers this one.</Line>}
      </>)}

      {/* the result, on every phone that isn't the host's: who takes it, the answer, then the rows */}
      {!host && sc === "reveal" && g && R && (<>
        {/* sudden death keeps its headline: it's the night's winner */}
        {g.key === "sudden" && <Big text={W.text} color={W.color} />}
        {(() => { const y = youOf(); return y && <YouPill text={y.text} tone={y.tone} />; })()}
        <Answer />
        <Table />
      </>)}
      {!host && sc === "summary" && <Summary />}
      {!host && sc === "final" && <Final />}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
    </div>);
}
