"use client";
/* MANY TEAMS: the pieces the TV and every phone share, each the two-team one (components/GameParts.tsx)
   drawn for 3 to 8 teams: the tracker, the game's intro with its rules, the board of columns (a result, the
   standings), the ranked lists of a reveal, and the phone's Scores sheet. Same classes, same words. */
import { SK_ABOVE, SK_BAND2, skBand, skRules } from "../Stakes";
import { RR_RULE3, rrRule1, rrRule2 } from "@/lib/roulette";
import { cbResultDone, cbResultHead, cbRevealHead, comebackSays } from "@/lib/comeback";
import { QMB } from "@/lib/engine";
import { foolDone } from "@/lib/fool";
import { CodeTiles, motionOff } from "../Marquee";
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { IntroFrame, Roll } from "../GameParts";
import { showKm } from "@/lib/game";
import { AIRPORT } from "@/lib/minis/airport";
import { MAP } from "@/lib/minis/map";
import { SAY } from "@/lib/minis/say";
import { DISH } from "@/lib/minis/dish";
import { MAJ } from "@/lib/minis/majority";
import { FOOL } from "@/lib/minis/fool";
import { unitCount, unitTitle } from "@/lib/minis/units";
import { CLOSEST } from "@/lib/minis/closest";
import { PIN } from "@/lib/minis/pin";
import { FLAG } from "@/lib/minis/flag";
import { SEE_RULE1, SEE_RULE2 } from "@/lib/see";
import { LETTERS, PLACE_PTS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import type { Member } from "@/lib/room";
import { playSound } from "@/lib/sound";
import { signedPts, skRowAt } from "@/lib/stakes";

export type Size = "tv" | "phone";
/* the team's letter in its dot: eight colours never need telling apart */
export function Dot({ t, color, size = 18 }: { t: number; color: string; size?: number }) {
  return <span className="dot ltr" aria-hidden style={{ background: color, width: size, height: size, fontSize: size >= 24 ? 13 : size >= 16 ? 11 : 8, boxShadow: `0 0 12px ${color}` }}>{LETTERS[t]}</span>;
}
/* how the teams are packed: up to four sit side by side as the two do; five and six squeeze; seven and eight stack */
export const packing = (k: number) => (k > 5 ? "stack" : k > 4 ? "mid" : "");
/* columns for a board or a grid of teams: all in one row up to four, then rows of three or four */
export const colsFor = (k: number) => (k <= 4 ? k : k <= 6 ? 3 : 4);

export const place = (n: number) => ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][n] || `${n}th`;
export const pct = (x: number) => `${Math.round(100 * x)}%`;
/* who leads the night (one team, or nobody when the top is shared) */
export function leader(pub: PubMany): number | null {
  const best = Math.max(...pub.teams.map((t) => t.score));
  const top = pub.teams.map((t, i) => (t.score === best ? i : -1)).filter((i) => i >= 0);
  return best > 0 && top.length === 1 ? top[0] : null;
}
/* who takes this leg, in words, and whose colour it's said in (the TV and every phone say the same) */
export function takes(pub: PubMany): { text: string; color: string } {
  const w = pub.reveal?.winners || [], T = pub.teams;
  /* sudden death, the same words on the TV and every phone (the reviewers, 31 Oct) */
  if (pub.game?.key === "sudden") { const f = (pub.reveal?.places || []).findIndex((p) => p === 1), t = f >= 0 ? f : w[0];
    return w.length ? { text: `${T[t].name} win the night!`, color: T[t].color } : { text: "Nobody got it: another one", color: "var(--color-ink-2)" }; }
  /* the comeback: who is still in it after this question (all three right, or nothing) */
  if (pub.game?.key === "comeback" && pub.comeback) { const c = pub.comeback;
    return cbRevealHead(c.teams.filter((t) => !c.out[t] && pub.reveal?.ok?.[t]), c.i >= c.of - 1, T); }
  return takeText(w, T);
}
/* ...the words, the same in every setup (the 2-team host's reveal says it too: 22 Nov, the owner) */
/* (nobody: "Nobody gets it", every game, every setup: 23 Nov, the owner) */
export function takeText(w: number[], T: { name: string; color: string }[]): { text: string; color: string } {
  if (!w.length) return { text: "Nobody gets it", color: "var(--color-ink-2)" };
  if (w.length === 1) return { text: `${T[w[0]].name} take it`, color: T[w[0]].color };
  if (w.length === T.length) return { text: "Everyone takes it", color: "var(--color-gold)" };
  return { text: `${w.length} teams take it`, color: "var(--color-gold)" };
}
/* a game's result, in words: who came 1st and what it pays ("TEAM A +10", "LIONS & OWLS TIED FOR 1ST, +10 EACH": "tied", never "share", 26 Nov, the owner's rule for ties) */
export function paid(pub: PubMany): { text: string; color: string } {
  const S = pub.summary, T = pub.teams;
  /* the comeback: who is back in it */
  if (pub.game?.key === "comeback" && pub.comeback) return cbResultHead(pub.comeback, T);
  const top = (S?.places || []).map((p, t) => (p === 1 && (S?.award[t] ?? 0) > 0 ? t : -1)).filter((t) => t >= 0);
  /* (every team on 0 still gets last place's points: "Nobody scored: +6 each", not "Nobody scores", 24 Nov, the owner) */
  if (!top.length) { const a = S?.award || [], v = a[0] ?? 0;
    return { text: v > 0 && a.every((x) => x === v) ? `Nobody scored: +${v} each` : "Nobody scores", color: "var(--color-ink-2)" }; }
  if (top.length === 1) return { text: `${T[top[0]].name} +${S!.award[top[0]]}`, color: T[top[0]].color };
  return { text: `${top.length > 2 ? `${top.length} teams` : top.map((t) => T[t].name).join(" & ")} tied for 1st, +${S!.award[top[0]]} each`, color: "var(--color-gold)" };
}
/* the teams in the order of a reveal: the nearest first, the ones with nothing at the end */
export const byDistance = (pub: PubMany) => {
  const off = pub.reveal?.off || [];
  return pub.teams.map((_, i) => i).sort((a, b) => (off[a] == null ? 1 : 0) - (off[b] == null ? 1 : 0) || (off[a] ?? 0) - (off[b] ?? 0) || a - b);
};

/* what one go of a game is called, in plain words (no "leg": the reviewers, 31 Oct): "Flag 3 of 10", "Recipe 2 of 5" */
export const unitOf = (key: string) => unitTitle(key);   // (one list for every setup, lib/minis/units.ts)
/* Secret Stakes' reveal: a row's points start up 150 ms after the row comes in, and reach the total about 1 s later
   (78% of the 1.3 s flight in globals.css), when the total rolls */
const SK_RISE = 150, SK_LAND = SK_RISE + 1000;
/* ---- the tracker: the room code, the teams along the top, the night's label and pips under them, then this game's tally.
   The phone keeps the label, the pips and the night's standings, your team lit. ---- */
/* the phone during a game (24 Nov, the owner's pick, C): this game's points only, in this game's order with each team's
   place, your team boxed in its colour; the night's totals come back on a game's rules and result, and your name (top
   left) always has them. Two rows at most: from four teams the others are their lettered dot, yours says "You"; from six,
   four to a row */
function GameRow({ T, g, me, pc }: { T: PubMany["teams"]; g: NonNullable<PubMany["game"]>; me?: number | null; pc: boolean }) {
  const k = T.length, named = k <= 3, grid = k > 5;
  const pts = (i: number) => (pc ? g.shares?.[i] ?? 0 : g.pts[i] ?? 0), val = (i: number) => (pc ? pct(g.shares?.[i] ?? 0) : String(g.pts[i] ?? 0));
  const rank = (i: number) => 1 + T.filter((_, j) => pts(j) > pts(i)).length;
  const ord = T.map((_, i) => i).sort((a, b) => pts(b) - pts(a) || a - b);
  return (
    <div className="flex flex-col items-center gap-1 mt-2" aria-label={`This game: ${ord.map((i) => `${place(rank(i))} ${T[i].name} ${val(i)}`).join(", ")}`}>
      <span className="eyebrow text-[var(--color-ink-3)]" style={{ fontSize: 10 }}>This game</span>
      <div className={"hud-strip !mt-0" + (grid ? " game-grid" : "")}>
        {ord.map((i) => <span key={i} className={"hs" + (i === me ? " me" : "")} style={{ ["--c" as string]: T[i].color }}>
          <span className="hs-rk">{rank(i)}</span><Dot t={i} color={T[i].color} size={named ? 10 : 13} />
          {named ? <bdi className="hs-nm">{T[i].name}</bdi> : i === me ? <span>You</span> : null}<b>{val(i)}</b></span>)}
      </div>
    </div>);
}

export function HudMany({ pub, size, code, me, host, sound = false }: { pub: PubMany; size: Size; code?: string; me?: number | null; host?: boolean; sound?: boolean }) {
  const T = pub.teams, g = pub.game, k = T.length, tv = size === "tv", pc = g?.key === "majority";
  const label = pub.screen === "final" ? <b>Final result</b> : g
    /* (each part whole: on a narrow phone the line breaks at the dot, never inside the game's name) */
    /* (a game's intro: just its name, no "Game 14 of 14": the pips under it say that (22 Nov, the owner)) */
    ? (() => { const sub = g.key === "sudden" ? (pub.screen === "intro" ? "Tied at the top" : `Question ${g.leg}`) : pub.screen === "intro" ? null : pub.screen === "summary" ? "Result" : `${unitOf(g.key)} ${g.leg} of ${g.of}`;
      return <><b className="inline-block">{g.title}</b>{sub && <> &nbsp;·&nbsp; <span className="inline-block">{sub}</span></>}</>; })()
    : null;
  /* a pip a game, as the two-team night's: a dot a question round, a dash a mini-game (the owner, 1 Nov) */
  /* (the comeback sits between two games: none of the pips is "now" while it plays) */
  const pips = g ? Array.from({ length: g.count }, (_, i) => (i < g.index || pub.screen === "final" ? "done" : i === g.index && g.key !== "comeback" ? "now" : "")) : [];
  /* two scores, never on screen together (the owner, 30 Oct): the night's totals, the team row, only between games
     (a game's rules, its result, the end); during a game only its own points, in their own line under its name.
     On a game's result, what each place pays flies up into the totals, then they roll up */
  /* (Secret Stakes: the night's totals throughout, its bets go straight on them; there's no game tally to show) */
  /* (Fool Me Twice's picks too: 25 Nov, the header went back to the night's totals while teams picked) */
  const inGame = !!g && g.key !== "stakes" && (pub.screen === "q" || pub.screen === "reveal" || pub.screen === "pick");
  const award = pub.screen === "summary" ? pub.summary?.award : undefined;
  const [landed, setLanded] = useState(false);
  /* the +points rise once the result's reveal is done (the last team in), and land 1.5 s later */
  const flyAfter = pub.screen === "summary" && pub.summary ? resultDone(pub) : 0;
  useEffect(() => {
    setLanded(false); if (pub.screen !== "summary") return;
    /* as the points land, the TV itself plays the soft "coin in a jar" */
    const t = setTimeout(() => { setLanded(true); if (sound && award?.some((x) => x > 0)) playSound("point"); }, 1500 + flyAfter * 1000);
    return () => clearTimeout(t);
  }, [pub.screen, pub.step]);   // eslint-disable-line react-hooks/exhaustive-deps
  /* Secret Stakes' reveal (12 Nov, the owner: a bet won or lost goes into the total, as points do everywhere): each
     total waits at what it was until its team's row comes up, then the "+8" or the "−24" (in red) rises into it and it
     rolls. With motion off, the totals are as they are */
  const skRev = tv && g?.key === "stakes" && pub.screen === "reveal" ? pub.stakes?.rev : undefined;
  const skKey = skRev ? `${g!.index}:${pub.stakes!.round}` : "";
  const [skIn, setSkIn] = useState<boolean[] | null>(null);
  useEffect(() => {
    if (!skKey || !skRev || motionOff()) { setSkIn(null); return; }
    setSkIn(T.map(() => false));
    const ts = skRev.order.map((t, n) => setTimeout(() => setSkIn((L) => (L ? L.map((v, i) => v || i === t) : L)), skRowAt(n, k) + SK_LAND));
    return () => ts.forEach(clearTimeout);
  }, [skKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const num = (i: number) => (skRev && skIn && !skIn[i] ? skRev.before[i] ?? T[i].score : award && !landed ? T[i].score - (award[i] || 0) : T[i].score);
  const order = award ? T.map((_, i) => i).sort((a, b) => (pub.summary!.places[a] - pub.summary!.places[b]) || a - b) : [];
  /* the pips are the night's games (no "Game 1 of 9" beside them since 22 Nov, the owner: the pips say it, and it saves
     room; the reviewers had asked for it on 31 Oct) */
  const track = pips.length > 0 && <div className={"pips" + (pips.length > 20 ? " long" : "")} aria-hidden>{pips.map((p, i) => <span key={i} className={`pip ${g?.keys && g.keys[i] !== "quiz" ? "mini " : ""}${p}`} />)}</div>;
  return (
    <div className={`hud ${size} many ${packing(k)}${(award && !landed) || (skRev && skIn && skIn.some((v, i) => !v && !!skRev.delta[i])) ? " flying" : ""}`} role="group" aria-label={tv ? "Scores" : "Where we are"}>
      {/* the room code, small, in the TV's top-right corner (the owner, 2 Nov: it matters little once the game is on) */}
      {/* the TV: the room code and the night's tracker (a dot or dash a game) on one line at the top, not
          beside the game's line (the owner, 2 Nov); one line, not two, so a reveal with eight teams clears it (5 Nov review) */}
      {tv && (code ? <div className="hud-top">{<div className="hud-tiles" aria-label={`Room ${code}`}><span>Room</span><CodeTiles code={code} className="mini" /></div>}{track}</div> : track)}
      {tv && !inGame && <div className="hud-in">
        {T.map((t, i) => (
          <div key={i} className="hud-team" style={{ ["--c" as string]: t.color }}>
            <div className="flex items-center gap-2 min-w-0"><Dot t={i} color={t.color} size={k > 5 ? 16 : k > 4 ? 18 : 22} /><div className="nm"><bdi>{t.name}</bdi></div></div>
            {/* the +points rise to the number itself, centred on it */}
            <div className="sc" data-score={i}><Roll v={num(i)} />
              {award && !landed && (award[i] || 0) > 0 && <span className="hud-plus" style={{ animationDelay: flyAfter + order.indexOf(i) * 0.07 + "s" }} aria-hidden>+{award[i]}</span>}
              {skRev && skIn && !!skRev.delta[i] && <span className={"hud-plus sk" + (skRev.delta[i] < 0 ? " neg" : "")} style={{ animationDelay: (skRowAt(skRev.order.indexOf(i), k) + SK_RISE) / 1000 + "s" }} aria-hidden>{signedPts(skRev.delta[i])}</span>}</div>
          </div>))}
      </div>}
      <div className="hud-mid">
        {/* the phone: the night's tracker above the game's line too (the owner, 2 Nov) */}
        {!tv && track}
        {label && <div className="hud-label">{label}</div>}
      </div>
      {/* this game's points, under its name, in their own small line (a dot, the name, the points; on fire beside) */}
      {tv && inGame && g.key !== "sudden" && g.key !== "comeback" && (
        <div className="hud-mini game-line" aria-label={`This game: ${T.map((t, i) => `${t.name} ${pc ? pct(g!.shares?.[i] ?? 0) : g!.pts[i]}`).join(", ")}`}>
          <span>This game</span>
          {T.map((t, i) => <span key={i} className="flex items-center gap-2" style={{ ["--c" as string]: t.color }}><Dot t={i} color={t.color} size={k > 5 ? 18 : 20} /><span className="nm" style={{ color: t.color }}><bdi>{t.name}</bdi></span>
            <b>{pc ? pct(g!.shares?.[i] ?? 0) : <Roll v={g!.pts[i]} />}</b>{pub.fire?.[i] && <span className="flame !mx-0" aria-label="on fire">🔥</span>}</span>)}
        </div>)}
      {/* the phone: the night's standings, small, every team, yours lit (the owner's pick on the 4 Nov audit, decision 3:
          with no TV, nobody could see them during a game) */}
      {!tv && inGame && g.key !== "sudden" && g.key !== "comeback" ? <GameRow T={T} g={g} me={me} pc={pc} /> : !tv && (
        <div className="hud-strip" aria-label={`The night so far: ${T.map((t, i) => `${t.name} ${num(i)}`).join(", ")}`}>
          {T.map((t, i) => (
            <span key={i} className={"hs" + (i === me ? " me" : "")} style={{ ["--c" as string]: t.color }}>
              {/* (6 teams or more: the others as their lettered dot and score, so the strip stays on one or two lines) */}
              <Dot t={i} color={t.color} size={k > 5 && i !== me ? 14 : 10} />{(k <= 5 || i === me) && <bdi className="hs-nm">{t.name}</bdi>}<b>{num(i)}</b>
            </span>))}
        </div>)}
      {/* (no "You're on <team>" line: your team is lit in its colour in the strip above (22 Nov, the owner)) */}
      {!tv && me == null && host && <div className="hud-mini"><span>You&rsquo;re the host</span></div>}
    </div>);
}

/* ---- a game's intro: the title, the gold band, the numbered rules (GameParts' MiniIntro, for N teams) ---- */
function rules(pub: PubMany): (string | { text: string; warn?: boolean })[] {
  /* plain English, only what you need to play (the owner, 31 Oct): no ties, no team counts */
  const g = pub.game!, n = g.of, k = pub.teams.length;
  /* the points, in numbers (the reviewers, 31 Oct): each go pays by place, 1st as many as there are teams; at the
     end the game's places add 10, 8, 6… to the night. With three teams the lists end with a full stop, not dots */
  /* (in full, every place: the card used to stop at "3rd 6…"; and a team that scores nothing is last and gets the
     last place's points, 17 Nov, the owner) */
  const per = k <= 4 ? `1st gets ${k} points, ${Array.from({ length: k - 1 }, (_, i) => `${place(i + 2)} ${k - i - 1}`).join(", ")}. Wrong, nothing.`
    : `1st gets ${k} points, 2nd ${k - 1}, and so on down to 1. Wrong, nothing.`;
  const pay = `The game's places add to the night: ${PLACE_PTS.slice(0, k).map((p, i) => `${place(i + 1)} ${p}`).join(", ")}. Score nothing, add ${PLACE_PTS[k - 1]}.`;
  const fast = `Fastest right answer first: ${per}`;
  switch (g.key) {
    case "majority": return [...MAJ.rules(n, pub.introSecs), MAJ.ruleMany, pay];
    /* the round's themes are in the gold band above ("4 questions – Science & Music"), not said again here (the owner, 31 Oct) */
    case "quiz": return ["Captains type the answer on their phone.", fast, pay];
    case "flag": return [FLAG.rule1(pub.introSecs), fast, pay];
    case "airport": return [AIRPORT.rule1(pub.introSecs), fast, pay];
    case "map": return [MAP.rule1(pub.introSecs), fast, pay];
    /* (no "Wrong, nothing." where nothing is wrong, only further off: 23 Nov, the owner) */
    case "closest": return [CLOSEST.rule1(pub.introSecs), `Closest guess first: ${per.replace(" Wrong, nothing.", "")}`, pay];
    case "pin": return [PIN.rule1(pub.introSecs), `Closest pin first: ${per.replace(" Wrong, nothing.", "")}`, pay];
    case "say": return [SAY.rule1(pub.introSecs), SAY.ruleMany(k), pay];
    case "dish": return [DISH.rule1(pub.introSecs), fast, pay];
    /* What Do You See? (12 Nov, the owner): scored as the Cocktail or Dish is here */
    /* (12 Nov, the owner: a buzzer, said out loud and typed; one team gets a picture, and scores what a 1st place does) */
    case "see": return [SEE_RULE1, { text: SEE_RULE2, warn: true },   // (the same words and the same red in every setup: 23 Nov, the owner)
      `Right, and you score ${k} points. Wrong, and you're out of this picture: the clock goes on and another team can buzz.`, pay];
    /* Russian Roulette (9 Nov, the owner): one barrel, every team spins at once */
    /* (shorter; the bullet is no secret now: everyone sees who drew it once the barrel stops, 11 Nov, the owner) */
    case "roulette": return [rrRule1(pub.introSecs ?? 45), { text: rrRule2(false, n), warn: true }, RR_RULE3,
      `${n} spins. ${pay}`];
    /* Secret Stakes (11 Nov, the owner): the night's last game; a bet is a thirtieth of the leader's total when it starts (a tenth till 12 Nov) */
    case "stakes": { const I = pub.skIntro; return skRules(n, I?.unit ?? pub.stakes?.unit ?? 1, I?.pick ?? 20, I?.q ?? 45); }   // (one card, every setup: components/Stakes.tsx)
    /* Fool Me Twice (16 Nov, the owner): the two-team card's words, for N teams */
    case "fool": return [FOOL.rule1(pub.foolSecs?.[0] ?? 45), { text: FOOL.rule2, warn: true }, FOOL.rule3(pub.foolSecs?.[1] ?? 20, true),
      "The truth: +2. Each team that falls for your lie: +1 to you. The team you named falls for it? −1 to them, +1 more to you.",
      `${n} facts, the last 2 hard. ${pay}`];
    case "sudden": { const L = (g.only || []).map((t) => pub.teams[t].name), names = L.length > 1 ? `${L.slice(0, -1).join(", ")} & ${L[L.length - 1]}` : L.join("");
      /* (7 Nov, the owner: what sudden death means, said before it starts, as with two teams) */
      return [`${names} are tied at the top: sudden death.`, "One question at a time, and only their captains answer: type it and send it. The first right answer wins the night.",
        "Wrong, and you're out of that question. Nobody right? Another question."]; }
    /* (the comeback has a screen of its own, components/Comeback.tsx: these are the same words, as a list) */
    case "comeback": return [comebackSays((g.only || []).map((t) => pub.teams[t].name)), `${n} easy questions, ${QMB.COMEBACK_SECS} seconds each. All ${n} right, or nothing.`];
  }
}
/* compact: the TV's Majority Rules intro, which shares the screen with the QR code */
export function IntroMany({ pub, size, head, compact }: { pub: PubMany; size: Size; head?: ReactNode; compact?: boolean }) {
  const g = pub.game, tv = size === "tv";
  if (!g) return null;
  /* how many, in plain words ("5 questions", "10 flags"): no "Best of", every one counts */
  const count = unitCount(g.key, g.of);
  /* a question round names its themes in the band, in the order they come (the owner, 31 Oct) */
  const th = g.key === "quiz" ? g.themes || [] : [];
  /* "Food & Drink and Friends", not "Food & Drink & Friends", when a theme has its own "&" */
  const band = g.key === "sudden" ? "First right wins" : g.key === "stakes" ? skBand(g.of) : g.key === "dish" && pub.dishKinds ? `${count} · ${pub.dishKinds}` : th.length ? `${count} – ${th.length > 2 ? `${th.slice(0, -1).join(", ")} and ${th[th.length - 1]}` : th.join(th.some((x) => x.includes("&")) ? " and " : " & ")}` : count;   // (three themes, a game of three rounds: "A, B and C")
  /* ("Game 2 of 5" is in the tracker right above: not said twice, the owner, 31 Oct; Secret Stakes' band as with two
     teams, 22 Nov; the frame: GameParts' IntroFrame, every setup, 27 Nov) */
  return <IntroFrame tv={tv} compact={compact} title={g.title} rules={rules(pub).map((r) => (typeof r === "string" ? { text: r } : r))}
    head={head || (g.key === "stakes" ? <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>{SK_ABOVE}</div> : undefined)}
    band={[band, ...(g.key === "stakes" ? [SK_BAND2] : [])]} />;
}

/* ---- the board: a column a team, in the order given, each team's number big in its colour and its name under
   it; the columns that didn't take it dimmed (GameParts' ScoreBoard, for N teams). ---- */
export type Col = { t: number; big: string; sub?: ReactNode; place?: number; lit?: boolean };
export function BoardMany({ pub, cols, size, label, width }: { pub: PubMany; cols: Col[]; size: Size; label?: string; width?: number }) {
  const T = pub.teams, k = T.length, tv = size === "tv", dense = k > 4;
  const long = Math.max(...cols.map((c) => c.big.length));
  /* a phone with long numbers (1,000,000) takes two columns, so none is squeezed */
  const n = !tv && long > 4 && k > 3 ? 2 : colsFor(k);
  /* the numbers: a score fits big; a long guess (1,500,000) comes down a size */
  const v = tv ? (dense ? (long > 4 ? 44 : 64) : long > 6 ? 60 : long > 4 ? 80 : 110) : dense ? (long > 4 ? 24 : 32) : long > 4 ? 32 : 44;
  const anyLit = cols.some((c) => c.lit);
  const hasPlace = cols.some((c) => c.place != null);
  return (
    <div className="board-many" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, maxWidth: width ?? (tv ? Math.min(1168, n * (dense ? 290 : 320)) : undefined), margin: "0 auto" }}
      aria-label={`${label ? label + ": " : ""}${cols.map((c) => `${T[c.t].name} ${c.big}`).join(", ")}`}>
      {cols.map((c) => (
        <div key={c.t} className={"col " + (anyLit && !c.lit ? "dim" : "") + (c.place === 1 ? " first" : "")} style={{ ["--c" as string]: T[c.t].color }}>
          {/* the place line on every column once any has one ("—" for none), so the numbers line up across a row (the owner, 31 Oct) */}
          {hasPlace && <div className="place" style={{ fontSize: tv ? (dense ? 15 : 18) : 11 }}>{c.place != null ? place(c.place) : "—"}</div>}
          <div className="v" style={{ fontSize: v }}>{c.big}</div>
          <div className={"nm" + (!tv && dense ? " tight" : "")} style={{ fontSize: tv ? (dense ? 13 : 18) : dense ? 10 : 12 }}><Dot t={c.t} color={T[c.t].color} size={tv ? (dense ? 14 : 18) : 12} /><span><bdi>{T[c.t].name}</bdi></span></div>
          {c.sub && <div className="sub" style={{ fontSize: tv ? (dense ? 15 : 20) : 12 }}>{c.sub}</div>}
        </div>))}
    </div>);
}
/* ---- the bars (the owner's idea for Majority Rules, 30 Oct; it has its ballot boxes now, 13 Nov): a bar a team, as
   tall as its points, in place order, growing up one after another; the points on top, the place, the name and what
   it pays under it. Any game without a look of its own draws its result this way ---- */
export function BarsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, H = dense ? 140 : 150, pc = !!S.shares, best = Math.max(1, ...S.pts);
  const val = (t: number) => (pc ? S.shares?.[t] ?? 0 : S.pts[t] / best), lab = (t: number) => (pc ? pct(S.shares?.[t] ?? 0) : String(S.pts[t]));
  const order = byPlace(S, k);
  const rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={(pc ? "Share right: " : "Points this game: ") + [...order].reverse().map((t) => `${T[t].name} ${lab(t)}`).join(", ")}>
      {order.map((t) => { const v = val(t), paid = S.award[t] > 0, lit = paid && S.places[t] === 1, at = rv.at(t); return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: dense ? 124 : 180, animationDelay: at + "s" }}>
          <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }}>{lab(t)}</div>
          <div className="w-full flex items-end" style={{ height: H }}>
            <div className="bar-grow w-full" style={{ height: Math.max(4, v * H), borderRadius: "12px 12px 3px 3px", animationDelay: at + 0.15 + "s", opacity: paid ? 1 : 0.4,
              background: `linear-gradient(180deg, ${T[t].color}, color-mix(in srgb, ${T[t].color} 35%, transparent))`, boxShadow: lit ? `0 0 28px ${T[t].color}` : undefined }} />
          </div>
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}

/* ---- the new games' results (the owner, 30 Oct: a more creative way than bars), each in its own world. They read left
   to right to the winner, as the Closest To Wins race does: the lowest on the left, the highest on the right, shown one
   by one from the lowest (the owner, 14 Nov: every result the same way); tied teams side by side in team order. The
   board and the flag pole read top down, the winner on top, as boards and poles do ---- */
const byPlace = (S: NonNullable<PubMany["summary"]>, k: number, winnerLast = true) =>
  Array.from({ length: k }, (_, i) => i).sort((a, b) => (winnerLast ? S.places[b] - S.places[a] : S.places[a] - S.places[b]) || a - b);
/* the result's reveal (the owner, 31 Oct: suspense): the teams come in a place at a time, the last place first and the
   winner last; tied teams together. at(t): when team t comes in (s); done: when the last has landed, for the line under
   the picture and the points flying up to the totals */
export function revealOf(S: { places: number[] }, k: number) {
  const step = k <= 3 ? 0.7 : k <= 5 ? 0.55 : 0.4, ps = [...new Set(S.places)].sort((a, b) => b - a);
  return { at: (t: number) => Math.max(0, ps.indexOf(S.places[t])) * step, done: (ps.length - 1) * step + 1 };
}
/* ...and when the whole result is in, for the line under it, the points flying up and the phones' wait: Fool Me Twice's
   lie detector draws its pens first (lib/fool.ts) */
export const resultDone = (pub: PubMany) => (pub.game?.key === "comeback" && pub.comeback ? cbResultDone(pub.comeback) : pub.game?.key === "fool" && pub.summary ? foolDone(pub.summary.places, pub.teams.length) : revealOf(pub.summary!, pub.teams.length).done);
/* under each one: its place, its name, what the place pays the night */
export function Caption({ pub, t, dense }: { pub: PubMany; t: number; dense: boolean }) {
  const S = pub.summary!, T = pub.teams, paid = S.award[t] > 0, lit = paid && S.places[t] === 1;
  return (<>
    <div className="display text-16 leading-none mt-1" style={{ color: lit ? "var(--color-gold)" : "var(--color-ink-3)" }}>{paid ? place(S.places[t]) : "—"}</div>
    {/* a long name wraps to a second line, tracking a touch tighter, rather than running off or being cut (the owner, 31 Oct);
        the letter flows in front of the name's first word, so the second line has the whole width; every name keeps a
        two-line slot, top-aligned, so the places, the names, the glasses and the points stay level across (the owner, 2 Nov) */}
    <div className="flex items-start justify-center w-full" style={{ fontSize: dense ? 11 : 14, height: "2.5em" }}>
      <div className="eyebrow text-center min-w-0 max-w-full" style={{ color: T[t].color, fontSize: "inherit", letterSpacing: ".1em", lineHeight: 1.25, overflowWrap: "anywhere",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        <span className="inline-block align-middle mr-1.5" style={{ marginTop: -2 }}><Dot t={t} color={T[t].color} size={dense ? 14 : 18} /></span><bdi>{T[t].name}</bdi></div></div>
    {/* (a two-team round's lecterns: the big number is already what the round adds) */}
    {!S.noAward && <div className="display leading-none" style={{ fontSize: dense ? 22 : 28, color: paid ? "var(--color-ok)" : "var(--color-ink-3)" }}>{paid ? "+" + S.award[t] : "0"}</div>}
  </>);
}
/* ---- the owner's picks for the results (13 Nov): each game's own object in the middle, moving as the result comes in;
   the number on top, the place, name and points under, the order, the reveal and the light on the winner as before ---- */

/* Russian Roulette: each team's barrel, a chamber filled for each spin: +2 or +3 in its colour, the bullet in brass (+5)
   or red (−3), an empty ring for a miss. The barrel spins to its first chamber, which fills, then clicks round a chamber
   for each spin after; the labels stay upright. Motion off: the barrel stands, filled */
export function BarrelsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, big = k <= 3, size = dense ? 124 : big ? 176 : 150, cw = dense ? 124 : big ? 200 : 180;
  const order = byPlace(S, k), rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const at = rv.at(t), paid = S.award[t] > 0; return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: cw, animationDelay: at + "s" }}>
          <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }}>{S.pts[t]}</div>
          <div className="w-full flex items-end justify-center" style={{ height: size }}>
            <Barrel spins={S.spins?.[t] ?? []} color={T[t].color} size={size} at={at + 0.15} paid={paid} lit={paid && S.places[t] === 1} />
          </div>
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
/* when spin j's chamber comes round to the top, after the barrel starts (s): one spin, then a click a spin (globals.css, .rb-cyl) */
const RB_LAND = (j: number) => 0.45 + 0.3 * j;
/* (six chambers: two teams tied into a 7th or 8th spin, the last chamber holds what the spins from the 6th on added up to, so the barrel still adds up: 14 Nov) */
function Barrel({ spins, color, size, at, paid, lit }: { spins: number[]; color: string; size: number; at: number; paid: boolean; lit: boolean }) {
  const id = "rb" + useId().replace(/[^a-zA-Z0-9]/g, ""), sp = spins.length > 6 ? [...spins.slice(0, 5), spins.slice(5).reduce((a, b) => a + b, 0)] : spins, n = " n" + Math.max(1, sp.length);
  const pos = (j: number) => { const a = ((-90 + 60 * j) * Math.PI) / 180; return [100 + 56 * Math.cos(a), 100 + 56 * Math.sin(a)]; };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden style={{ overflow: "visible", opacity: paid ? 1 : 0.4, filter: lit ? `drop-shadow(0 0 16px ${color})` : undefined }}>
      <defs>
        <radialGradient id={id + "s"} cx="40%" cy="34%" r="78%"><stop offset="0" stopColor="#4b5180" /><stop offset=".55" stopColor="#252a4c" /><stop offset="1" stopColor="#10132b" /></radialGradient>
        <radialGradient id={id + "b"} cx="36%" cy="30%" r="72%"><stop offset="0" stopColor="#fff1b8" /><stop offset=".5" stopColor="#e2b24a" /><stop offset="1" stopColor="#8a6420" /></radialGradient>
      </defs>
      <g className={"rb-cyl" + n} style={{ animationDelay: at + "s" }}>
        <circle cx="100" cy="100" r="94" fill={`url(#${id}s)`} stroke="#9aa2c8" strokeWidth="3" />
        {[0, 1, 2, 3, 4, 5].map((j) => <rect key={"f" + j} x="95.5" y="7" width="9" height="20" rx="4.5" fill="#0b0e24" opacity=".8" transform={`rotate(${60 * j - 30} 100 100)`} />)}
        {[0, 1, 2, 3, 4, 5].map((j) => { const [x, y] = pos(j); return <circle key={"h" + j} cx={x} cy={y} r="25" fill="#05060f" stroke="#5a6088" strokeWidth="2.5" />; })}
        {sp.map((v, j) => { const [x, y] = pos(j), d = at + RB_LAND(j); return (
          <Fragment key={j}>
            <g className="rb-pop" style={{ animationDelay: d + "s" }}>
              {v === 5 ? <><circle cx={x} cy={y} r="23" fill={`url(#${id}b)`} /><circle cx={x} cy={y} r="9" fill="#d9b25a" stroke="#8a6420" strokeWidth="2" /></>
                : v < 0 ? <circle cx={x} cy={y} r="23" fill="#ff5566" stroke="#e2b24a" strokeWidth="3" />
                : v > 0 ? <circle cx={x} cy={y} r="23" fill={color} /> : <circle cx={x} cy={y} r="20" fill="none" stroke={color} strokeWidth="3" opacity=".6" />}
            </g>
            {/* (turned back as the barrel turns, so the number reads upright) */}
            <g className={"rb-up" + n} style={{ animationDelay: at + "s" }}>
              <text x={x} y={y + 9} className="rb-fade" style={{ animationDelay: d + "s", fontFamily: "var(--font-display)" }} textAnchor="middle" fontSize="27" fill={v === 0 ? "#8a92b8" : "#fff"}
                stroke="rgba(6,8,28,.85)" strokeWidth="5" strokeLinejoin="round" paintOrder="stroke">{signedPts(v)}</text>
            </g>
          </Fragment>); })}
        <circle cx="100" cy="100" r="13" fill="#9aa2c8" /><circle cx="100" cy="100" r="5" fill="#05060f" />
      </g>
    </svg>);
}

/* Majority Rules: each team's ballot box, a vote for every 5% right, dropping through the slot one by one and piling up */
export function BallotsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, W = dense ? 124 : 180, H = dense ? 140 : 150, sh = (t: number) => S.shares?.[t] ?? 0;
  const order = byPlace(S, k), rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={"Share right: " + [...order].reverse().map((t) => `${T[t].name} ${pct(sh(t))}`).join(", ")}>
      {order.map((t) => { const at = rv.at(t), paid = S.award[t] > 0; return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: W, animationDelay: at + "s" }}>
          <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }}>{pct(sh(t))}</div>
          <Ballot share={sh(t)} color={T[t].color} W={W} H={H} at={at + 0.15} paid={paid} lit={paid && S.places[t] === 1} />
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
function Ballot({ share, color, W, H, at, paid, lit }: { share: number; color: string; W: number; H: number; at: number; paid: boolean; lit: boolean }) {
  const x0 = W * 0.12, bw = W * 0.76, yT = H * 0.2, yB = H - 3, bh = yB - yT, rh = (bh - 6) / 10, sw = (bw - 14) / 2, h = rh - 2, n = Math.max(0, Math.min(20, Math.round(share * 20)));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ overflow: "visible", display: "block", opacity: paid ? 1 : 0.4, filter: lit ? `drop-shadow(0 0 16px ${color})` : undefined }}>
      <rect x={x0} y={yT} width={bw} height={bh} rx="8" fill="rgba(255,255,255,.045)" stroke="rgba(255,255,255,.32)" strokeWidth="2" />
      {Array.from({ length: n }, (_, i) => { const r = Math.floor(i / 2), x = x0 + 5 + (i % 2) * (sw + 4), y = yB - 4 - (r + 1) * rh + 1, rot = (((i * 37) % 7) - 3) * 1.4;
        return (
          <g key={i} transform={`rotate(${rot} ${x + sw / 2} ${y + h / 2})`}>
            <g className="mr-slip" style={{ animationDelay: (at + i * 0.045).toFixed(3) + "s", ["--dx" as string]: (W / 2 - (x + sw / 2)).toFixed(1) + "px", ["--dy" as string]: (yT - 30 - y).toFixed(1) + "px" }}>
              <rect x={x} y={y} width={sw} height={h} rx="2" fill={color} />
              <path d={`M${x + sw * 0.36},${y + h * 0.5} l${sw * 0.09},${h * 0.26} l${sw * 0.2},${-h * 0.52}`} fill="none" stroke="#04050e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".65" />
            </g>
          </g>); })}
      {/* the lid and its slot, then the glass front */}
      <rect x={x0 - 5} y={yT - 9} width={bw + 10} height="11" rx="4" fill="#262b4d" stroke="rgba(255,255,255,.38)" strokeWidth="1.5" />
      <rect x={W / 2 - bw * 0.24} y={yT - 5.5} width={bw * 0.48} height="4" rx="2" fill="#05060f" />
      <rect x={x0 + 6} y={yT + 7} width="5" height={bh - 16} rx="2.5" fill="#fff" opacity=".13" />
    </svg>);
}

/* What Do You See? (the owner, 13 Nov): each team's own pile of the pictures it took, like printed photos dealt onto a
   table: the more it got, the higher its pile; none, an empty frame. Its points on top, its place, name and what it
   adds under. The photos are dealt on one by one, blurred, and come clear as they land; the winner's pile lights up */
export function PilesMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, big = k <= 3, cw = dense ? 124 : big ? 200 : 180, P = dense ? 80 : big ? 108 : 98, H = dense ? 140 : big ? 164 : 152;
  const order = byPlace(S, k), rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const at = rv.at(t), paid = S.award[t] > 0, photos = S.got?.[t] ?? [], n = Math.max(photos.length, S.wins[t] ?? 0); return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: cw, animationDelay: at + "s" }}>
          <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }}>{S.pts[t]}</div>
          <Pile photos={photos} n={n} P={P} H={H} w={cw} at={at} color={T[t].color} lit={paid && S.places[t] === 1} dim={!paid} />
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
const PILE_TILT = [-6, 5, -3, 7, -5, 4];
function Pile({ photos, n, P, H, w, at, color, lit, dim }: { photos: string[]; n: number; P: number; H: number; w: number; at: number; color: string; lit: boolean; dim: boolean }) {
  const step = n > 1 ? Math.max(3, Math.min(20, (H - P - 10) / (n - 1))) : 0;
  return (
    <div className={"ph-pile relative" + (lit ? " lit" : "")} aria-hidden style={{ width: w, height: H, opacity: dim ? 0.5 : 1, ["--c" as string]: color, ["--g" as string]: at + 0.3 + n * 0.13 + "s" }}>
      {n === 0 && <div className="ph-empty" style={{ width: P, height: P, left: (w - P) / 2, top: H - P - 6 }} />}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="ph-print" style={{ width: P, height: P, left: (w - P) / 2 + (i % 2 ? 1 : -1) * (i ? P * 0.1 : 0), top: H - P - 6 - i * step,
          ["--r" as string]: PILE_TILT[i % 6] + "deg", animationDelay: (at + 0.15 + i * 0.13).toFixed(2) + "s" }}>
          {/* (a picture the result can't name, from a game saved before the piles: a blank print) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photos[i] ? <img src={`/see/${photos[i]}-s.jpg`} alt="" decoding="async" style={{ animationDelay: (at + 0.3 + i * 0.13).toFixed(2) + "s" }} /> : <span className="ph-blank" />}
        </div>))}
    </div>);
}

/* Guess the Airport: each team's points on split-flap tiles, its status under as on a departures board (Boarding for the
   winner, On time, Delayed for the last; Cancelled only where a game pays nothing); 1st on the left. The tiles flip through the numbers
   and stop on the points, a team at a time; the winner's light up in its colour and a plane takes off from its Boarding */
export function FlapsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, order = byPlace(S, k, false), rv = revealOf(S, k);
  const status = (t: number): [string, string] => (S.award[t] <= 0 ? ["Cancelled", "#ff5566"] : S.places[t] === 1 ? ["Boarding", "#3ddc97"] : S.places[t] === k ? ["Delayed", "#ffb020"] : ["On time", "#ffd25a"]);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 16 : 28 }} role="list" aria-label={"Departures: " + order.map((t) => `${T[t].name} ${S.pts[t]} points, ${status(t)[0]}`).join(", ")}>
      {order.map((t) => { const at = rv.at(t), paid = S.award[t] > 0, lit = paid && S.places[t] === 1, [st, sc] = status(t); return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: dense ? 124 : 180, animationDelay: at + "s" }}>
          <Flaps text={String(S.pts[t]).padStart(2, " ")} at={at} lit={lit} color={T[t].color} dense={dense} dim={!paid} />
          <div className="relative mt-1">
            <span className="fl-status rb-fade" style={{ animationDelay: at + 0.75 + "s", color: sc, fontSize: dense ? 10 : 13 }}>{st}</span>
            {lit && <span className="fl-plane" style={{ animationDelay: at + 0.95 + "s" }} aria-hidden>
              <svg viewBox="0 0 24 24" width={dense ? 22 : 30} height={dense ? 22 : 30} fill="currentColor" style={{ transform: "rotate(45deg)" }}><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z" /></svg></span>}
          </div>
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
/* a team's tiles: each flips through a few numbers and stops on its own; the last one stops last. Motion off: the points at once */
function Flaps({ text, at, lit, color, dense, dim }: { text: string; at: number; lit: boolean; color: string; dense: boolean; dim: boolean }) {
  const want = text.split(""), [shown, setShown] = useState<string[]>(() => want.map(() => " ")), [flips, setFlips] = useState<number[]>(() => want.map(() => 0)), [done, setDone] = useState(false);
  useEffect(() => {
    const w = text.split("");
    if (motionOff()) { setShown(w); setDone(true); return; }
    setShown(w.map(() => " ")); setDone(false);
    const ts: ReturnType<typeof setTimeout>[] = [];
    w.forEach((ch, j) => { const steps = 7 + j * 2;
      for (let i = 0; i <= steps; i++) ts.push(setTimeout(() => {
        setShown((s) => s.map((c, x) => (x === j ? (i === steps ? ch : String((i * 7 + j * 3) % 10)) : c)));
        setFlips((f) => f.map((c, x) => (x === j ? c + 1 : c)));
        if (i === steps && j === w.length - 1) setDone(true);
      }, at * 1000 + 120 + i * 75)); });
    return () => ts.forEach(clearTimeout);
  }, [text, at]);
  const tw = dense ? 46 : 64, th = dense ? 70 : 96;
  return (
    <div className="fl-tiles" style={{ opacity: dim ? 0.55 : 1 }}>
      {shown.map((c, j) => (
        <div key={j} className={"fl-tile display" + (lit && done ? " lit" : "")} style={{ width: tw, height: th, fontSize: dense ? 56 : 78, lineHeight: th - 4 + "px", ["--c" as string]: color }}>
          <span key={flips[j]} className="fl-flip">{c === " " ? "\u00a0" : c}</span>
        </div>))}
    </div>);
}

/* Drop the Pin: one dartboard for every team (the owner, 13 Nov). The better a team's place, the nearer its dart to the
   bullseye, the places spaced out evenly between the bull and the outer ring (the owner: not all near the middle);
   the winner's in the bull, tied teams the same way out. Each dart carries the team's letter and flies in along itself;
   the places, names and points in a row under the board, left to right to the winner, as the pins were. The darts fly in
   one at a time, the last place first; the winner's goes in last and the board lights up in its colour */
export function DartboardMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, W = 1120, H = dense ? 300 : 310, B = H - (dense ? 86 : 84), R = B / 2 - 2, SW = B * 1.6, cx = SW / 2, cy = B / 2;
  const order = T.map((_, i) => i).sort((a, b) => S.places[b] - S.places[a] || b - a), rv = revealOf(S, k);
  const ps = [...new Set(S.places)].sort((a, b) => a - b), far = (t: number) => (ps.length > 1 ? ps.indexOf(S.places[t]) / (ps.length - 1) : 0);
  const pt = (r: number, a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const tops = order.filter((t) => S.places[t] === 1 && S.award[t] > 0), glow = tops.length === 1 ? T[tops[0]].color : "var(--color-gold)", hitAt = rv.done - 1 + 0.3;
  const wedge = (r1: number, r2: number, a1: number, a2: number) => { const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
    return `M${x1},${y1} A${r2},${r2} 0 0 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 0 0 ${x4},${y4} Z`; };
  const rings: [number, number, boolean][] = [[0.1, 0.52, false], [0.52, 0.58, true], [0.58, 0.86, false], [0.86, 0.92, true]];
  const cw = Math.min(W / k, 240), br = Math.max(9, B * 0.06), L = R * 0.34;
  return (
    <div className="flex flex-col items-center justify-center gap-1" style={{ width: W, height: H }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      <svg width={SW} height={B} viewBox={`0 0 ${SW} ${B}`} aria-hidden style={{ overflow: "visible", display: "block" }}>
        <g className="dt-shake" style={{ animationDelay: hitAt + "s" }}>
          <g className="dt-glow" style={{ animationDelay: hitAt + "s", ["--c" as string]: glow }}>
            <circle cx={cx} cy={cy} r={R} fill="#0b0d1f" stroke="#3a3f63" strokeWidth="2" />
            {Array.from({ length: 20 }, (_, i) => { const a1 = -99 + i * 18, dark = i % 2 === 0; return rings.map(([r1, r2, ring], j) => (
              <path key={i + "-" + j} d={wedge(R * r1, R * r2, a1, a1 + 18)} fill={ring ? (dark ? "#c8283f" : "#2f9e6a") : dark ? "#1b1e36" : "#e9dfc3"} stroke="#6b7090" strokeWidth=".6" />)); })}
            <circle cx={cx} cy={cy} r={R * 0.1} fill="#2f9e6a" stroke="#6b7090" strokeWidth=".6" /><circle cx={cx} cy={cy} r={R * 0.045} fill="#c8283f" />
          </g>
        </g>
        {/* each dart sticks out away from the middle, a little tilted, so the letters spread round the board with the darts */}
        {order.map((t, i) => { const c = T[t].color, a = 180 + (i * 360) / k, rr = R * (0.06 + 0.72 * far(t)), [x, y] = pt(rr, a), d = rv.at(t);
          const ux = Math.cos(((a - 22) * Math.PI) / 180), uy = Math.sin(((a - 22) * Math.PI) / 180);
          const P = (f: number) => [x + ux * L * f, y + uy * L * f], [bx, by] = P(0.46), [sx, sy] = P(0.82), [fx, fy] = P(0.98);
          return (
            <Fragment key={t}>
              <g className="dt-dart" style={{ animationDelay: d + "s", opacity: S.award[t] > 0 ? 1 : 0.5, ["--ox" as string]: x + "px", ["--oy" as string]: y + "px", ["--fx" as string]: ux * B * 0.7 + "px", ["--fy" as string]: uy * B * 0.7 + "px" }}>
                <line x1={x} y1={y} x2={bx} y2={by} stroke="#d8dbea" strokeWidth={Math.max(3, B * 0.022)} strokeLinecap="round" />
                <line x1={bx} y1={by} x2={sx} y2={sy} stroke="#7d84a8" strokeWidth={Math.max(2, B * 0.012)} />
                <path d={`M${sx},${sy} l${-uy * br * 1.1},${ux * br * 1.1} L${fx},${fy} Z M${sx},${sy} l${uy * br * 1.1},${-ux * br * 1.1} L${fx},${fy} Z`} fill={c} opacity=".85" />
                <circle cx={fx} cy={fy} r={br} fill={c} stroke="#04050e" strokeWidth="1.5" />
                <text x={fx} y={fy + br * 0.42} textAnchor="middle" fontWeight="800" fontSize={br * 1.15} fill="#04050e" style={{ fontFamily: "var(--font-body)" }}>{LETTERS[t]}</text>
              </g>
              <circle className="dt-hit" style={{ animationDelay: d + 0.3 + "s" }} cx={x} cy={y} r={B * 0.035} fill="none" stroke={c} strokeWidth="3" />
            </Fragment>); })}
      </svg>
      <div className="flex w-full justify-center">
        {order.map((t) => { const paid = S.award[t] > 0, lit = paid && S.places[t] === 1; return (
          <div key={t} role="listitem" className="rv flex flex-col items-center gap-0.5" style={{ width: cw, animationDelay: rv.at(t) + 0.3 + "s" }}>
            <span className="display leading-none" style={{ fontSize: dense ? 22 : 26, color: T[t].color }}>{S.pts[t]}</span>
            <span className="display text-15 leading-none" style={{ color: lit ? "var(--color-gold)" : "var(--color-ink-3)" }}>{paid ? place(S.places[t]) : "–"}</span>
            <span className="eyebrow text-center min-w-0 max-w-full" style={{ color: T[t].color, fontSize: dense ? 11 : 13, letterSpacing: ".1em", lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              <span className="inline-block align-middle mr-1" style={{ marginTop: -2 }}><Dot t={t} color={T[t].color} size={14} /></span><bdi>{T[t].name}</bdi></span>
            <span className="display leading-none" style={{ fontSize: dense ? 20 : 24, color: paid ? "var(--color-ok)" : "var(--color-ink-3)" }}>{paid ? "+" + S.award[t] : "0"}</span>
          </div>); })}
      </div>
    </div>);
}

/* the Cocktail or Dish: a cocktail glass a team, filled in its colour to its points (the best full to the brim,
   a cherry on its rim) */
export function GlassesMany({ pub, sound = false }: { pub: PubMany; sound?: boolean }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, best = Math.max(1, ...S.pts), order = byPlace(S, k), w = dense ? 112 : 170, h = w * 1.25;
  const rv = revealOf(S, k);
  /* on the TV itself, a soft pour as each glass with something in it fills */
  useEffect(() => {
    if (!sound) return;
    const ts = T.map((_, t) => (S.pts[t] > 0 ? setTimeout(() => playSound("pour"), (rv.at(t) + 0.3) * 1000) : null));
    return () => ts.forEach((x) => x && clearTimeout(x));
  }, [pub.step]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 14 : 34 }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const lvl = S.pts[t] / best, lit = S.award[t] > 0 && S.places[t] === 1, id = "g" + t; return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: w, animationDelay: rv.at(t) + "s" }}>
          <div className="display leading-none" style={{ fontSize: dense ? 26 : 34, color: T[t].color }}>{S.pts[t]}</div>
          <svg viewBox="0 0 100 125" width={w} height={h} aria-hidden style={{ overflow: "visible" }}>
            <defs><clipPath id={id}><path d="M8 8 L92 8 L54 58 L46 58 Z" /></clipPath></defs>
            {/* the drink, rising from the bottom of the bowl, one glass after another */}
            <g clipPath={`url(#${id})`}><rect className="glass-fill" x="0" y={58 - 50 * lvl} width="100" height={50 * lvl + 1} fill={T[t].color} style={{ animationDelay: rv.at(t) + 0.3 + "s", opacity: S.award[t] > 0 ? 0.9 : 0.4 }} /></g>
            <path d="M8 8 L92 8 L54 58 L46 58 Z" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.5" strokeLinejoin="round" />
            {/* the foot: a straight line (the owner, 13 Nov) */}
            <path d="M50 58 L50 107 M30 107 L70 107" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.5" strokeLinecap="round" />
            {lit && <g className="glass-cherry" style={{ animationDelay: rv.at(t) + 1.5 + "s" }}><path d="M74 9 Q78 -4 86 -8" stroke="#3ddc97" strokeWidth="2" fill="none" /><circle cx="73" cy="10" r="7" fill="#ff3b5c" /></g>}
          </svg>
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
/* Don't Say the Same: a speech bubble a team, as big as what it scored (nothing, a small one) */
export function BubblesMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, best = Math.max(1, ...S.pts), order = byPlace(S, k), max = dense ? 128 : 190;
  const rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 10 : 26, minHeight: max + 90 }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const size = Math.round(max * (0.42 + 0.58 * (S.pts[t] / best))), lit = S.award[t] > 0 && S.places[t] === 1; return (
        <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: dense ? 128 : 190, animationDelay: rv.at(t) + "s" }}>
          {lit && <span className="text-28 leading-none" role="img" aria-label="takes it">🏆</span>}
          <div className="bubble-pop relative grid place-items-center" style={{ width: size, height: size * 0.72, borderRadius: size * 0.36, background: `color-mix(in srgb, ${T[t].color} ${S.award[t] > 0 ? 85 : 35}%, #0b0e24)`,
            boxShadow: lit ? `0 0 30px ${T[t].color}` : undefined, animationDelay: rv.at(t) + 0.1 + "s" }}>
            <span className="display leading-none" style={{ fontSize: Math.max(22, size * 0.32), color: "#04050e" }}>{S.pts[t]}</span>
            <span className="absolute" style={{ bottom: -size * 0.1, left: "30%", width: 0, height: 0, borderLeft: `${size * 0.09}px solid transparent`, borderRight: `${size * 0.09}px solid transparent`,
              borderTop: `${size * 0.13}px solid color-mix(in srgb, ${T[t].color} ${S.award[t] > 0 ? 85 : 35}%, #0b0e24)` }} aria-hidden />
          </div>
          <div style={{ height: dense ? 6 : 10 }} />
          <Caption pub={pub} t={t} dense={dense} />
        </div>); })}
    </div>);
}
/* Don't Say the Same: each team's own words (the owner's pick, 14 Nov), dealt onto its pile one by one, the first at the
   bottom: a word that scored a cream card in the team's colour; one that didn't (another team said it too, it was the
   app's word, or it wasn't on the list) a dark striped card, the word struck through (the owner: a different look for
   the failed words). Too many for one pile's height (two teams, tie-breakers), two piles side by side */
export function WordsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, two = k === 2, dense = k > 4, order = byPlace(S, k), rv = revealOf(S, k);
  const cw = two ? 280 : dense ? 124 : k === 3 ? 200 : 180, H = two ? 176 : dense ? 140 : 160, base = two ? 26 : dense ? 19 : 23, gap = 3;
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: two ? 64 : dense ? 16 : 28 }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const at = rv.at(t), paid = S.award[t] > 0, lit = paid && S.places[t] === 1, W = S.words?.[t] ?? [], n = W.length;
        const cols = n > Math.floor((H + gap) / (base + gap)) && !dense ? 2 : 1, rows = Math.max(1, Math.ceil(n / cols));
        const ch = Math.max(14, Math.min(base, Math.floor((H - gap * (rows - 1)) / rows))), w = cols === 1 ? cw * 0.86 : (cw * 0.94 - 6) / 2, x0 = (cw - (cols * w + (cols - 1) * 6)) / 2;
        const step = Math.min(0.13, 1.1 / Math.max(1, n));
        return (
          <div key={t} role="listitem" className="rv flex flex-col items-center gap-1 min-w-0" style={{ width: cw, animationDelay: at + "s" }}
            aria-label={`${T[t].name}, ${S.pts[t]}: ` + (n ? W.map((x) => x.w + (x.ok ? "" : " (didn't score)")).join(", ") : "no words")}>
            <div className="display leading-none" style={{ fontSize: dense ? 30 : 40, color: T[t].color }} aria-hidden>{S.pts[t]}</div>
            <div className="relative" style={{ width: cw, height: H, opacity: paid ? 1 : 0.6, filter: lit ? `drop-shadow(0 0 14px ${T[t].color})` : undefined }} aria-hidden>
              {!n && <div className="absolute rounded" style={{ left: x0, bottom: 0, width: w, height: base, border: "2px dashed #8a92b8", opacity: 0.6 }} />}
              {W.map((x, i) => { const c = i % cols, r = Math.floor(i / cols), tilt = (((i * 37) % 7) - 3) * 0.8; return (
                <div key={i} className="absolute" style={{ left: x0 + c * (w + 6), bottom: r * (ch + gap), width: w, height: ch, transform: `rotate(${tilt}deg)` }}>
                  <div className={"word-card" + (x.ok ? "" : " no")} style={{ height: ch, fontSize: Math.round(ch * 0.62), ["--c" as string]: T[t].color, animationDelay: at + 0.2 + i * step + "s" }}>
                    <span className="truncate">{x.w}</span></div>
                </div>); })}
            </div>
            <Caption pub={pub} t={t} dense={dense} />
          </div>); })}
    </div>);
}
/* a question round: a game show's lecterns, a team's score lit on each; the winner's under a spotlight */
export function LecternsMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, order = byPlace(S, k), w = dense ? 130 : 176;
  const rv = revealOf(S, k);
  return (
    <div className="flex items-end justify-center w-full max-w-[1168px]" style={{ gap: dense ? 10 : 26 }} role="list" aria-label={(S.plus ? "Points this round: " : "Points this game: ") + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      {order.map((t) => { const lit = S.award[t] > 0 && S.places[t] === 1, paid = S.award[t] > 0; return (
        <div key={t} role="listitem" className="lectern-in relative flex flex-col items-center min-w-0" style={{ width: w, animationDelay: rv.at(t) + "s" }}>
          {lit && <span className="lectern-spot" aria-hidden />}
          {lit && <span className="text-28 leading-none mb-1 relative" role="img" aria-label="takes it">🏆</span>}
          {/* the score panel, lit in the team's colour */}
          <div className="relative w-full grid place-items-center rounded-t-[14px] border-2" style={{ height: dense ? 74 : 100, background: "#05060c", borderColor: T[t].color, boxShadow: paid ? `0 0 24px color-mix(in srgb, ${T[t].color} 55%, transparent) inset` : undefined }}>
            <span className="display leading-none" style={{ fontSize: dense ? 44 : 64, color: paid ? T[t].color : "var(--color-ink-3)", textShadow: paid ? `0 0 18px ${T[t].color}` : undefined }}>{S.plus && S.pts[t] > 0 ? "+" + S.pts[t] : S.pts[t]}</span>
          </div>
          {/* the front, narrowing to the floor, the team's name plate on it */}
          {/* padded in from the sloping sides, so a name never runs under them */}
          <div className="w-[86%] flex flex-col items-center justify-start pt-2 gap-1 px-[6%]" style={{ height: dense ? 92 : 112, background: `linear-gradient(180deg, color-mix(in srgb, ${T[t].color} 30%, #10142e), #0b0e24)`, clipPath: "polygon(0 0, 100% 0, 92% 100%, 8% 100%)" }}>
            <Caption pub={pub} t={t} dense={dense} />
          </div>
        </div>); })}
    </div>);
}

/* ---- Guess the Flag's result on the TV (the owner's pick, 30 Oct): one pole, every team's flag hoisted on it in
   place order, the winner's at the top with the trophy; the longer the flag, the more points; each flag carries its
   place, the team and its points, and what the place pays the night beside it. The flags wave and catch the light, the
   finial glows; the trophy sits after what the winner's place pays, not stuck on the flag's tip (the owner, 14 Nov) ---- */
export function FlagPoleMany({ pub }: { pub: PubMany }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, rowH = dense ? 30 : 46, best = Math.max(1, ...S.pts);
  /* the flags take the first column (the longest the full width); what each place pays and the trophy sit in
     columns of their own after it, so they line up down the pole */
  const minW = dense ? 300 : 360, spread = dense ? 330 : 380;
  const order = T.map((_, i) => i).sort((a, b) => S.places[a] - S.places[b] || a - b);
  const rv = revealOf(S, k);
  return (
    <div className="relative flex justify-center w-full" role="list" aria-label={"Points this game: " + order.map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      <div className="relative pl-[26px] pt-[18px] pb-[26px]">
        {/* the pole and its gold finial */}
        <span className="flag-pole" aria-hidden /><span className="flag-finial" aria-hidden />
        <ol className="flex flex-col" style={{ gap: dense ? 4 : 10 }}>
          {order.map((t) => { const paid = S.award[t] > 0, lit = paid && S.places[t] === 1; return (
            <li key={t} role="listitem" className="flag-hoist grid items-center" style={{ gridTemplateColumns: `${minW + spread}px ${dense ? 52 : 64}px ${dense ? 40 : 48}px`, columnGap: 10, animationDelay: rv.at(t) + "s" }}>
              {/* (each flag a beat behind the one above, so they ripple rather than sway as one) */}
              <div className={"flag-cloth" + (lit ? " lit" : "")} style={{ ["--c" as string]: T[t].color, ["--notch" as string]: dense ? "16px" : "24px", height: rowH, width: minW + (S.pts[t] / best) * spread, opacity: paid ? 1 : 0.5, animationDelay: -0.35 * order.indexOf(t) + "s" }}>
                <span className="display leading-none" style={{ fontSize: dense ? 16 : 24 }}>{paid ? S.places[t] : "–"}</span>
                <span className="truncate font-bold uppercase tracking-[.08em]" style={{ fontSize: dense ? 13 : 18 }}><bdi>{T[t].name}</bdi></span>
                <span className="display leading-none ml-auto" style={{ fontSize: dense ? 22 : 32 }}>{S.pts[t]}</span>
              </div>
              <span className="display leading-none text-right" style={{ fontSize: dense ? 20 : 28, color: paid ? "var(--color-ok)" : "var(--color-ink-3)" }}>{paid ? "+" + S.award[t] : "0"}</span>
              <span className="leading-none text-center" style={{ fontSize: dense ? 22 : 30 }} role={lit ? "img" : undefined} aria-label={lit ? "takes it" : undefined}>{lit ? "🏆" : ""}</span>
            </li>); })}
        </ol>
      </div>
    </div>);
}

/* ---- Guess the Map's result on the TV (the owner's pick, 30 Oct; Drop the Pin's then): the world map behind, a pin a
   team standing on it in place order from the left, the taller the more points, the points in its head; the place, the
   team and what it pays the night under it; the trophy over the winner. The map warmer and brighter, and a ripple on
   the ground where each pin lands (the owner's pick, 14 Nov) ---- */
export function PinsMapMany({ pub, map }: { pub: PubMany; map?: ReactNode }) {
  const S = pub.summary!, T = pub.teams, k = T.length, dense = k > 4, W = 1120, H = dense ? 300 : 310, ground = H - 78, best = Math.max(1, ...S.pts);
  /* read left to right, as the Closest To Wins race: the last place on the left, the winner on the right (the owner, 30 Oct) */
  const order = byPlace(S, k), r = dense ? 26 : 34;
  const rv = revealOf(S, k);
  return (
    <div className="relative rounded-[18px] overflow-hidden" style={{ width: W, height: H }} role="list" aria-label={"Points this game: " + [...order].reverse().map((t) => `${T[t].name} ${S.pts[t]}`).join(", ")}>
      <div className="pins-map absolute inset-0" aria-hidden>{map}</div>
      <div className="absolute left-6 right-6 h-[2px]" style={{ top: ground, background: "rgba(255,255,255,.18)" }} aria-hidden />
      {order.map((t, j) => { const paid = S.award[t] > 0, lit = paid && S.places[t] === 1, x = ((j + 0.5) / k) * W, tall = 30 + (S.pts[t] / best) * (ground - 2 * r - 30 - 50);   /* the tallest head 50px below the top: room for the trophy */
        return (
          <div key={t} role="listitem" className="pin-stand absolute flex flex-col items-center" style={{ left: x - W / k / 2, width: W / k, top: 0, height: H, ["--c" as string]: T[t].color, animationDelay: rv.at(t) + "s", opacity: paid ? 1 : 0.5 }}>
            <div className="absolute flex flex-col items-center" style={{ top: ground - tall - 2 * r }}>
              {lit && <span className="absolute leading-none" style={{ top: -(dense ? 30 : 38), fontSize: dense ? 24 : 30 }} role="img" aria-label="takes it">🏆</span>}
              <span className="pin-head display" style={{ width: 2 * r, height: 2 * r, fontSize: dense ? 20 : 26 }}>{S.pts[t]}</span>
              <span className="pin-stem" style={{ height: tall }} />
            </div>
            <span className="pin-ripple" style={{ top: ground - 9, animationDelay: rv.at(t) + 0.45 + "s" }} aria-hidden />
            <div className="absolute flex flex-col items-center gap-0.5" style={{ top: ground + 8, width: W / k - 8 }}>
              <span className="display text-15 leading-none" style={{ color: lit ? "var(--color-gold)" : "var(--color-ink-3)" }}>{paid ? place(S.places[t]) : "–"}</span>
              <span className="eyebrow text-center min-w-0 max-w-full" style={{ color: T[t].color, fontSize: dense ? 11 : 13, letterSpacing: ".1em", lineHeight: 1.2, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                <span className="inline-block align-middle mr-1" style={{ marginTop: -2 }}><Dot t={t} color={T[t].color} size={14} /></span><bdi>{T[t].name}</bdi></span>
              <span className="display leading-none" style={{ fontSize: dense ? 20 : 24, color: paid ? "var(--color-ok)" : "var(--color-ink-3)" }}>{paid ? "+" + S.award[t] : "0"}</span>
            </div>
          </div>); })}
    </div>);
}

/* the columns of the final standings: by place */
export const finalCols = (pub: PubMany): Col[] => pub.final!.order.map(({ team, place: p }) => ({ t: team, big: String(pub.teams[team].score), place: p, lit: p === 1 }));
/* ---- a reveal's rows: each team's line, in the order given (a side column on the TV, a list on a phone), the
   ones who take it with a trophy ---- */
export function RowsMany({ pub, order, right, size, label, pts }: { pub: PubMany; order: number[]; right: (t: number) => ReactNode; size: Size; label?: (t: number) => ReactNode; pts?: number[] }) {
  return <TeamRows teams={pub.teams} winners={pub.reveal?.winners || []} order={order} right={right} size={size} label={label} pts={pts} />;
}
/* the rows themselves, for every setup (2 teams' Drop the Pin reveal too: 23 Nov, the owner) */
export function TeamRows({ teams: T, winners: W, order, right, size, label, pts }: { teams: { name: string; color: string }[]; winners: number[]; order: number[]; right: (t: number) => ReactNode; size: Size; label?: (t: number) => ReactNode; pts?: number[] }) {
  const tv = size === "tv", dense = T.length > 4;
  return (
    <div className="flex flex-col w-full" style={{ gap: tv ? (dense ? 2 : 8) : 4 }} role="list">
      {order.map((t) => (
        <div key={t} role="listitem" className="flex items-center gap-3 min-w-0" style={{ opacity: W.length && !W.includes(t) ? 0.55 : 1 }}>
          <Dot t={t} color={T[t].color} size={tv ? (dense ? 16 : 20) : 14} />
          <span className="display truncate flex-1 text-left" style={{ fontSize: tv ? (dense ? 22 : 28) : 16, color: T[t].color }}><bdi>{T[t].name}</bdi>{label?.(t)}</span>
          {/* who takes it: a trophy in a slot of its own, so a long name stops short of it and nothing moves */}
          {W.length > 0 && <span className="shrink-0 text-center leading-none" style={{ width: tv ? (dense ? 26 : 32) : 20, fontSize: tv ? (dense ? 18 : 24) : 14 }} role={W.includes(t) ? "img" : undefined} aria-label={W.includes(t) ? "takes it" : undefined}>{W.includes(t) ? "🏆" : ""}</span>}
          <span className="display shrink-0 text-right" style={{ fontSize: tv ? (dense ? 24 : 32) : 18 }}>{right(t)}</span>
          {/* what this leg pays, in a column of its own */}
          {pts && <span className="display shrink-0 text-right" style={{ width: tv ? (dense ? 40 : 52) : 30, fontSize: tv ? (dense ? 20 : 26) : 14, color: pts[t] ? "var(--color-ok)" : "var(--color-ink-3)" }}>{pts[t] ? "+" + pts[t] : "0"}</span>}
        </div>))}
    </div>);
}
/* a Drop the Pin reveal's rows: how far off */
export const kmOf = (pub: PubMany, t: number): ReactNode => (pub.reveal?.pins?.[t] ? showKm(pub.reveal.off?.[t] ?? 0) : <span className="text-[var(--color-ink-3)]">No pin</span>);

/* Don't Say the Same: why an answer scores nothing */
/* the Cocktail or Dish: "60 ml — gin" splits into the amount and the ingredient */
export const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };
/* ---- the phone's Teams sheet, behind the name at the top left (the owner, 31 Oct: one place for the scores and
   the players, instead of a Scores and a Team button): every team in order with its score, its players under its
   name, yours marked (a score strip for eight teams is too much on a phone) ---- */
export function ScoresMany({ pub, me, members }: { pub: PubMany; me: number | null; members?: Member[] }) {
  const T = pub.teams, g = pub.game, pc = g?.key === "majority";
  const order = pub.final ? pub.final.order.map((o) => o.team) : T.map((_, i) => i).sort((a, b) => T[b].score - T[a].score || a - b);
  const placeOf = (t: number) => pub.final ? pub.final.order.find((o) => o.team === t)!.place : order.findIndex((x) => T[x].score === T[t].score) + 1;
  const tally = g && pub.screen !== "intro" && pub.screen !== "final" ? (pc ? g.shares : g.pts) : null;
  return (
    <div className="card flex flex-col gap-3" role="group" aria-label="Teams and scores">
      <div className="eyebrow" style={{ color: "var(--color-gold)" }}>{pub.screen === "final" ? "Final standings" : "Teams and scores"}</div>
      {/* the column titles: what the grey number is, and that the big one is the night's total */}
      <div className="flex items-end gap-2 px-2 -mx-2 text-11 font-bold uppercase tracking-[.14em] leading-tight text-[var(--color-ink-3)]" aria-hidden>
        <span className="flex-1">Team</span>
        {tally && <span className="w-14 text-right">This game</span>}
        <span className="w-12 text-right">Total</span>
      </div>
      <ol className="flex flex-col gap-1">
        {order.map((t) => (
          <li key={t} className={"flex items-center gap-2 min-h-[44px] rounded-[14px] px-2 -mx-2" + (members ? " py-1.5" : "")} style={t === me ? { background: `color-mix(in srgb, ${T[t].color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${T[t].color} 40%, transparent)` } : undefined}>
            <span className="display text-16 w-7 text-right" style={{ color: placeOf(t) === 1 ? "var(--color-gold)" : "var(--color-ink-3)" }}>{placeOf(t)}</span>
            <Dot t={t} color={T[t].color} size={16} />
            <span className="flex-1 min-w-0 flex flex-col"><span className="font-bold text-16 truncate" style={{ color: T[t].color }}><bdi>{T[t].name}</bdi></span>{t === me && <span className="cap self-start">Your team</span>}
              {members && <Players list={members.filter((m) => (m.team as number) === t)} />}</span>
            {tally && <span className="w-14 shrink-0 text-13 text-[var(--color-ink-2)] tabular-nums text-right" aria-label={`${g!.title}: ${pc ? pct(tally[t]) : `${tally[t]} points`}`}>{pc ? pct(tally[t]) : `${tally[t]} pts`}</span>}
            <span className="display text-26 w-12 text-right" style={{ color: T[t].color }} aria-label={`Total ${T[t].score}`}>{T[t].score}</span>
          </li>))}
      </ol>
      {tally && g && <div className="text-12 text-[var(--color-ink-3)]">This game: {pc ? "the share of answers right so far." : "points so far."} Total: points for the night.</div>}
    </div>);
}
/* a team's players on one small wrapping line, the captain first and marked */
function Players({ list }: { list: Member[] }) {
  const L = [...list].sort((x, y) => (x.role === "captain" ? 0 : 1) - (y.role === "captain" ? 0 : 1));
  if (!L.length) return <span className="text-13 text-[var(--color-ink-3)]">Nobody yet</span>;
  return (
    <span className="text-13 leading-snug text-[var(--color-ink-2)] mt-0.5">
      {L.map((m, i) => <span key={m.user_id}>{i > 0 && ", "}<span className="whitespace-nowrap"><span aria-hidden>{m.avatar || "🙂"}</span> <bdi>{m.name}</bdi>{m.role === "captain" && <span className="cap ml-1">Captain</span>}</span></span>)}
    </span>);
}
