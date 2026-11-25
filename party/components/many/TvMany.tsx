"use client";
/* MANY TEAMS: the TV's screens, drawn as the two-team TV draws its mini-games (components/TvGame.tsx): the same
   tracker along the top, the same intro, the same question layouts, the same reveal moves (the answer slams in,
   the calls come down as stamps), a game's result as a board of columns, the winner's slam at the end. Only the
   number of teams changes: up to four sit as the two do, eight pack into rows. No buttons: the host's phone runs it. */
import { wholeSentences } from "@/lib/sentences";
import { useEffect, useState } from "react";
import { FitBody } from "../TvStage";
import { useToastOn, WinName } from "../Motion";
import { MajorityJoin, MajorityRevealTv, MajorityTv, WhoPlaysTv } from "../MajorityGame";
import { FOOL } from "@/lib/minis/fool";
import { Clock, useSecondsLeft } from "../Clock";
import { Confetti } from "../GameParts";
import { PinMap } from "../PinMap";
import { showKm } from "@/lib/game";
import { LETTERS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { Ruler } from "../Ruler";
import { NightIntroTv } from "../NightIntro";
import { ImadBubble } from "../TvGame";
import { RouletteTv } from "../Roulette";
import { StakesTv } from "../Stakes";
import { FoolFact, FoolOptions, FoolResult, FoolReveal, FoolStatus } from "../Fool";
import { SeeCredit, SeePicture, SeeTv, seeWho } from "../See";
import { AirportRevealTv, AirportTv } from "../Airport";
import { MapRevealTv, MapTv } from "../MapGame";
import { SayRevealTv, SayTv, sayWord } from "../SayGame";
import { DishRevealTv, DishTv } from "../DishGame";
import { ClosestRevealTv, ClosestTv } from "../Closest";
import { PinRevealTv, PinTv } from "../Pin";
import { FlagTv } from "../Flag";
import { SentLine, TeamCalls } from "../TeamCalls";
import { ComebackIntro, ComebackQTv, ComebackResult, ComebackRevealTv } from "../Comeback";
import { BallotsMany, BarrelsMany, BarsMany, PilesMany, WordsMany, BoardMany, BubblesMany, byDistance, DartboardMany, FlapsMany, GlassesMany, LecternsMany, FlagPoleMany, PinsMapMany, finalCols, HudMany, IntroMany, kmOf, leader, paid, RowsMany, takes, resultDone } from "./PartsMany";

/* a delay after the beat, for the pieces of a reveal that land one after another */
const d = (s: number) => ({ ["--d" as string]: s + "s" });
/* a mini-game's reveal: no drumroll, so its pieces land straight away (the same moves, a shorter beat) */
const QUICK = { ["--beat" as string]: ".15s" };

/* join: where a phone joins this room (Majority Rules puts the QR code up again before it starts)
   host: who taps Start and Next (the strip at the bottom says so) */
/* sound: this is the TV itself (it plays the pours and the coins landing; another screen showing the TV stays quiet) */
/* the TV's line while the night waits for a host (8 Nov): big enough to read across the room */
function HostGoneTv({ info }: { info: { name: string | null; openAt: number } }) {
  const left = useSecondsLeft(info.openAt);
  return <span className="tv-note enter" style={{ color: "var(--color-gold)", fontWeight: 800 }}>
    {info.name ? <><bdi>{info.name}</bdi>&rsquo;s phone has gone quiet: the night is waiting for a host. </> : "The night has no host, so it is waiting. "}
    {left > 0 ? `In ${left} s, anyone can take over as the host on their phone.` : "Anyone can take over now: tap Be the host on your phone."}</span>;
}

export function TvMany({ pub, join, host, sound = false }: { pub: PubMany; join?: { url: string; code: string }; host?: string; sound?: boolean }) {
  const g = pub.game, R = pub.reveal, T = pub.teams, k = T.length, dense = k > 4;
  const key = pub.screen + pub.step;
  /* a message shows for four seconds, then goes */
  const toastOn = useToastOn(pub.toast);
  /* the end: celebrate the winner first, then the standings come up under it */
  const [recap, setRecap] = useState(false);
  useEffect(() => { if (pub.screen !== "final") { setRecap(false); return; } const t = setTimeout(() => setRecap(true), 2500); return () => clearTimeout(t); }, [pub.screen]);
  const lead = leader(pub);
  /* (Russian Roulette: the host's Start and Next spin the barrel, so the strip says Spin) */
  const spinNext = g?.key === "roulette" && (pub.screen === "intro" || (pub.screen === "reveal" && g.leg < g.of));
  const next = spinNext ? "Spin" : pub.screen === "intro" ? "Start" : pub.screen === "reveal" || pub.screen === "summary" ? "Next" : null;
  const W = takes(pub);
  return (
    /* nothing on the TV can be selected or copied */
    <div className="relative flex flex-col h-full noselect" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <HudMany pub={pub} size="tv" code={join?.code} sound={sound} />
      {/* the night's intro, before the first game: the plan, until the host's Let's go */}
      {pub.intro && <NightIntroTv intro={pub.intro} who={`${host || "The host"} starts the game`} />}
      {/* the host paused it: the question hides until the clock restarts, as with two teams */}
      {(pub.screen === "q" || pub.screen === "pick") && pub.paused && (
        <div className="tv-cover absolute inset-0 grid place-items-center" style={{ zIndex: 20 }}>
          <div className="text-center"><div className="display" style={{ fontSize: 140, color: "var(--color-gold)" }}>Paused</div>
            {/* (who paused it, as the phones and the 2-team TV say: 22 Nov, the owner) */}
            <div className="text-26 text-[var(--color-ink-2)] mt-2">The host paused it. The question comes back when the clock restarts.</div></div>
        </div>)}

      <FitBody className={"flex-1 flex flex-col items-center justify-center text-center enter min-h-0" + (pub.screen === "reveal" && (g?.key === "airport" || g?.key === "map") ? " gap-4" : " gap-5") + (pub.screen === "final" && recap ? " recap-on" : "")} key={key}>
        {/* the intro: the rules; Majority Rules puts the QR code up again, and how many each team has in */}
        {pub.screen === "intro" && g && (g.key === "majority" ? (
          <div className="flex gap-10 items-start w-full">
            <div className="flex-1 min-w-0"><IntroMany pub={pub} size="tv" compact /></div>
            {/* joining: the code and its QR side by side, one short line under them; then who's in, a team a row,
                the name on the left and its count lined up on the right (the owner, 31 Oct: it read untidy) */}
            <div className="w-[560px] shrink-0 flex flex-col gap-4 text-left">
              {join && <MajorityJoin join={join} dense={dense} />}
              {/* (who plays: one copy for every setup, components/MajorityGame.tsx: 25 Nov) */}
              <WhoPlaysTv teams={T.map((t) => ({ name: t.name, color: t.color }))} list={pub.mrList || []} />
            </div>
          </div>) : g.key === "comeback" && pub.comeback ? (<>
            {/* the comeback (17 Nov, the owner): the announcement in the owner's words, what it takes, what each team can win */}
            <div className="display text-80 leading-none slam" style={{ color: "var(--color-gold)" }}>{g.title}</div>
            <ComebackIntro teams={T.map((t) => ({ name: t.name, color: t.color }))} c={pub.comeback} tv />
          </>) : <div className="w-full max-w-[1080px]"><IntroMany pub={pub} size="tv" /></div>)}

        {/* the question: the same screens as the two-team TV, with every team's state under the clock */}
        {/* (Guess the Flag: one copy for every setup, components/Flag.tsx) */}
        {pub.screen === "q" && g && g.key === "flag" && <FlagTv flag={pub.flag} dense={dense} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={dense ? 110 : 120} />} sent={<Sent pub={pub} />} />}
        {/* What Do You See? (12 Nov, the owner: a buzzer): the picture clears as the clock runs and stops at a buzz; the
            team that buzzed says it out loud and types it, with its own 10 seconds on the clock; every team's state */}
        {pub.screen === "q" && g && g.key === "see" && pub.see && (
          /* (the 2-team screen, one piece: 23 Nov, the owner) */
          <SeeTv see={pub.see} screen="seeQ" teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} deadline={pub.deadline} left={pub.left} dense={dense}
            clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />} foot={`Right, and you score ${T.length} points. Wrong, and you’re out of this picture.`} />)}
        {/* a question round, and Don't Say the Same's prompt: the words big, the clock, every team's state */}
        {pub.screen === "q" && g && g.key === "say" && <SayTv question={pub.question} many clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />} sent={<Sent pub={pub} column={false} />} />}
        {/* (the comeback: one screen for every setup, components/Comeback.tsx: 25 Nov) */}
        {pub.screen === "q" && g && g.key === "comeback" && pub.comeback && <ComebackQTv teams={T.map((t) => ({ name: t.name, color: t.color }))} c={pub.comeback} question={pub.question}
          clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />} sent={<Sent pub={pub} />} />}
        {pub.screen === "q" && g && (g.key === "quiz" || g.key === "sudden") && (<>
          {g.key === "sudden" && <div className="display text-36 leading-none" style={{ color: "var(--color-gold)" }}>First right answer wins the night</div>}
          {pub.theme && <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>{pub.theme}</div>}
          <div className="font-bold max-w-[1100px]" style={{ fontSize: (pub.question || "").length > 160 ? 34 : (pub.question || "").length > 100 ? 40 : 50, lineHeight: 1.15 }}>{pub.question}</div>
          <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={130} />
          <Sent pub={pub} />
        </>)}
        {/* Guess the Airport, Guess the Map: the board or the map, the clock and the teams beside it */}
        {pub.screen === "q" && g && g.key === "airport" && <AirportTv air={pub.airport} dense={dense} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={dense ? 120 : 130} />} sent={<Sent pub={pub} column={!dense} />} />}
        {pub.screen === "q" && g && g.key === "map" && <MapTv map={pub.map} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />} sent={<Sent pub={pub} column={!dense} />} />}
        {/* the Cocktail or Dish: one copy for every setup (components/DishGame.tsx): the ingredients one by one, who has answered */}
        {pub.screen === "q" && g && g.key === "dish" && pub.dish && <DishTv dish={pub.dish} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />} under={<Sent pub={pub} column={!dense} />} />}
        {/* Secret Stakes: the themes and who has bet; "Bets are in" while each team answers on its own phones; the reveal,
            last place first; what each team won or lost */}
        {g && g.key === "stakes" && pub.stakes && ["pick", "q", "reveal", "summary"].includes(pub.screen) && (
          <StakesTv sk={pub.stakes} screen={({ pick: "stakesPick", q: "stakesQ", reveal: "stakesReveal", summary: "stakesSummary" } as Record<string, string>)[pub.screen]}
            teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} sent={pub.sent}
            clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={pub.screen === "q" ? 150 : 110} />} />)}
        {/* Russian Roulette: the barrel spins, each team's chamber lights up; at the reveal they click, the bullet last */}
        {/* Fool Me Twice: the fact while the lies are written; the answers while they pick (and say who'll fall for theirs);
            then the reveal: the truth first, then a lie at a time */}
        {g && g.key === "fool" && pub.fool && ["q", "pick", "reveal"].includes(pub.screen) && (() => { const F = pub.fool, tms = T.map((t) => ({ name: t.name, color: t.color })); return (
          <div className="flex flex-col items-center gap-4 w-full max-w-[1100px]">
            {pub.screen === "q" && (<>
              <FoolFact fool={F} size={F.fact.length > 120 ? 44 : 54} />
              <Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={120} />
              <FoolStatus teams={tms} done={F.wrote} doing={dense ? "…" : ": " + FOOL.writing} finished={dense ? "✓" : ": " + FOOL.lieInShort} tv />
            </>)}
            {pub.screen === "pick" && F.opts && (<>
              <FoolFact fool={F} size={F.opts.length > 6 ? 28 : 32} />
              <FoolOptions opts={F.opts} tv />
              <div className="flex items-center gap-8"><Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={86} />
                <FoolStatus teams={tms} done={F.picked || T.map(() => false)} doing={dense ? "…" : ": " + FOOL.picking} finished={dense ? "✓" : ": " + FOOL.picked} tv /></div>
            </>)}
            {pub.screen === "reveal" && F.rev && (<>
              <FoolFact fool={F} size={F.rev.opts.length > 6 ? 26 : 30} truth={F.rev.answer} />
              <FoolReveal rev={F.rev} teams={tms} tv />
            </>)}
          </div>); })()}
        {(pub.screen === "q" || pub.screen === "reveal") && g && g.key === "roulette" && pub.roulette && (
          <RouletteTv rr={pub.roulette} teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} sent={pub.sent} typed={R?.typed} ok={R?.ok}
            reveal={pub.screen === "reveal"} sound={sound} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={110} />} />)}
        {/* (Closest To Wins, Drop the Pin, Guess the Airport: one copy for every setup, components/Closest.tsx, Pin.tsx, Airport.tsx) */}
        {pub.screen === "q" && g && g.key === "closest" && <ClosestTv question={pub.question} dense={dense} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={dense ? 140 : 150} />} sent={<Sent pub={pub} />} />}
        {pub.screen === "q" && g && g.key === "pin" && <PinTv pin={pub.pin} dense={dense} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={dense ? 120 : 130} />} sent={<Sent pub={pub} column={!dense} />} />}
        {pub.screen === "q" && g && g.key === "majority" && pub.options && <MajorityTv question={pub.question} options={pub.options} teams={T.map((t) => ({ name: t.name, color: t.color }))}
          answered={pub.mrAnswered || []} clock={<Clock deadline={pub.deadline} left={pub.left} timeUp={pub.timeUp} size={100} />} sent={<Sent pub={pub} />} />}

        {/* the reveal: the answer lands, then the calls, then who takes it */}
        {pub.screen === "reveal" && g && R && g.key === "flag" && <FlagTv flag={pub.flag} reveal dense={dense} answer={R.answer} notes={R.notes}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} headStyle={d(0.5)} />}
        {/* What Do You See?: the whole picture and what it is, who got it first and how fast, then every team's guess */}
        {pub.screen === "reveal" && g && R && g.key === "see" && pub.see && (() => { const who = seeWho(pub.see, T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] })), R.winners?.length); return (<>
          {/* (the picture and what it is side by side, in the middle: 12 Nov) */}
          <div className="grid items-center justify-center gap-12 w-full max-w-[1160px]" style={{ gridTemplateColumns: `${dense ? 400 : 620}px minmax(0, 520px)` }}>
            <div className="flex flex-col items-center gap-1 min-w-0"><SeePicture see={pub.see} clear w={dense ? 400 : 620} big alt={R.answer} /><SeeCredit see={pub.see} size={dense ? 13 : 14} /></div>
            <div className="flex flex-col items-center gap-3 min-w-0">
              <div className="eyebrow text-18">It&rsquo;s</div>
              {/* (the 2-team sizes up to four teams; the fact under it: 23 Nov, the owner) */}
              <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: (R.answer || "").length > 22 ? (dense ? 40 : 44) : (R.answer || "").length > 14 ? (dense ? 48 : 56) : dense ? 56 : 70, color: "var(--color-gold)" }}>{R.answer}</div>
              {R.notes && <div className={(dense ? "text-18" : "text-20") + " text-[var(--color-ink-2)] leading-snug text-center"}>{wholeSentences(R.notes, 120)}</div>}
              <div className="display text-36 beat" style={{ ...QUICK, ...d(0.5), color: who.color }}>{who.text}</div>
            </div>
          </div>
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(0.3 + i * 0.08)} />
        </>); })()}
        {/* a typed answer's reveal (question rounds, airports, maps, Don't Say the Same, the Cocktail or Dish): what was
            asked, small; the answer slams in; every team's answer and its call; who takes it */}
        {pub.screen === "reveal" && g && R && g.key === "airport" && <AirportRevealTv air={pub.airport} answer={R.answer || ""} notes={R.notes} dense={dense}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} headStyle={d(0.5)} />}
        {pub.screen === "reveal" && g && R && g.key === "map" && <MapRevealTv map={pub.map} answer={R.answer || ""} notes={R.notes} dense={dense}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} headStyle={d(0.5)} />}
        {pub.screen === "reveal" && g && R && g.key === "say" && <SayRevealTv question={pub.question || undefined} answer={R.answer || ""} dense={dense}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} headStyle={d(0.5)} />}
        {pub.screen === "reveal" && g && R && g.key === "dish" && <DishRevealTv dish={pub.dish} answer={R.answer || ""} dense={dense}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} headStyle={d(0.5)} />}
        {pub.screen === "reveal" && g && R && g.key === "comeback" && <ComebackRevealTv question={pub.question} answer={R.answer || ""} notes={R.notes} dense={dense}
          rows={<FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />} head={W} />}
        {pub.screen === "reveal" && g && R && ["quiz", "sudden"].includes(g.key) && (<>
          {pub.question ? <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{pub.question}</div> : null}
          <div className="ans-board display beat slam leading-none max-w-[1160px]" style={{ ...QUICK, fontSize: (R.answer || "").length > 34 ? (dense ? 40 : 44) : (R.answer || "").length > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{R.answer}</div>
          {R.notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug">{wholeSentences(R.notes)}</div>}
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.5), color: W.color }}>{W.text}</div>
        </>)}
        {pub.screen === "reveal" && g && R && g.key === "closest" && <ClosestRevealTv question={pub.question} answer={Number(R.answer)} notes={R.notes} dense={dense} head={W} headStyle={d(0.6)}
          ruler={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i], guess: R.nums?.[i] ?? null, win: R.winners.includes(i), pts: R.pts?.[i] }))} />}
        {pub.screen === "reveal" && g && R && g.key === "pin" && R.at && <PinRevealTv dense={dense} name={R.answer} place={R.place} head={W}
          marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
            ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, ...(T.length > 4 ? { label: showKm(R.off?.[i] ?? 0), letter: LETTERS[i] } : { label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` }) } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
          rows={<RowsMany pub={pub} order={byDistance(pub)} right={(t) => kmOf(pub, t)} size="tv" pts={R.pts} />} />}
        {pub.screen === "reveal" && g && R && g.key === "majority" && R.counts && <MajorityRevealTv question={pub.question} options={pub.options || []} answer={R.answer || ""} notes={R.notes}
          teams={T.map((t) => ({ name: t.name, color: t.color }))} byTeam={R.byTeam} counts={R.counts} right={R.right || []} of={R.of || []} fire={pub.mrFire} />}

        {/* a game's result: the board, and who it pays */}
        {pub.screen === "summary" && g && g.key !== "stakes" && pub.summary && (<>
          {/* five teams or more with the bars: a size smaller, so it all sits under the tracker */}
          {/* (one size for every game's result, every setup: 44, as with 2 teams: 23 Nov, the owner) */}
          <div className={"display leading-none slam " + (dense ? "text-40" : "text-44")} style={{ color: "var(--color-gold)" }}>{g.title}</div>
          {/* each game's points in a look of its own, never the totals' row (the owner, 30 Oct) */}
          {g.key === "majority" ? <BallotsMany pub={pub} />
            : g.key === "roulette" ? <BarrelsMany pub={pub} />
            : g.key === "see" ? <PilesMany pub={pub} />
            : g.key === "flag" ? <FlagPoleMany pub={pub} />
            : g.key === "closest" ? <Ruler ans={0} scale teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i], guess: pub.summary!.pts[i], win: pub.summary!.places[i] === 1 && pub.summary!.award[i] > 0, pts: pub.summary!.award[i] }))} />
            : g.key === "pin" ? <DartboardMany pub={pub} />
            : g.key === "map" ? <PinsMapMany pub={pub} map={<PinMap marks={[]} interactive={false} height="100%" label="The world" bare />} />
            : g.key === "airport" ? <FlapsMany pub={pub} />
            : g.key === "dish" ? <GlassesMany pub={pub} sound={sound} />
            : g.key === "say" ? (pub.summary.words ? <WordsMany pub={pub} /> : <BubblesMany pub={pub} />)
            : g.key === "quiz" ? <LecternsMany pub={pub} />
            : g.key === "comeback" && pub.comeback ? <ComebackResult teams={T.map((t) => ({ name: t.name, color: t.color }))} c={pub.comeback} tv />
            /* Fool Me Twice: the lie detector, and its four awards (16 Nov, the owner's pick) */
            : g.key === "fool" && pub.summary.fool ? <FoolResult teams={T.map((t) => ({ name: t.name, color: t.color }))} sum={pub.summary.fool} pts={pub.summary.pts} places={pub.summary.places} award={pub.summary.award} />
            : <BarsMany pub={pub} />}
          {/* the line comes once the last team (the winner) is in */}
          <div className={"rv display " + (dense ? "text-44" : "text-52")} style={{ color: paid(pub).color, animationDelay: resultDone(pub) + "s" }}>{paid(pub).text}</div>
          {pub.summary.line && <div className="rv text-18 max-w-[900px] truncate" style={{ color: "var(--color-gold)", animationDelay: resultDone(pub) + 0.2 + "s" }}><bdi>{pub.summary.line}</bdi></div>}
        </>)}

        {/* the end: "The winner", a beat, then the name slams down with a flash and a shockwave, and the confetti
            bursts; then the standings come up under it */}
        {pub.screen === "final" && pub.final && (() => {
          const tops = pub.final!.order.filter((x) => x.place === 1).map((x) => x.team), c = tops.length === 1 ? T[tops[0]].color : "var(--color-gold)";
          const name = tops.map((t) => T[t].name).join(" & ");
          return (<>
            <div className="win-flash" style={{ ["--c" as string]: c }} aria-hidden />
            <div className="confetti-late"><Confetti n={140} /></div>
            <div className="eyebrow text-22 enter relative z-10 win-eyebrow">{tops.length > 1 ? "A shared win" : "The winner"}</div>
            <div className="win-sign relative z-10 grid place-items-center">
              <span className="win-tag" aria-hidden>{tops.length > 1 ? "A shared win" : "Tonight\u2019s winner"}</span>
              <span className="win-ring" style={{ ["--c" as string]: c }} aria-hidden />
              <span className="win-ring r2" style={{ ["--c" as string]: c }} aria-hidden />
              <WinName recap={!!recap} color={c} label={name}><bdi>{name}</bdi></WinName>
            </div>
            {/* the recap: the night drawn across the whole screen, the award cards under it (the owner, 30 Oct: no
                nutshell, it crowded the chart) */}
            {recap && (<>
              <div className="flex justify-center w-full enter" style={{ position: "relative", zIndex: 60 }}>
                {pub.final!.log.length > 2 ? <NightChartMany pub={pub} /> : <BoardMany pub={pub} cols={finalCols(pub)} size="tv" label="Final standings" />}
              </div>
              {pub.final!.awards.length > 0 && (
                <div className="grid gap-3 enter w-full max-w-[1168px]" style={{ gridTemplateColumns: `repeat(${pub.final!.awards.length}, minmax(0, 1fr))`, position: "relative", zIndex: 60 }}>
                  {/* solid cards: the confetti behind them stays behind them */}
                  {pub.final!.awards.map((a) => (
                    <div key={a.t} className="card !p-2 !px-3 text-left min-w-0" style={{ borderColor: a.team != null ? T[a.team].color : undefined, background: "linear-gradient(180deg, #151a3c, #0c1028)" }}>
                      <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>{a.spoon ? "🥄" : "🏆"} {a.t}</div>
                      <div className="text-20 font-bold leading-snug" style={{ color: a.team != null ? T[a.team].color : undefined }}><bdi>{a.who}</bdi></div>
                      {a.note && <div className="text-18 text-[var(--color-ink-2)] italic line-clamp-2">{a.note}</div>}
                    </div>))}
                </div>)}
            </>)}
          </>); })()}
      </FitBody>

      {/* between questions: a soft glow in the leader's colour; it fades out when a question comes up */}
      {/* Imad, the MC (8 Nov: as with two teams; Settings turns him on) */}
      <ImadBubble imad={pub.imad} />
      <div className="tv-glow" style={{ ["--c" as string]: lead != null ? T[lead].color : "transparent", opacity: lead != null && pub.screen !== "q" ? 1 : 0 }} aria-hidden />
      {/* the strip along the bottom, kept clear of the screen's content: news, and who taps Next, small, on the right */}
      <div className="tv-foot" role="status" aria-live="polite">
        {toastOn && <span key={pub.toast!.id} className="tv-note enter">{pub.toast!.text}</span>}
        {/* the host gone quiet (8 Nov): the night waits; anyone can take over on their phone */}
        {pub.hostGone && <HostGoneTv info={pub.hostGone} />}
        {/* a captain's contest, open: the host decides (8 Nov) */}
        {pub.screen === "reveal" && pub.contest ? <span className="next-hint"><b style={{ color: T[pub.contest.by].color }}><bdi>{T[pub.contest.by].name}</bdi></b> contest {pub.contest.t !== pub.contest.by ? <><b style={{ color: T[pub.contest.t].color }}><bdi>{T[pub.contest.t].name}</bdi></b>&rsquo;s </> : "their "}call. The host decides.</span>
          /* (the host, not their name: 22 Nov, the owner, every setup) */
          : next && <span className="next-hint">Waiting for <b>the host</b> to tap {next}</span>}
      </div>
    </div>);
}

/* sudden death: the fastest right answer, the night's winner */
/* every team: locked in, or still thinking (the two-team "Team A: thinking…", for N teams: a row that wraps, or a
   column); in sudden death only the teams tied at the top */
/* who has answered, and each team's call at the reveal: one copy for every setup (components/TeamCalls.tsx); here,
   which teams are in this question (sudden death's tied ones, the comeback's still in it) and this setup's words */
const shownTeams = (pub: PubMany) => pub.teams.map((t, i) => ({ i, name: t.name, color: t.color })).filter((t) => (!pub.game?.only || pub.game.only.includes(t.i)) && !pub.comeback?.out[t.i]);
function Sent({ pub, column }: { pub: PubMany; column?: boolean }) {
  const pin = pub.game?.key === "pin", mr = pub.game?.key === "majority";
  /* (a wrong guess in the Cocktail or Dish reads "locked in" too: who got it shows at the reveal, the owner, 2 Nov) */
  return <SentLine teams={shownTeams(pub)} sent={(i) => !!pub.sent[i]} column={column} on={pin ? "pin in" : "locked in"} off={pin ? "placing…" : mr ? "answering…" : "thinking…"} />;
}
function FlagRowsMany({ pub, size, delay }: { pub: PubMany; size: "tv" | "phone"; delay?: (i: number) => React.CSSProperties }) {
  const R = pub.reveal!, say = pub.game?.key === "say";
  return <TeamCalls teams={shownTeams(pub)} size={size} delay={delay} ok={(i) => R.ok?.[i]} typed={(i) => R.typed?.[i]} pts={(i) => R.pts?.[i]} places={(i) => (say ? null : R.places?.[i])}
    word={say ? (i) => sayWord(R.ok?.[i], R.typed?.[i], R.why?.[i]) : undefined} />;
}

/* a game's name in lines that fit its stretch of the chart (a capital about 0.7 of the size wide, with the spacing) */
const wrap = (label: string, w: number, size: number) => { const fit = Math.max(4, Math.floor((w - 6) / (size * 0.72))), out: string[] = [];
  for (const word of label.toUpperCase().split(" ")) { const l = out[out.length - 1]; if (l != null && (l + " " + word).length <= fit) out[out.length - 1] = l + " " + word; else out.push(word); }
  return out.slice(0, 3); };
/* the night, drawn (the two-team NightChart, for N teams), the whole width of the screen: every team's score after
   each game, drawing itself across, the games named along the bottom; each line ends on the team's place and score,
   the labels kept apart so none sits on another */
function NightChartMany({ pub }: { pub: PubMany }) {
  const L = pub.final!.log, T = pub.teams, W = 890, n = L.length, H = n > 6 ? 284 : 270, PAD = 16, B = H - (n > 6 ? 48 : 30), max = Math.max(1, ...L.flat());
  const x = (i: number) => (i / (n - 1)) * W, y = (v: number) => B - (v / max) * (B - PAD);
  const place = Object.fromEntries(pub.final!.order.map((o) => [o.team, o.place]));
  /* the labels: in score order, each at least 22 apart, kept inside the chart */
  const lab = T.map((_, t) => t).sort((a, b) => T[b].score - T[a].score || a - b), at: Record<number, number> = {};
  let last = -Infinity; for (const t of lab) { const v = Math.max(y(L[n - 1][t]), last + 22); at[t] = v; last = v; }
  const over = last - (B + 6); if (over > 0) for (const t of lab) at[t] -= over;
  return (
    <svg className="night-chart shrink-0" viewBox={`0 0 ${W + 250} ${H}`} width={W + 250} height={H} aria-label={"The scores through the night: " + lab.map((t) => `${T[t].name} ${T[t].score}`).join(", ")}>
      <line x1={0} y1={B} x2={W} y2={B} stroke="rgba(255,255,255,.14)" strokeWidth={2} />
      {L.map((_, i) => i > 0 && <line key={i} x1={x(i)} y1={PAD} x2={x(i)} y2={B} stroke="rgba(255,255,255,.06)" strokeWidth={1} />)}
      {/* each game under its own stretch of the chart, on as many lines as it needs to fit (up to three) */}
      {pub.final!.games.map((gm, i) => { const w = x(i + 1) - x(i), cx = (x(i) + x(i + 1)) / 2, L2 = wrap(gm, w, n > 6 ? 12 : 14); return (
        <text key={"g" + i} x={cx} y={B + 18} textAnchor="middle" fill="rgba(185,192,222,.75)" fontSize={n > 6 ? 12 : 14} fontWeight={700} letterSpacing=".1em">
          {L2.map((l, j) => <tspan key={j} x={cx} dy={j ? (n > 6 ? 13 : 15) : 0}>{l}</tspan>)}</text>); })}
      {T.map((t, i) => <polyline key={i} points={L.map((row, j) => `${x(j).toFixed(1)},${y(row[i]).toFixed(1)}`).join(" ")} fill="none" stroke={t.color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-line" style={{ animationDelay: i * 0.12 + "s" }} />)}
      {lab.map((t) => (
        <g key={"l" + t}>
          <line x1={W} y1={y(L[n - 1][t])} x2={W + 14} y2={at[t]} stroke={T[t].color} strokeWidth={1.5} opacity={0.6} />
          <text x={W + 20} y={at[t] + 6} fill={T[t].color} fontSize={17} fontWeight={800}>{place[t]}. {T[t].name.length > 14 ? T[t].name.slice(0, 13) + "…" : T[t].name}  {T[t].score}</text>
        </g>))}
    </svg>);
}
