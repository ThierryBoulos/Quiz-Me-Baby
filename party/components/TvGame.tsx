"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Pub } from "@/lib/game";
import { Clock, useAfter, useSecondsLeft } from "./Clock";
import { MapView } from "./MapView";
import { PinMap } from "./PinMap";
import { BattleAnswer, BattleHalf, flagText } from "./PhoneGame";
import { AskHead, battleNeeds, Board, Confetti, decidedFun, decidedHead, decidedPts, decidedWho, recapLines, silent, tieCall, tieHead, FlagImg, Hud, LifelineStrip, MiniIntro, PinPhoto, pinMarks, RoundIntro, ScoreBoard, Verdict } from "./GameParts";
import { BEAT_MS, BEAT_SCREENS, DECIDED, offBy, showKm, showNum, TIE_SCREENS } from "@/lib/game";
import { LeadBanner, useFlyingPoints, useScreenAt } from "./Motion";

/* a delay after the drumroll's hit, for the pieces of a reveal that land one after another */
const d = (s: number) => ({ ["--d" as string]: s + "s" });
/* a mini-game's reveal: no drumroll, so its pieces land straight away (the same moves, a shorter beat) */
const QUICK = { ["--beat" as string]: ".15s" };
const tc = (t?: 0 | 1 | null) => (t === 0 ? "var(--color-a)" : t === 1 ? "var(--color-b)" : "var(--color-gold)");

/* The TV during the game: no buttons (but Exit at the very end), no answers before the reveal. */
/* join: where a phone joins this room (Majority Rules puts the QR code up again before it starts) */
export type Join = { url: string; code: string };
/* sound: this is the TV itself (it plays the coins and the whoosh; another screen showing the TV stays quiet) */
export function TvGame({ pub, onExit, onAgain, join, sound = false }: { pub: Pub; onExit?: () => void; onAgain?: () => void; join?: Join; sound?: boolean }) {
  const T = pub.teams;
  /* the motion: when this screen came up, and the scores as the top bar shows them (points fly up to them) */
  const key = pub.screen + pub.r + (pub.turn ?? "");
  const screenAt = useScreenAt(key);
  const root = useRef<HTMLDivElement>(null);
  const shown = useFlyingPoints(root, pub, screenAt, sound);
  const beat = BEAT_SCREENS.includes(pub.screen);
  /* a message shows for four seconds, then goes. Not the points or who took a leg: the screen itself shows those */
  const [shownToast, setShownToast] = useState<number | null>(null);
  const tid = pub.toast?.id ?? null;
  useEffect(() => { if (tid == null) return; setShownToast(tid); const t = setTimeout(() => setShownToast(null), 4000); return () => clearTimeout(t); }, [tid]);
  const said = / \+\d+ points?( — |$)| takes (leg|map|flag|board|landmark|number) \d+\.$| takes the tie-breaker\.$|^(Nobody got it\.|Tie — a point each\.|Nobody answered — no point\.)$/.test(pub.toast?.text || "");
  const toastOn = !!pub.toast && shownToast === pub.toast.id && !said;
  /* a map's question and its reveal are one screen: the map stays put and the answer comes in over it */
  const bodyKey = (pub.screen === "mapQ" || pub.screen === "mapReveal") && pub.map ? "map" + pub.map.id : key;
  /* the end: celebrate the winner first, then the recap comes up under it */
  const [recap, setRecap] = useState(false);
  useEffect(() => { if (pub.screen !== "final") { setRecap(false); return; } const t = setTimeout(() => setRecap(true), 7000); return () => clearTimeout(t); }, [pub.screen]);
  return (
    /* nothing on the TV can be selected or copied */
    <div ref={root} className="relative flex flex-col h-full noselect" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {/* the tracker, always: Classic's HUD */}
      <Hud pub={pub} size="tv" shown={shown} code={join?.code} />

      <div className={"flex-1 flex flex-col items-center justify-center text-center enter " + (pub.screen === "ask" || pub.screen === "steal" ? "gap-4 spot rounded-[32px] relative isolate overflow-hidden " + (pub.turn === 1 ? "b" : "a") : "gap-6")} key={bodyKey}>
        {/* a steal: the light swings over from the team that missed to the one stealing */}
        {pub.screen === "steal" && <div className={"steal-beam " + (pub.turn === 1 ? "b" : "a")} aria-hidden />}
        {pub.screen === "roundIntro" && <div className="w-full max-w-[1080px]"><RoundIntro pub={pub} size="tv" /></div>}

        {(pub.screen === "ask" || pub.screen === "steal") && (<>
          <AskHead pub={pub} size="tv" />
          <div className="font-bold max-w-[1100px]" style={{ fontSize: (pub.question || "").length > 180 ? 30 : (pub.question || "").length > 110 ? 36 : 46, lineHeight: 1.15 }}>{pub.question}</div>
          <div className="flex items-center gap-8">
            <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
            {pub.screen === "ask" && <div className="w-[560px]"><LifelineStrip pub={pub} t={(pub.turn ?? 0) as 0 | 1} size="tv" /></div>}
          </div>
          <div className="h-7 text-22 font-bold" style={{ color: tc(pub.turn) }}>{pub.sent?.[pub.turn ?? 0] ? `${T[pub.turn ?? 0].name} has answered…` : ""}</div>
        </>)}

        {/* the answer, the calls and who scores land on the drumroll's hit (BEAT_MS); then the points fly up */}
        {pub.screen === "answer" && pub.result && (<div className={"flex flex-col items-center gap-6 " + (pub.result.stolen ? "shake-beat" : "")}>
          <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{pub.question}</div>
          <div className="eyebrow text-18">The answer</div>
          <div className="display beat slam" style={{ fontSize: 96, color: "var(--color-gold)" }}>{pub.result.answer}</div>
          {/* the fun fact goes with the answer */}
          {pub.result.notes && <div className="text-22 text-[var(--color-ink-2)] max-w-[900px] -mt-2 beat" style={d(0.25)}>{pub.result.notes}</div>}
          {/* what each team said, and the app's call on it (contestable until Next) */}
          {(pub.calls || []).map((c, i) => <div key={c.id} className="text-24 flex items-baseline gap-3 justify-center beat" style={d(0.1 + i * 0.12)}><b style={{ color: tc(c.team) }}>{T[c.team].name}{c.note === "steal" ? " (steal)" : c.note ? ` (${c.note})` : ""}:</b> {c.text || "no answer"} <Verdict v={c.ok} size={20} stamp /></div>)}
          {[0, 1].map((t) => !(pub.calls || []).some((c) => c.team === t) && silent(pub, t as 0 | 1) ? <div key={t} className="text-24 text-[var(--color-ink-2)] beat" style={d(0.1)}><b style={{ color: tc(t as 0 | 1) }}>{T[t].name}:</b> {silent(pub, t as 0 | 1)}</div> : null)}
          <div className="display text-44 beat flex items-center gap-4" style={{ ...d(0.35), color: pub.result.by == null ? "var(--color-ink-2)" : tc(pub.result.by) }}>
            {pub.result.by == null ? "Nobody scores" : <span data-fly-src={pub.result.by}>{`${T[pub.result.by].name} +${pub.result.pts}`}</span>}
            {/* a steal: a STOLEN stamp in the stealing team's colour (a dash there read as a minus) */}
            {pub.result.by != null && pub.result.stolen && <span className="tv-stamp stamp-beat" style={{ ...d(0.45), color: tc(pub.result.by) }}>Stolen</span>}
            {/* Double Points: the ×2 stamp */}
            {pub.result.by != null && pub.result.pts >= 2 && (pub.dbl?.[0] || pub.dbl?.[1]) && <span className="x2 stamp-beat" style={d(0.5)}>×2</span>}
          </div>
        </div>)}

        {pub.screen === "roundScore" && (<>
          <div className="eyebrow text-20">End of round {pub.r + 1}</div>
          <div className="flex gap-24">{[0, 1].map((t) => (
            <div key={t}><div className="display text-40" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
              <div className="display text-120">{T[t].score}</div>
              <div className="text-24 text-[var(--color-ink-2)]">+{pub.roundPts?.[t] ?? 0} this round</div></div>))}
          </div>
        </>)}

        {pub.screen === "sudden" && pub.sudden && (!pub.sudden.ready ? (<>
          <div className="display slam" style={{ fontSize: 120, color: "var(--color-gold)" }}>Sudden death</div>
          <div className="text-28 text-[var(--color-ink-2)] max-w-[900px]">Scores are level. One question, captains only — first hand up answers. First right answer wins the night.</div>
        </>) : (<>
          <div className="eyebrow text-20">Sudden death · question {pub.sudden.n}</div>
          <div className="font-bold text-52 max-w-[1000px] leading-tight">{pub.question}</div>
          <Buzzed pub={pub} />
          {pub.sudden.shown && <div className="display text-80" style={{ color: "var(--color-gold)" }}>{pub.sudden.answer}</div>}
          <SdCalls pub={pub} />
        </>))}

        <TvMini pub={pub} join={join} />

        {pub.screen === "final" && (<>
          {/* the winner: "The winner", a beat, then the name slams down with a flash and a shockwave, and the confetti bursts */}
          <div className="win-flash" style={{ ["--c" as string]: tc(pub.winner) }} aria-hidden />
          <div className="confetti-late"><Confetti n={140} /></div>
          <div className="eyebrow text-22 enter">{pub.winner == null ? "The night ends" : "The winner"}</div>
          <div className="relative grid place-items-center">
            <span className="win-ring" style={{ ["--c" as string]: tc(pub.winner) }} aria-hidden />
            <span className="win-ring r2" style={{ ["--c" as string]: tc(pub.winner) }} aria-hidden />
            <div className="display win-slam" style={{ fontSize: (pub.winner != null && T[pub.winner].name.length > 10 ? 0.74 : 1) * (recap ? 80 : 150), color: tc(pub.winner), transition: "font-size .6s ease" }}>{pub.winner == null ? "A draw" : T[pub.winner].name}</div>
          </div>
          {/* once the recap is up, the big score board goes (the scores stay in the top bar) */}
          {!recap && <ScoreBoard pub={pub} w={[T[0].score, T[1].score]} win={pub.winner} size="tv" />}
          {(!recap || pub.contest) && <SdCalls pub={pub} />}
          {/* the night, drawn: both scores through the night (29 Oct), then the awards and the nutshell */}
          {recap && pub.recap?.chart && pub.recap.chart.length > 2 && <NightChart pub={pub} />}
          {recap && (pub.recap?.awards?.length ?? 0) > 0 && (
            <div className="flex gap-3 justify-center enter" style={{ position: "relative", zIndex: 60 }}>
              {pub.recap!.awards!.map((a) => (
                <div key={a.t} className="card !p-2 !px-3 text-left min-w-[180px]" style={{ borderColor: a.team != null ? tc(a.team) : undefined }}>
                  <div className="eyebrow text-12" style={{ color: "var(--color-gold)" }}>{a.spoon ? "🥄" : "🏆"} {a.t}</div>
                  <div className="text-16 font-bold" style={{ color: a.team != null ? tc(a.team) : undefined }}>{a.who}</div>
                  {a.note && <div className="text-12 text-[var(--color-ink-2)] italic">{a.note}</div>}
                </div>))}
            </div>)}
          {recap && recapLines(pub).length > 0 && (
            <div className="card enter text-left max-w-[1000px] !py-2" style={{ position: "relative", zIndex: 60 }}>
              <div className="eyebrow text-13 mb-0.5" style={{ color: "var(--color-gold)" }}>The night in a nutshell</div>
              <ul className="flex flex-col text-18 leading-snug">{recapLines(pub).map((l) => <li key={l}>{l}</li>)}</ul>
            </div>)}
          {(pub.flags?.length ?? 0) > 0 && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px]">Left the game screen during a question: {awayTotals(pub)}</div>}
        </>)}
        {pub.contest && <ContestBanner pub={pub} />}
        {pub.agree?.kind === "score" && <AgreeBanner pub={pub} />}
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
            {pub.agree?.kind === "swap" ? <SwapAsk pub={pub} /> : (<>
              <div className="display" style={{ fontSize: 140, color: "var(--color-gold)" }}>Paused</div>
              <div className="text-26 text-[var(--color-ink-2)] mt-2">The question comes back when the clock restarts.</div></>)}
          </div>
        </div>)}
      <AwayFlags pub={pub} />
      {/* between questions: a soft glow in the leader's colour (29 Oct); it fades out when a question comes up */}
      <div className="tv-glow" style={{ ["--c" as string]: pub.glow != null ? tc(pub.glow) : "transparent", opacity: pub.glow != null ? 1 : 0 }} aria-hidden />
      <ImadBubble imad={pub.imad} wait={beat ? Math.max(0, screenAt + BEAT_MS - Date.now()) : 0} />
      <LeadBanner shown={shown} names={[T[0].name, T[1].name]} sound={sound} lift={pub.screen !== "answer"} />
      {/* the strip along the bottom, kept clear of the screen's content: news (a call changed, the host is away,
          a refused tap) and who taps Next, small, on the right */}
      <div className="tv-foot" role="status" aria-live="polite">
        {/* the end: the two buttons live here, in the strip nothing else can push off the stage */}
        {pub.screen === "final" && (onAgain || onExit) && <div className="flex gap-3 mr-auto" style={{ pointerEvents: "auto" }}>
          {onAgain && <button className="btn btn-sm" onClick={onAgain}>Play again: same teams</button>}
          {onExit && <button className="btn btn-sm btn-ghost" onClick={onExit}>Exit: everyone back to the home screen</button>}
        </div>}
        {toastOn && <span key={pub.toast!.id} className="tv-note enter">{pub.toast!.text}</span>}
        {pub.nextBy && !pub.contest && <NextHint pub={pub} />}
      </div>
    </div>
  );
}

const pointsEach = (n: number) => `${n} point${n === 1 ? "" : "s"} each`;
const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };

/* who buzzed, and who is out (Guess the Cocktail or Dish, sudden death) */
function Buzzed({ pub }: { pub: Pub }) {
  const T = pub.teams;
  if (pub.buzz != null) return (
    <div className="flex flex-col items-center gap-3">
      <div className="display text-60 enter" style={{ color: tc(pub.buzz) }}>{T[pub.buzz].name} buzzed!</div>
      {/* the time they have to type it */}
      {pub.typeBy && <div className="flex items-center gap-4 text-24"><Clock deadline={pub.typeBy} size={80} /><span>to type it</span></div>}
    </div>);
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

/* A split-flap board (the old airport kind): every letter cycles through the alphabet, then lands, one after
   another left to right; words wrap whole. start: ms before it begins. With "reduce motion", just the text. */
const FLAPS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function SplitFlap({ text, size, start = 0 }: { text: string; size: number; start?: number }) {
  const final = text.toUpperCase();
  const still = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(() => (still ? final : final.replace(/\S/g, " ")));
  useEffect(() => {
    if (still) { setShown(final); return; }
    const t0 = Date.now() + start;
    const tick = () => {
      const el = Date.now() - t0;
      let done = true;
      setShown([...final].map((ch, i) => {
        if (ch === " ") return " ";
        if (el >= 380 + i * 55) return ch;
        done = false;
        return el < i * 55 ? " " : FLAPS[(Math.floor(el / 50) * 7 + i * 13) % FLAPS.length];
      }).join(""));
      if (done) clearInterval(iv);
    };
    const iv = setInterval(tick, 50);
    return () => clearInterval(iv);
  }, [final, start, still]);
  let k = 0;
  return (
    <div className="flap" style={{ fontSize: size }} aria-label={text}>
      {final.split(" ").map((w, wi) => { const at = k; k += w.length + 1; return (
        <span key={wi} className="flap-word" aria-hidden>{[...w].map((_, ci) => <span key={ci} className="flap-t"><span>{shown[at + ci] ?? ""}</span></span>)}</span>); })}
    </div>);
}

/* Closest To Wins: a ruler with the answer in the middle. A guess under the answer sits to its left, over it to
   its right, the farther one near the end; A's card above the ruler, B's below. The pins drop in, then a band
   in the team's colour runs from the answer out to each guess: the longer the band, the further off. */
function NumberLine({ pub, ans, w }: { pub: Pub; ans: number; w: 0 | 1 | "tie" | "none" | null | undefined }) {
  const T = pub.teams, g = pub.reveal?.guesses || [];
  const far = Math.max(...[0, 1].map((t) => (g[t] == null ? 0 : Math.abs(Number(g[t]) - ans))), 0);
  const at = (t: number) => (g[t] == null || !far ? 50 : 50 + ((Number(g[t]) - ans) / far) * 42);
  return (
    <div className="ruler relative w-[1040px] h-[210px]" style={QUICK}>
      <div className="ruler-track"><span className="ruler-ticks" /></div>
      {([0, 1] as const).map((t) => { const gss = g[t]; if (gss == null) return null; const x = at(t); return (
        <div key={"b" + t} className={"ruler-band " + (t ? "b" : "a")} style={{ left: Math.min(x, 50) + "%", width: Math.abs(x - 50) + "%", background: tc(t), transformOrigin: x < 50 ? "right" : "left", ...d(0.5 + t * 0.12) }} />); })}
      <div className="ruler-mid"><span className="lbl">answer</span></div>
      {([0, 1] as const).map((t) => { const gss = g[t], x = at(t), win = w === t || w === "tie"; if (gss == null) return (
        <div key={t} className={"ruler-none " + (t ? "b" : "a")}><b style={{ color: tc(t) }}>{T[t].name}</b> · no answer</div>);
        const off = offBy(gss, ans), side = x < 18 ? "l" : x > 82 ? "r" : "c";
        return (
        <div key={t} className={"ruler-pin " + (t ? "b" : "a") + (win ? " win" : "")} style={{ left: x + "%", ["--c" as string]: tc(t), ...d(0.12 + t * 0.14) }}>
          <span className="stem" /><span className="dot" />
          <span className={"card-l " + side}>
            <span className="nm" style={{ color: tc(t) }}>{T[t].name}</span>
            <span className="v display">{showNum(gss)}</span>
            <span className="off">{off === 0 ? "spot on!" : "off by " + showNum(off)}</span>
          </span>
        </div>); })}
    </div>);
}

/* the Auction's run: a notch per answer counted, up to the bid. A big bid (over 12) is one bar instead, marked
   every 5, so 25 never means 25 dots. Full, it glows green. */
function BidBar({ n, of, color }: { n: number; of: number; color: string }) {
  if (!of) return null;
  const full = n >= of;
  if (of > 12) return (
    <div className={"bid-bar relative w-[760px] h-[22px] " + (full ? "full" : "")} aria-hidden>
      <span style={{ width: Math.min(100, (100 * n) / of) + "%", background: full ? undefined : color }} />
      {Array.from({ length: Math.floor((of - 1) / 5) }, (_, i) => <i key={i} style={{ left: (100 * (i + 1) * 5) / of + "%" }} />)}
    </div>);
  return (
    <div className={"bid-notches flex gap-2 " + (full ? "full" : "")} aria-hidden>
      {Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? "on" : ""} style={i < n && !full ? { background: color } : undefined} />)}
    </div>);
}

/* the mini-games on the TV */
function TvMini({ pub, join }: { pub: Pub; join?: Join }) {
  const T = pub.teams, m = pub.mini, sc = pub.screen;
  if (!m) return null;
  /* Majority Rules: before it starts, everyone on their phone: the QR code again, and each team's list */
  if (sc === "majorityIntro") { const L = pub.majority?.list || [], A = pub.majority?.ask; return (
    <div className="flex gap-10 items-start w-full">
      <div className="flex-1 min-w-0"><MiniIntro pub={pub} size="tv" /></div>
      <div className="w-[560px] shrink-0 flex flex-col gap-5 text-left">
        <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>Everyone on their phone</div>
        {join && <div className="flex items-center gap-6">
          <div className="rounded-[18px] p-3 bg-[#f4f6ff] shrink-0"><QRCodeSVG value={join.url} size={170} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
          <div><div className="display leading-none" style={{ fontSize: 88, color: "var(--color-gold)", letterSpacing: "0.08em" }}>{join.code}</div>
            <div className="text-20 text-[var(--color-ink-2)] mt-2">Not in yet? Scan, pick your team, and you&rsquo;re on its list.</div></div>
        </div>}
        <div className="grid grid-cols-2 gap-6">{([0, 1] as const).map((t) => (
          <div key={t} className="flex flex-col gap-1">
            <div className="display text-28" style={{ color: tc(t) }}>{T[t].name} · {L.filter((x) => x.team === t && !x.out).length}</div>
            {L.filter((x) => x.team === t).map((x) => (
              <div key={x.name} className="text-22 flex items-center gap-2" style={{ opacity: x.out ? 0.4 : 1, textDecoration: x.out ? "line-through" : undefined }}>
                <span style={{ color: x.here ? "var(--color-ok)" : "var(--color-ink-3)" }} aria-hidden>{x.here ? "●" : "○"}</span><span className="truncate">{x.name}</span>
                {!x.here && !x.out && <span className="text-16 text-[var(--color-ink-3)]">not here</span>}</div>))}
          </div>))}</div>
        {A && <div className="card text-20" style={{ borderColor: "var(--color-gold)" }} role="status"><b style={{ color: tc(A.team) }}>{T[A.team].name}</b> ask to take <b>{A.name}</b> off their list. The other captain decides.</div>}
      </div>
    </div>); }
  if ((sc === "majorityQ" || sc === "majorityReveal") && pub.majority) { const M = pub.majority, R = M.reveal; return (<>
    <div className="font-bold max-w-[1400px]" style={{ fontSize: (pub.question || "").length > 90 ? 40 : 50, lineHeight: 1.12 }}>{pub.question}</div>
    <div className="grid grid-cols-2 gap-5 w-full max-w-[1400px]">{(M.options || []).map((o, i) => { const ok = R?.answer === o;
      /* the reveal: the wrong answers drop away one after another, then the right one lights up */
      const k = (M.options || []).filter((x, j) => j < i && x !== R?.answer).length;
      return (
      <div key={o} className={"mr-tv-opt " + (R ? (ok ? "ok rev mr-win" : "dim rev mr-out") : "")} style={R ? d(ok ? 0.75 : 0.12 + k * 0.2) : undefined}>
        <span className="flex-1 min-w-0"><bdi>{o}</bdi></span>
        {/* how many on each team picked it: a dot in the team's colour, and the number */}
        {R && <span className="flex gap-5 shrink-0 text-26 mr-counts" aria-label={`${T[0].name} ${R.counts[i]?.[0] ?? 0}, ${T[1].name} ${R.counts[i]?.[1] ?? 0}`}>{[0, 1].map((t) => (
          <span key={t} className="flex items-center gap-2"><span className="inline-block w-4 h-4 rounded-full" style={{ background: tc(t as 0 | 1) }} aria-hidden /><b>{R.counts[i]?.[t] ?? 0}</b></span>))}</span>}
      </div>); })}</div>
    {/* the fact behind the answer, right under it, for the whole room */}
    {R?.notes && <div className="max-w-[1300px] text-28 leading-snug -mt-1" style={{ color: "var(--color-gold)" }}>{R.notes}</div>}
    {R && pub.mrFire && <div className="text-26 font-bold enter">{pub.mrFire.map((f) => <span key={f.name} className="mx-3"><span className="flame">🔥</span>{f.name} · {f.n} in a row</span>)}</div>}
    {!R ? (
      <div className="flex items-center gap-12">
        <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
        <div className="flex flex-col gap-1 text-left">{[0, 1].map((t) => (
          <span key={t} className="font-bold text-26" style={{ color: tc(t as 0 | 1) }}>{T[t].name}: {M.answered?.[t] ?? 0} of {M.n?.[t] ?? 0} answered</span>))}</div>
      </div>) : (
      <div className="flex flex-col items-center gap-2">
        {/* this question; the game so far is in the bar at the top, which counts this question already */}
        <div className="text-26">This one: {[0, 1].map((t) => <span key={t}>{t ? " · " : ""}<b style={{ color: tc(t as 0 | 1) }}>{T[t].name}</b> {R.right[t]} of {M.n?.[t] ?? 0} right</span>)}</div>
        {/* with no fact to tell, the game so far (the bar above has it too) */}
        {!R.notes && <div className="text-20 text-[var(--color-ink-2)]">So far: {M.totals?.right[0]} of {M.totals?.of[0]} answers right, and {M.totals?.right[1]} of {M.totals?.of[1]}</div>}
      </div>)}
  </>); }
  if (/Intro$/.test(sc)) return (<>
    {/* the Battle: the two captains fly in from their sides, VS slams down between them */}
    <div className="w-full max-w-[1080px]"><MiniIntro pub={pub} size="tv" head={sc === "battleIntro" && pub.captains ? (
      <div className="flex items-center justify-center gap-8 w-full -mb-2" aria-label={`${pub.captains[0]} versus ${pub.captains[1]}`}>
        <div className="display vs-in a text-48 text-right flex-1 truncate" style={{ color: tc(0) }}><bdi>{pub.captains[0] || T[0].name}</bdi></div>
        <div className="display vs-x text-60" style={{ color: "var(--color-gold)" }}>VS</div>
        <div className="display vs-in b text-48 text-left flex-1 truncate" style={{ color: tc(1) }}><bdi>{pub.captains[1] || T[1].name}</bdi></div>
      </div>) : undefined} /></div>
  </>);
  if (sc === "miniQ") return (<>
    <div className="font-bold max-w-[1000px]" style={{ fontSize: 50, lineHeight: 1.15 }}>{pub.question}</div>
    <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={150} />
    <Sent pub={pub} />
  </>);
  if (sc === "closestReveal" && pub.reveal) {
    const ans = Number(pub.reveal.answer), w = pub.reveal.w;
    return (<>
      <div className="eyebrow text-18">The answer</div>
      <div className="display" style={{ fontSize: 80, color: "var(--color-gold)" }}>{pub.reveal.answer}</div>
      {pub.reveal.notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] -mt-2 truncate">{pub.reveal.notes}</div>}
      <NumberLine pub={pub} ans={ans} w={w} />
      <div className="display text-44" style={{ color: tc(w === 0 || w === 1 ? w : null) }}>{w === "tie" ? "A point each" : w === 0 || w === 1 ? `${T[w].name} takes it` : ""}</div>
    </>);
  }
  if ((sc === "flagQ" || sc === "flagReveal") && pub.flag) return (<>
    <FlagImg name={pub.flag} h={sc === "flagQ" ? 300 : 220} maxW={520} />
    {sc === "flagQ" ? (<><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} /><Sent pub={pub} /></>) : (<>
      <div className="display beat slam" style={{ ...QUICK, fontSize: 90, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
      <TeamRows pub={pub} empty="No answer" />
    </>)}
  </>);
  /* Drop the Pin: the photo while they place their pins; then the map, flying in to the spot */
  if (sc === "pinQ" && pub.pin) return (
    <div className="flex gap-12 items-center w-full justify-center">
      <div className="flex-1 min-w-0 flex justify-center"><PinPhoto pin={pub.pin} h={460} credit /></div>
      <div className="w-[360px] flex flex-col items-center gap-5">
        <div className="display text-44" style={{ color: "var(--color-gold)" }}>Where is this?</div>
        <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
        <div className="flex flex-col items-center gap-1" role="status">{[0, 1].map((t) => (
          <span key={t} className="font-bold" style={{ fontSize: 22, color: pub.sent?.[t] ? tc(t as 0 | 1) : "var(--color-ink-3)" }}>{T[t].name}: {pub.sent?.[t] ? "pin in" : "placing…"}</span>))}</div>
      </div>
    </div>);
  if (sc === "pinReveal" && pub.pin?.reveal) { const R = pub.pin.reveal, w = pub.reveal?.w; return (
    <div className="flex gap-10 items-center w-full">
      <div className="flex-1 min-w-0"><PinMap marks={pinMarks(pub)} fly height={490} size={1.6} interactive={false} label={`Where it is: ${R.place}`} /></div>
      <div className="w-[380px] flex flex-col items-center gap-3 pb-10">
        <div className="eyebrow text-16">It&rsquo;s here</div>
        <div className="display text-36 leading-tight" style={{ color: "var(--color-gold)" }}>{R.name}</div>
        <div className="text-22 text-[var(--color-ink-2)] -mt-1">{R.place}</div>
        {[0, 1].map((t) => (
          <div key={t} className="flex flex-col items-center" style={{ opacity: w === t || w === "tie" ? 1 : 0.6 }}>
            <div className="display text-22" style={{ color: tc(t as 0 | 1) }}>{T[t].name}</div>
            <div className="display text-40">{R.pins[t] ? showKm(R.km[t] ?? 0) : "No pin"}{R.pins[t] && <span className="text-22 text-[var(--color-ink-2)]"> off</span>}</div>
          </div>))}
        <div className="display text-36 mt-6" style={{ color: tc(w === 0 || w === 1 ? w : null) }}>{w === "tie" ? "A point each" : w === 0 || w === 1 ? `${T[w].name} takes it` : "No point"}</div>
      </div>
    </div>); }
  /* Guess the Airport: the board, then its name */
  if ((sc === "airportQ" || sc === "airportReveal") && pub.airport) return (
    <div className="flex gap-10 items-center w-full">
      <div className="flex-1 min-w-0"><Board air={pub.airport} size="tv" flip={sc === "airportQ"} /></div>
      <div className="w-[380px] flex flex-col items-center gap-4">
        {sc === "airportQ" ? (<>
          <div className="display text-44" style={{ color: "var(--color-gold)" }}>Which airport?</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
          <Sent pub={pub} />
        </>) : (<>
          <div className="eyebrow text-16">The airport</div>
          {/* the airport's name comes up on a split-flap board: each letter clatters through the alphabet and lands, left to right */}
          <SplitFlap text={pub.reveal?.answer || ""} size={30} />
          {pub.airport.code && <div className="text-24 flex items-center gap-3"><SplitFlap text={pub.airport.code} size={26} start={300} /> · {pub.airport.city}</div>}
          {pub.airport.cityOk === false && <div className="text-18 font-bold text-center" style={{ color: "var(--color-gold)" }}>{pub.airport.city} alone doesn&rsquo;t count: it has more than one big airport.</div>}
          {pub.reveal?.notes && <div className="text-16 text-[var(--color-ink-2)] leading-snug text-left">{pub.reveal.notes}</div>}
          <TeamRows pub={pub} empty="No answer" small />
        </>)}
      </div>
    </div>);
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
            <div className="display beat slam" style={{ fontSize: 76, color: "var(--color-gold)" }}>{pub.reveal?.answer}</div>
            {(pub.calls || []).map((c, i) => <div key={c.id} className="text-22 flex items-baseline gap-2 beat" style={d(0.1 + i * 0.12)}><b style={{ color: tc(c.team) }}>{T[c.team].name}:</b> {c.text || "no answer"} <Verdict v={c.ok} size={18} stamp /></div>)}
            <div className="display text-36 beat" style={{ ...d(0.35), color: tc(pub.reveal?.w === 0 || pub.reveal?.w === 1 ? pub.reveal.w : null) }}>
              {pub.reveal?.w === 0 || pub.reveal?.w === 1 ? `${T[pub.reveal.w].name} got it` : "Nobody got it"}</div>
          </>)}
        </div>
      </div>);
  }
  if ((sc === "mapQ" || sc === "mapReveal") && pub.map) return (
    <div className="flex gap-10 items-center w-full" style={{ fontSize: 22 }}>
      <div className="flex-1 min-w-0"><MapView id={pub.map.id} reveal={pub.map.reveal} hint={!!pub.map.hint} maxH={480} title={pub.map.title} wipe /></div>
      <div className="w-[340px] flex flex-col items-center gap-4">
        {sc === "mapQ" ? (<>
          <div className="display text-40" style={{ color: "var(--color-gold)" }}>What does this map show?</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
          <Sent pub={pub} />
        </>) : (<>
          <div className="eyebrow text-16">The map shows</div>
          <div className="display text-40 beat slam" style={{ ...QUICK, color: "var(--color-gold)" }}>{pub.map.title}</div>
          <TeamRows pub={pub} empty="No answer" small />
        </>)}
      </div>
    </div>);
  /* won early: who, the score, the points; then only that the rest is for fun, and who chooses */
  if (sc === DECIDED && pub.decided) { const D = pub.decided; return (<>
    <MiniTitle title={m.title} />
    <div className="display slam" style={{ fontSize: 88, color: tc(D.winner) }}>{decidedHead(pub)}</div>
    {m.wins && <ScoreBoard pub={pub} w={m.wins} win={D.winner} size="tv" />}
    <div className="flex items-center gap-5">
      <span className="display text-36 pts-pill" style={{ color: tc(D.winner) }} data-fly-src={D.winner}>{decidedPts(pub)}</span>
      <span className="text-24 text-[var(--color-ink-2)]">{decidedFun(pub)}</span>
    </div>
    <div className="text-24 mt-1">Play on, or stop here? <b>{decidedWho(pub)}</b> decides.</div>
  </>); }
  if (TIE_SCREENS.includes(sc)) return (<>
    <MiniTitle title={m.title} />
    <div className="display" style={{ fontSize: 100, color: "var(--color-gold)" }}>{tieHead(pub)}</div>
    <div className="text-28 text-[var(--color-ink-2)]">{tieCall(pub)}</div>
  </>);
  if (pub.auction && /^auction(Bid|Run|Leg|Result)$/.test(sc)) {
    const A = pub.auction;
    if (sc === "auctionBid") return (<>
      <div className="eyebrow text-20">Category</div>
      <div className="display max-w-[1100px]" style={{ fontSize: 76, color: "var(--color-gold)", lineHeight: 1.05 }}>{A.cat}</div>
      <div className="display text-60">{A.bid ? <>Bid: <span key={A.bid} className="bump inline-block">{A.bid}</span> <span style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}</span></> : "No bid yet"}</div>
      <div className="text-28" style={{ color: tc(A.turn) }}><b>{T[A.turn].name}</b>: raise{A.bid ? " or pass" : ""}</div>
      <div className="text-24 text-[var(--color-ink-2)]">Whoever wins the bid has <b>{pub.timers?.auction ?? 30} seconds</b> to name them.</div>
    </>);
    if (sc === "auctionRun") return (<>
      <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display text-44" style={{ color: tc(A.by) }}>{A.by != null ? T[A.by].name : ""}: name {A.bid}!</div>
      <div className="display" style={{ fontSize: 170, lineHeight: 1 }}><span key={A.count} className="bump inline-block">{A.count}</span><span className="text-[var(--color-ink-3)]" style={{ fontSize: 80 }}> / {A.bid}</span></div>
      {/* a notch for each one named, up to the bid (a long bid fills a bar); full, it glows */}
      <BidBar n={A.count} of={A.bid} color={tc(A.by)} />
      <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
      {A.countedBy && <div className="text-22 text-[var(--color-ink-2)]">Counted by <b>{A.countedBy}</b></div>}
    </>);
    if (sc === "auctionLeg" && A.last) return (<>
      <div className="text-28 text-[var(--color-ink-2)] max-w-[1000px]">{A.cat}</div>
      <div className="display beat slam" style={{ fontSize: 90, color: A.last.made ? "var(--color-ok)" : "var(--color-no)" }}>{A.last.made ? "Delivered!" : "Short!"}</div>
      <div className="text-30 beat" style={d(0.15)}>{T[A.last.by].name} bid {A.last.bid}, named {A.last.count}.</div>
      <div className="display text-48 beat" style={{ ...d(0.3), color: tc(A.last.won) }}>{T[A.last.won].name} take{A.last.won === A.last.by ? "" : "s"} the leg</div>
    </>);
    if (sc === "auctionResult") return (<>
      <div className="eyebrow text-20">The Auction</div>
      <ScoreBoard pub={pub} w={A.wins} win={A.winner} size="tv" />
      {A.winner != null && <div className="display text-52" style={{ color: tc(A.winner) }}><span data-fly-src={A.winner}>{T[A.winner].name} +{A.award?.[A.winner] ?? m.pts}</span></div>}
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
    {/* the app's word: a card face down ("?"), turned over */}
    <div className="say-card" aria-label={pub.reveal.answer}><div className="say-inner">
      <div className="face back display" style={{ fontSize: 96 }}>{pub.reveal.answer}</div>
      <div className="face front display" aria-hidden>?</div>
    </div></div>
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
        {calls.filter((c) => c.team === t).map((c) => <div key={c.id} className="text-20 flex items-baseline gap-3"><span className="text-[var(--color-ink-3)] w-6">{c.note}</span><span className="flex-1 truncate">{c.text || "no answer"}{c.answer && !c.ok && <span className="text-[var(--color-ink-3)]"> · {c.answer}</span>}</span><Verdict v={c.ok} size={16} /></div>)}
      </div>))}</div>
  </>); }
  if (pub.battle && sc === "battleSummary") { const B = pub.battle; return (<>
    {B.last && <BattleAnswer last={B.last} size={24} />}
    <MiniTitle title="Battle of the Captains" />
    <ScoreBoard pub={pub} w={B.score} win={B.winner} size="tv" />
    <div className="display text-52" style={{ color: tc(B.winner) }}>{B.winner == null ? (B.note || "Tie") : <span data-fly-src={B.winner}>{`${T[B.winner].name} +${B.award?.[B.winner] ?? m.pts}`}</span>}</div>
    {B.predict && <div className="text-22" style={{ color: "var(--color-gold)" }}>{B.predict}</div>}
    <SdCalls pub={pub} />
  </>); }

  if (/Summary$/.test(sc) && pub.summary) {
    const S = pub.summary;
    return (<>
      <MiniTitle title={m.title} />
      <ScoreBoard pub={pub} w={S.wins} win={S.winner} size="tv" />
      <div className="display text-52" style={{ color: tc(S.winner) }}>
        {S.needsHost ? "Still level: the host decides" : S.winner == null ? <span data-fly-src={(S.award?.[0] ?? 0) > 0 ? "0 1" : undefined}>{pointsEach(S.award?.[0] ?? 0)}</span>
          : <span data-fly-src={S.winner}>{`${T[S.winner].name} +${S.award?.[S.winner] ?? m.pts}`}</span>}</div>
      {S.note && !/^split/i.test(S.note) && <div className="text-22 text-[var(--color-ink-2)]">{S.note}</div>}
      {S.who && <div className="text-22" style={{ color: "var(--color-gold)" }}>{S.who}</div>}
    </>);
  }
  return null;
}

/* a mini-game's name over its result: big, in gold, the way its intro showed it */
function MiniTitle({ title }: { title?: string }) {
  if (!title) return null;
  return <div className="display text-52 leading-none slam" style={{ color: "var(--color-gold)" }}>{title}</div>;
}

/* each team's ruling, then what they wrote under it: "TEAM A  DODGED IT" / "Mcdo" */
function TeamRows({ pub, say, empty, small }: { pub: Pub; say?: boolean; empty: string; small?: boolean }) {
  const T = pub.teams;
  return (
    /* small: a side column, so one team above the other */
    <div className={"flex justify-center " + (small ? "flex-col items-center gap-3" : "gap-20")} style={{ ["--beat" as string]: ".4s" }}>{([0, 1] as const).map((t) => { const ok = pub.reveal?.ok?.[t], x = pub.reveal?.typed?.[t]?.[0]; return (
      <div key={t} className="flex flex-col items-center gap-1 min-w-0 beat" style={d(t * 0.12)}>
        <div className="flex items-baseline gap-3 whitespace-nowrap" style={{ fontSize: small ? 22 : 30 }}>
          <span className="display" style={{ color: tc(t) }}>{T[t].name}</span>
          {ok == null ? null : <Verdict v={ok} say={say} stamp word={ok ? undefined : !x ? "No answer" : say && pub.reveal?.offList?.[t] ? "Not on list" : undefined} />}
        </div>
        {(x || ok == null) && <div className="font-bold" style={{ fontSize: small ? 20 : 28, color: x ? undefined : "var(--color-ink-3)" }}>{x ?? empty}</div>}
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
/* no host: a captain's request (new scores) waiting for the other captain's yes or no */
function AgreeBanner({ pub }: { pub: Pub }) {
  const T = pub.teams, A = pub.agree!, left = useSecondsLeft(A.until), o = A.team === 0 ? 1 : 0;
  return (
    <div className="card enter text-24 max-w-[1300px]" style={{ borderColor: "var(--color-gold)", position: "relative", zIndex: 26 }} role="status">
      <div className="eyebrow text-16 mb-1" style={{ color: "var(--color-gold)" }}>New scores?</div>
      <b style={{ color: tc(A.team) }}>{T[A.team].name}</b>&rsquo;s captain asks for <b style={{ color: tc(0) }}>{T[0].name}</b> {A.a}, <b style={{ color: tc(1) }}>{T[1].name}</b> {A.b}.
      {" "}<b style={{ color: tc(o) }}>{T[o].name}</b>&rsquo;s captain decides<span className="text-[var(--color-ink-2)]"> · {left} s</span>.
    </div>);
}
/* no host: a new question asked for; the clock is stopped (and the question hidden) while the other captain decides */
function SwapAsk({ pub }: { pub: Pub }) {
  const T = pub.teams, A = pub.agree!, left = useSecondsLeft(A.until), o = A.team === 0 ? 1 : 0;
  return (<>
    <div className="display" style={{ fontSize: 120, color: "var(--color-gold)" }}>A new {A.what}?</div>
    <div className="text-30 mt-3 max-w-[1300px]"><b style={{ color: tc(A.team) }}>{T[A.team].name}</b>&rsquo;s captain asks for one. <b style={{ color: tc(o) }}>{T[o].name}</b>&rsquo;s captain decides<span className="text-[var(--color-ink-2)]"> · {left} s</span>.</div>
    <div className="text-24 text-[var(--color-ink-2)] mt-2">The clock is stopped meanwhile.</div>
  </>);
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
  const open = useAfter(pub.nextOpenAt), auto = useSecondsLeft(pub.autoAt);
  if (pub.autoAt && auto > 0) return <span className="next-hint">Next in <b>{auto} s</b>, or <b>{pub.nextBy}</b> taps Next</span>;
  const label = /Intro$|^roundIntro$/.test(pub.screen) || pub.screen === "battleHandoff" ? "Start" : pub.screen === "sudden" ? "Go" : "Next";
  return <span className="next-hint">Waiting for <b>{pub.nextBy}</b>{open && pub.nextOther ? <> or <b>{pub.nextOther}</b></> : null} to {TIE_SCREENS.includes(pub.screen) || pub.screen === DECIDED ? "choose" : `tap ${label}`}</span>;
}

/* Imad's line: his face and a speech bubble, up top, for as long as it takes to read (Classic's #hostBubble) */
/* wait: on a reveal with a drumroll he speaks on its hit, not before it (he'd give the answer away) */
function ImadBubble({ imad, wait = 0 }: { imad?: Pub["imad"]; wait?: number }) {
  const [on, setOn] = useState<number | null>(null);
  const id = imad?.id ?? null, len = imad?.text.length ?? 0;
  const delay = useRef(wait);
  delay.current = wait;
  useEffect(() => {
    if (id == null) return;
    const w = delay.current;
    const a = setTimeout(() => setOn(id), w), b = setTimeout(() => setOn(null), w + 2800 + len * 60);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [id, len]);
  if (!imad || on !== imad.id) return null;
  return (
    <div className={"imad-bubble" + (imad.mood ? " " + imad.mood : "")} role="status" aria-live="polite" key={imad.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/imad.webp" alt="" />
      <div className="hb-text">{imad.text}</div>
    </div>);
}

/* the chart of the night: both scores, drawing themselves across (29 Oct) */
function NightChart({ pub }: { pub: Pub }) {
  const C = pub.recap!.chart!, W = 1000, H = 84, n = C.length, max = Math.max(1, ...C.map((p) => Math.max(p[0], p[1])));
  const x = (i: number) => (i / (n - 1)) * W, y = (v: number) => H - 8 - (v / max) * (H - 16);
  const line = (t: 0 | 1) => C.map((p, i) => `${x(i).toFixed(1)},${y(p[t]).toFixed(1)}`).join(" ");
  return (
    <svg className="night-chart enter" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="The scores through the night">
      <line x1={0} y1={H - 8} x2={W} y2={H - 8} stroke="rgba(255,255,255,.14)" strokeWidth={2} />
      {([0, 1] as const).map((t) => <polyline key={t} points={line(t)} fill="none" stroke={tc(t)} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-line" style={{ animationDelay: t ? ".3s" : "0s" }} />)}
      {([0, 1] as const).map((t) => <text key={"l" + t} x={W - 4} y={y(C[n - 1][t]) + (t ? 22 : -10)} textAnchor="end" fill={tc(t)} fontSize={18} fontWeight={800}>{pub.teams[t].score}</text>)}
    </svg>);
}
