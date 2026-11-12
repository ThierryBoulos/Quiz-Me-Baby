"use client";
/* MANY TEAMS: the TV's screens, drawn as the two-team TV draws its mini-games (components/TvGame.tsx): the same
   tracker along the top, the same intro, the same question layouts, the same reveal moves (the answer slams in,
   the calls come down as stamps), a game's result as a board of columns, the winner's slam at the end. Only the
   number of teams changes: up to four sit as the two do, eight pack into rows. No buttons: the host's phone runs it. */
import { wholeSentences } from "@/lib/sentences";
import { useEffect, useState } from "react";
import { FitBody } from "../TvStage";
import { WinName } from "../Motion";
import { QRCodeSVG } from "qrcode.react";
import { Clock, useSecondsLeft } from "../Clock";
import { Board, Confetti, FlagImg, PinPhoto } from "../GameParts";
import { MapView } from "../MapView";
import { PinMap } from "../PinMap";
import { showKm, showNum } from "@/lib/game";
import { LETTERS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { Ruler } from "../Ruler";
import { NightIntroTv } from "../NightIntro";
import { ImadBubble } from "../TvGame";
import { RouletteTv } from "../Roulette";
import { StakesTv } from "../Stakes";
import { SeeCredit, SeePicture, seeWho } from "../See";
import { BarsMany, BoardMany, BubblesMany, byDistance, DeparturesMany, GlassesMany, LecternsMany, FlagPoleMany, PinsMapMany, Dot, finalCols, FlagRowsMany, HudMany, IntroMany, kmOf, leader, paid, RowsMany, splitIng, takes, revealOf } from "./PartsMany";

/* a delay after the beat, for the pieces of a reveal that land one after another */
const d = (s: number) => ({ ["--d" as string]: s + "s" });
/* a mini-game's reveal: no drumroll, so its pieces land straight away (the same moves, a shorter beat) */
const QUICK = { ["--beat" as string]: ".15s" };

/* join: where a phone joins this room (Majority Rules puts the QR code up again before it starts)
   host: who taps Start and Next (the strip at the bottom says so); seats: players on each team (the join screen's counts) */
/* sound: this is the TV itself (it plays the pours and the coins landing; another screen showing the TV stays quiet) */
/* the TV's line while the night waits for a host (8 Nov): big enough to read across the room */
function HostGoneTv({ info }: { info: { name: string | null; openAt: number } }) {
  const left = useSecondsLeft(info.openAt);
  return <span className="tv-note enter" style={{ color: "var(--color-gold)", fontWeight: 800 }}>
    {info.name ? <><bdi>{info.name}</bdi>&rsquo;s phone has gone quiet: the night is waiting for a host. </> : "The night has no host, so it is waiting. "}
    {left > 0 ? `In ${left} s, anyone can take over as the host on their phone.` : "Anyone can take over now: tap Be the host on your phone."}</span>;
}

export function TvMany({ pub, join, host, seats, sound = false }: { pub: PubMany; join?: { url: string; code: string }; host?: string; seats?: number[]; sound?: boolean }) {
  const g = pub.game, R = pub.reveal, T = pub.teams, k = T.length, dense = k > 4;
  const key = pub.screen + pub.step;
  /* a message shows for four seconds, then goes */
  const [shownToast, setShownToast] = useState<number | null>(null);
  const tid = pub.toast?.id ?? null;
  useEffect(() => { if (tid == null) return; setShownToast(tid); const t = setTimeout(() => setShownToast(null), 4000); return () => clearTimeout(t); }, [tid]);
  const toastOn = !!pub.toast && shownToast === pub.toast.id;
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
            <div className="text-26 text-[var(--color-ink-2)] mt-2">The question comes back when the clock restarts.</div></div>
        </div>)}

      <FitBody className={"flex-1 flex flex-col items-center justify-center text-center enter min-h-0" + (pub.screen === "reveal" && (g?.key === "airport" || g?.key === "map") ? " gap-4" : " gap-5") + (pub.screen === "final" && recap ? " recap-on" : "")} key={key}>
        {/* the intro: the rules; Majority Rules puts the QR code up again, and how many each team has in */}
        {pub.screen === "intro" && g && (g.key === "majority" ? (
          <div className="flex gap-10 items-start w-full">
            <div className="flex-1 min-w-0"><IntroMany pub={pub} size="tv" compact /></div>
            {/* joining: the code and its QR side by side, one short line under them; then who's in, a team a row,
                the name on the left and its count lined up on the right (the owner, 31 Oct: it read untidy) */}
            <div className="w-[440px] shrink-0 flex flex-col gap-4 text-left">
              {join && (<>
                <div className="flex items-center gap-5">
                  <div className="rounded-[16px] p-2.5 bg-[#f4f6ff] shrink-0"><QRCodeSVG value={join.url} size={dense ? 112 : 132} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
                  <div className="min-w-0">
                    <div className="eyebrow text-18 whitespace-nowrap">Not in yet? Join with</div>
                    <div className="display leading-none mt-1" style={{ fontSize: dense ? 60 : 72, color: "var(--color-gold)", letterSpacing: "0.08em" }}>{join.code}</div>
                  </div>
                </div>
              </>)}
              {seats && (
                <div className="card !py-2 !px-4 flex flex-col" role="list" aria-label="Who's in, team by team">
                  <div className="eyebrow text-18 mb-1">On each team&rsquo;s list</div>
                  <div className={"grid gap-x-6 " + (k > 4 ? "grid-cols-2" : "grid-cols-1")}>
                    {T.map((t, i) => (
                      <div key={i} role="listitem" className="flex items-center gap-2 min-w-0 py-0.5" style={{ fontSize: 18 }}>
                        <Dot t={i} color={t.color} size={k > 4 ? 14 : 16} />
                        <span className="font-bold truncate flex-1" style={{ color: t.color }}><bdi>{t.name}</bdi></span>
                        <span className="tabular-nums font-bold shrink-0 text-[var(--color-ink-2)]">{seats[i] ?? 0}</span>
                      </div>))}
                  </div>
                </div>)}
            </div>
          </div>) : <div className="w-full max-w-[1080px]"><IntroMany pub={pub} size="tv" /></div>)}

        {/* the question: the same screens as the two-team TV, with every team's state under the clock */}
        {pub.screen === "q" && g && g.key === "flag" && (<>
          <FlagImg name={pub.flag} h={dense ? 240 : 260} maxW={520} />
          <Clock deadline={pub.deadline} left={pub.left} size={110} />
          <Sent pub={pub} />
        </>)}
        {/* What Do You See?: the picture clears as the clock runs; every team's state beside it */}
        {pub.screen === "q" && g && g.key === "see" && pub.see && (
          <div className="flex gap-12 items-center w-full justify-center">
            <div className="flex-1 min-w-0 flex justify-center"><SeePicture see={pub.see} deadline={pub.deadline} left={pub.left} w={dense ? 660 : 720} big /></div>
            <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
              <div className="display text-44 leading-tight" style={{ color: "var(--color-gold)" }}>What do you see?</div>
              <Clock deadline={pub.deadline} left={pub.left} size={120} />
              <Sent pub={pub} column={!dense} />
              <div className="text-20 text-[var(--color-ink-2)] leading-snug">One guess each. The faster right, the more points.</div>
            </div>
          </div>)}
        {/* a question round, and Don't Say the Same's prompt: the words big, the clock, every team's state */}
        {pub.screen === "q" && g && (g.key === "quiz" || g.key === "say" || g.key === "sudden") && (<>
          {g.key === "sudden" && <div className="display text-36 leading-none" style={{ color: "var(--color-gold)" }}>First right answer wins the night</div>}
          {pub.theme && <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>{pub.theme}</div>}
          <div className="font-bold max-w-[1100px]" style={{ fontSize: (pub.question || "").length > 160 ? 34 : (pub.question || "").length > 100 ? 40 : 50, lineHeight: 1.15 }}>{pub.question}</div>
          {g.key === "say" && <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px]">One answer each. No points for the app&rsquo;s secret answer, or the same word as another team.</div>}
          <Clock deadline={pub.deadline} left={pub.left} size={130} />
          <Sent pub={pub} />
        </>)}
        {/* Guess the Airport, Guess the Map: the board or the map, the clock and the teams beside it */}
        {pub.screen === "q" && g && (g.key === "airport" || g.key === "map") && (
          <div className="flex gap-10 items-center w-full justify-center">
            <div className="flex-1 min-w-0 flex justify-center">{g.key === "airport" ? <Board air={pub.airport} size="tv" flip /> : pub.map && <MapView id={pub.map.id} rev={pub.map.rev} reveal={false} hint={!!pub.map.hint} maxH={460} still />}</div>
            <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
              <div className="display text-40 leading-tight" style={{ color: "var(--color-gold)" }}>{g.key === "airport" ? "Which airport?" : "What do they have in common?"}</div>
              <Clock deadline={pub.deadline} left={pub.left} size={120} />
              <Sent pub={pub} column={!dense} />
            </div>
          </div>)}
        {/* the Cocktail or Dish: the ingredients come up one by one; a team that guessed wrong is out of this one */}
        {pub.screen === "q" && g && g.key === "dish" && pub.dish && (
          <div className="flex gap-12 items-center w-full justify-center">
            <ol className="text-left grid gap-2 flex-1 min-w-0 max-w-[620px]" style={{ fontSize: pub.dish.n > 8 ? 22 : 28 }}>
              {pub.dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return (
                <li key={i} className="enter flex gap-4 items-baseline"><span className="font-bold">{name}</span>{qty && <span className="text-[var(--color-ink-2)]" style={{ fontSize: "0.8em" }}>{qty}</span>}</li>); })}
            </ol>
            <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
              <div className="display text-44" style={{ color: "var(--color-gold)" }}>Which {pub.dish.kind.toLowerCase()}?</div>
              <div className="text-22 text-[var(--color-ink-2)]"><b>{pub.dish.ings.length}</b> of {pub.dish.n} ingredients</div>
              <Clock deadline={pub.deadline} left={pub.left} size={110} />
              <Sent pub={pub} column={!dense} />
            </div>
          </div>)}
        {/* Secret Stakes: the themes and who has bet; "Bets are in" while each team answers on its own phones; the reveal,
            last place first; what each team won or lost */}
        {g && g.key === "stakes" && pub.stakes && ["pick", "q", "reveal", "summary"].includes(pub.screen) && (
          <StakesTv sk={pub.stakes} screen={({ pick: "stakesPick", q: "stakesQ", reveal: "stakesReveal", summary: "stakesSummary" } as Record<string, string>)[pub.screen]}
            teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} sent={pub.sent}
            clock={<Clock deadline={pub.deadline} left={pub.left} size={pub.screen === "q" ? 140 : 100} />} />)}
        {/* Russian Roulette: the barrel spins, each team's chamber lights up; at the reveal they click, the bullet last */}
        {(pub.screen === "q" || pub.screen === "reveal") && g && g.key === "roulette" && pub.roulette && (
          <RouletteTv rr={pub.roulette} teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] }))} sent={pub.sent} typed={R?.typed} ok={R?.ok}
            reveal={pub.screen === "reveal"} sound={sound} clock={<Clock deadline={pub.deadline} left={pub.left} size={dense ? 96 : 110} />} />)}
        {pub.screen === "q" && g && g.key === "closest" && (<>
          <div className="font-bold max-w-[1000px]" style={{ fontSize: (pub.question || "").length > 110 ? 40 : 50, lineHeight: 1.15 }}>{pub.question}</div>
          <Clock deadline={pub.deadline} left={pub.left} size={140} />
          <Sent pub={pub} />
        </>)}
        {pub.screen === "q" && g && g.key === "pin" && (
          <div className="flex gap-12 items-center w-full justify-center">
            <div className="flex-1 min-w-0 flex justify-center"><PinPhoto pin={pub.pin} h={430} credit /></div>
            <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
              <div className="display text-44" style={{ color: "var(--color-gold)" }}>Where is this?</div>
              <Clock deadline={pub.deadline} left={pub.left} size={120} />
              <Sent pub={pub} column />
            </div>
          </div>)}
        {pub.screen === "q" && g && g.key === "majority" && pub.options && (<>
          <div className="font-bold max-w-[1400px]" style={{ fontSize: (pub.question || "").length > 90 ? 36 : 44, lineHeight: 1.12 }}>{pub.question}</div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-[1400px]">{pub.options.map((o) => <div key={o} className="mr-tv-opt rev"><span className="flex-1 min-w-0"><bdi>{o}</bdi></span></div>)}</div>
          <div className="flex items-center gap-10">
            <Clock deadline={pub.deadline} left={pub.left} size={100} />
            <Answered pub={pub} />
          </div>
          <Sent pub={pub} />
        </>)}

        {/* the reveal: the answer lands, then the calls, then who takes it */}
        {pub.screen === "reveal" && g && R && g.key === "flag" && (<>
          <FlagImg name={pub.flag} h={dense ? 120 : 170} maxW={400} />
          <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }}>{R.answer}</div>
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.5), color: W.color }}>{W.text}</div>
        </>)}
        {/* What Do You See?: the whole picture and what it is, who got it first and how fast, then every team's guess */}
        {pub.screen === "reveal" && g && R && g.key === "see" && pub.see && (() => { const who = seeWho(pub.see, T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i] })), R.winners?.length); return (<>
          {/* (the picture and what it is side by side, in the middle: 12 Nov) */}
          <div className="grid items-center justify-center gap-12 w-full max-w-[1160px]" style={{ gridTemplateColumns: `${dense ? 400 : 480}px minmax(0, 600px)` }}>
            <div className="flex flex-col items-center gap-1 min-w-0"><SeePicture see={pub.see} clear w={dense ? 400 : 480} big alt={R.answer} /><SeeCredit see={pub.see} size={dense ? 13 : 14} /></div>
            <div className="flex flex-col items-center gap-3 min-w-0">
              <div className="eyebrow text-18">It&rsquo;s</div>
              <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: (R.answer || "").length > 22 ? (dense ? 40 : 48) : dense ? 56 : 70, color: "var(--color-gold)" }}>{R.answer}</div>
              <div className="display text-36 beat" style={{ ...QUICK, ...d(0.5), color: who.color }}>{who.text}</div>
            </div>
          </div>
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(0.3 + i * 0.08)} />
        </>); })()}
        {/* a typed answer's reveal (question rounds, airports, maps, Don't Say the Same, the Cocktail or Dish): what was
            asked, small; the answer slams in; every team's answer and its call; who takes it */}
        {pub.screen === "reveal" && g && R && ["quiz", "airport", "map", "say", "dish", "sudden"].includes(g.key) && (<>
          {g.key === "map" && pub.map ? <MapView id={pub.map.id} rev={pub.map.rev} reveal maxH={dense ? 130 : 200} legend={false} still />
            : g.key === "airport" ? <div className="w-full max-w-[860px] board-tight"><Board air={pub.airport} size="reveal" /></div>
            : pub.question ? <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{pub.question}</div>
            : pub.dish ? <div className="text-20 text-[var(--color-ink-2)] max-w-[1100px] leading-snug clamp2">{pub.dish.ings.map((t) => splitIng(t)[1]).join(", ")}</div> : null}
          {g.key === "say" && <div className="eyebrow text-18 -mb-3">The app&rsquo;s secret answer</div>}
          <div className="ans-board display beat slam leading-none max-w-[1160px]" style={{ ...QUICK, fontSize: (R.answer || "").length > 34 ? (dense ? 40 : 44) : (R.answer || "").length > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{R.answer}</div>
          {/* (the airport's explanation stays on the phones with eight teams: the board and eight answers fill the TV) */}
          {R.notes && g.key !== "say" && !(g.key === "airport" && dense) && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug">{wholeSentences(R.notes)}</div>}
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.5), color: W.color }}>{W.text}</div>
        </>)}
        {pub.screen === "reveal" && g && R && g.key === "closest" && (<>
          <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] leading-snug clamp2">{pub.question}</div>
          <div className="ans-board display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }}>{showNum(Number(R.answer))}</div>
          {R.notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] leading-snug">{wholeSentences(R.notes)}</div>}
          <Ruler ans={Number(R.answer)} teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i], guess: R.nums?.[i] ?? null, win: R.winners.includes(i), pts: R.pts?.[i] }))} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.6), color: W.color }}>{W.text}</div>
        </>)}
        {pub.screen === "reveal" && g && R && g.key === "pin" && R.at && (
          <div className="flex gap-10 items-center w-full">
            <div className="flex-1 min-w-0"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
              ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, ...(T.length > 4 ? { label: showKm(R.off?.[i] ?? 0), letter: LETTERS[i] } : { label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` }) } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
              fly height={430} size={1.6} interactive={false} label={`Where it is: ${R.place}`} /></div>
            <div className="w-[400px] shrink-0 flex flex-col items-center gap-3">
              <div className="eyebrow text-18">It&rsquo;s here</div>
              <div className="ans-board display text-36 leading-tight" style={{ color: "var(--color-gold)" }}>{R.answer}</div>
              <div className="text-22 text-[var(--color-ink-2)] -mt-1">{R.place}</div>
              <div className="w-full mt-2"><RowsMany pub={pub} order={byDistance(pub)} right={(t) => kmOf(pub, t)} size="tv" pts={R.pts} /></div>
              <div className="display text-36 mt-3" style={{ color: W.color }}>{W.text}</div>
            </div>
          </div>)}
        {pub.screen === "reveal" && g && R && g.key === "majority" && R.counts && (<>
          <div className="font-bold max-w-[1400px]" style={{ fontSize: (pub.question || "").length > 90 ? 36 : 44, lineHeight: 1.12 }}>{pub.question}</div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-[1400px]">{(pub.options || []).map((o, i) => { const ok = R.answer === o;
            /* the wrong answers drop away one after another, then the right one lights up; how many picked each */
            const n = (pub.options || []).filter((x, j) => j < i && x !== R.answer).length;
            return (
              <div key={o} className={"mr-tv-opt rev " + (ok ? "ok mr-win" : "dim mr-out")} style={d(ok ? 0.75 : 0.12 + n * 0.2)}>
                <span className="flex-1 min-w-0"><bdi>{o}</bdi></span>
                <span className="shrink-0 text-26 mr-counts flex items-baseline gap-2" aria-label={`${R.counts![i] ?? 0} picked it`}><b>{R.counts![i] ?? 0}</b><span className="text-18 text-[var(--color-ink-2)]">{(R.counts![i] ?? 0) === 1 ? "pick" : "picks"}</span></span>
              </div>); })}</div>
          {R.notes && <div className="max-w-[1300px] text-26 leading-snug -mt-1" style={{ color: "var(--color-gold)" }}>{R.notes}</div>}
          {/* this question, team by team; the game so far is in the bar at the top */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 max-w-[1200px] mr-counts" style={{ fontSize: dense ? 20 : 24 }}>
            <span className="text-[var(--color-ink-2)]">This one:</span>
            {T.map((t, i) => <span key={i} className="whitespace-nowrap"><b style={{ color: t.color }}><bdi>{t.name}</bdi></b> {R.right?.[i] ?? 0} of {R.of?.[i] ?? 0} right</span>)}
          </div>
        </>)}

        {/* a game's result: the board, and who it pays */}
        {pub.screen === "summary" && g && g.key !== "stakes" && pub.summary && (<>
          {/* five teams or more with the bars: a size smaller, so it all sits under the tracker */}
          <div className={"display leading-none slam " + (dense ? "text-40" : "text-52")} style={{ color: "var(--color-gold)" }}>{g.title}</div>
          {/* each game's points in a look of its own, never the totals' row (the owner, 30 Oct) */}
          {g.key === "majority" ? <BarsMany pub={pub} />
            : g.key === "flag" ? <FlagPoleMany pub={pub} />
            : g.key === "closest" ? <Ruler ans={0} scale teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i], guess: pub.summary!.pts[i], win: pub.summary!.places[i] === 1 && pub.summary!.award[i] > 0, pts: pub.summary!.award[i] }))} />
            : g.key === "pin" || g.key === "map" ? <PinsMapMany pub={pub} map={<PinMap marks={[]} interactive={false} height="100%" label="The world" bare />} />
            : g.key === "airport" ? <DeparturesMany pub={pub} />
            : g.key === "dish" ? <GlassesMany pub={pub} sound={sound} />
            : g.key === "say" ? <BubblesMany pub={pub} />
            : g.key === "quiz" ? <LecternsMany pub={pub} />
            : <BarsMany pub={pub} />}
          {/* the line comes once the last team (the winner) is in */}
          <div className={"rv display " + (dense ? "text-44" : "text-52")} style={{ color: paid(pub).color, animationDelay: revealOf(pub.summary, T.length).done + "s" }}>{paid(pub).text}</div>
          {pub.summary.line && <div className="rv text-18 max-w-[900px] truncate" style={{ color: "var(--color-gold)", animationDelay: revealOf(pub.summary, T.length).done + 0.2 + "s" }}><bdi>{pub.summary.line}</bdi></div>}
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
        {pub.screen === "reveal" && pub.contest ? <span className="next-hint"><b style={{ color: T[pub.contest.by].color }}><bdi>{T[pub.contest.by].name}</bdi></b> contest {pub.contest.t !== pub.contest.by ? <><b style={{ color: T[pub.contest.t].color }}><bdi>{T[pub.contest.t].name}</bdi></b>&rsquo;s </> : "their "}call. {host ? <><b><bdi>{host}</bdi></b> decides</> : "The host decides"}.</span>
          : host && next && <span className="next-hint">Waiting for <b><bdi>{host}</bdi></b> to tap {next}</span>}
      </div>
    </div>);
}

/* sudden death: the fastest right answer, the night's winner */
/* every team: locked in, or still thinking (the two-team "Team A: thinking…", for N teams: a row that wraps, or a
   column); in sudden death only the teams level at the top */
function Sent({ pub, column }: { pub: PubMany; column?: boolean }) {
  const only = pub.game?.only, T = pub.teams.map((t, i) => ({ ...t, i })).filter((t) => !only || only.includes(t.i)), dense = T.length > 4, pin = pub.game?.key === "pin", mr = pub.game?.key === "majority";
  /* five teams or more: one row of lettered dots, lit with a tick when the team is in (two rows of names were too much) */
  if (dense && !column) return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1" role="status" aria-label={T.map((t) => `${t.name} ${pub.sent[t.i] ? "in" : "not yet"}`).join(", ")}>
      {T.map(({ i, color }) => (
        <span key={i} className="flex items-center gap-1.5 font-bold text-20" style={{ opacity: pub.sent[i] ? 1 : 0.4, color: pub.sent[i] ? color : "var(--color-ink-3)" }}>
          <Dot t={i} color={color} size={22} />{pub.sent[i] ? "✓" : "…"}</span>))}
    </div>);
  return (
    <div className={"flex " + (column ? "flex-col items-center gap-0.5" : "flex-wrap justify-center gap-y-0.5 " + (dense ? "gap-x-5" : "gap-x-10"))} role="status" style={{ maxWidth: 1168 }}>{T.map(({ i, ...t }) => (
      <span key={i} className="font-bold whitespace-nowrap" style={{ fontSize: column && dense ? 20 : 22, color: pub.sent[i] ? t.color : "var(--color-ink-3)" }}>
        {/* a wrong guess in the Cocktail or Dish reads "locked in" too: who got it shows at the reveal (the owner, 2 Nov) */}
        <bdi>{t.name}</bdi>: {pub.sent[i] ? (pin ? "pin in" : mr ? "all in" : "locked in") : pin ? "placing…" : mr ? "answering…" : "thinking…"}</span>))}
    </div>);
}
/* Majority Rules: how many of the room have answered (the roster is names only, so the count is the room's;
   each team's state is the row under the clock) */
function Answered({ pub }: { pub: PubMany }) {
  const roster = pub.roster || [], voted = new Set(pub.voted || []);
  const n = roster.length, v = roster.filter((r) => voted.has(r)).length;
  return <span className="font-bold text-26 text-left" style={{ color: v >= n && n > 0 ? "var(--color-ok)" : "var(--color-ink-2)" }}>{v} of {n}<br />answered</span>;
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
