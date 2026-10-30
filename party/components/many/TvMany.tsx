"use client";
/* MANY TEAMS: the TV's screens, drawn as the two-team TV draws its mini-games (components/TvGame.tsx): the same
   tracker along the top, the same intro, the same question layouts, the same reveal moves (the answer slams in,
   the calls come down as stamps), a game's result as a board of columns, the winner's slam at the end. Only the
   number of teams changes: up to four sit as the two do, eight pack into rows. No buttons: the host's phone runs it. */
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Clock } from "../Clock";
import { Confetti, FlagImg, PinPhoto } from "../GameParts";
import { ImadBubble } from "../TvGame";
import { PinMap } from "../PinMap";
import { showKm, showNum } from "@/lib/game";
import { LETTERS } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";
import { Ruler } from "../Ruler";
import { BoardMany, byDistance, Dot, finalCols, FlagRowsMany, HudMany, IntroMany, kmOf, leader, paid, RowsMany, summaryCols, takes } from "./PartsMany";

/* a delay after the beat, for the pieces of a reveal that land one after another */
const d = (s: number) => ({ ["--d" as string]: s + "s" });
/* a mini-game's reveal: no drumroll, so its pieces land straight away (the same moves, a shorter beat) */
const QUICK = { ["--beat" as string]: ".15s" };

/* join: where a phone joins this room (Majority Rules puts the QR code up again before it starts)
   host: who taps Start and Next (the strip at the bottom says so); seats: players on each team (the join screen's counts) */
export function TvMany({ pub, join, host, seats }: { pub: PubMany; join?: { url: string; code: string }; host?: string; seats?: number[] }) {
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
  const next = pub.screen === "intro" ? "Start" : pub.screen === "reveal" || pub.screen === "summary" ? "Next" : null;
  const W = takes(pub);
  return (
    /* nothing on the TV can be selected or copied */
    <div className="relative flex flex-col h-full noselect" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <HudMany pub={pub} size="tv" code={join?.code} />
      <ImadBubble imad={pub.imad} cls="many" />

      <div className="flex-1 flex flex-col items-center justify-center text-center enter gap-5 min-h-0" key={key}>
        {/* the intro: the rules; Majority Rules puts the QR code up again, and how many each team has in */}
        {pub.screen === "intro" && g && (g.key === "majority" ? (
          <div className="flex gap-10 items-start w-full">
            <div className="flex-1 min-w-0"><IntroMany pub={pub} size="tv" compact /></div>
            <div className="w-[460px] shrink-0 flex flex-col gap-4 text-left">
              <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>Everyone on their phone</div>
              {join && <div className="flex items-center gap-6">
                <div className="rounded-[18px] p-3 bg-[#f4f6ff] shrink-0"><QRCodeSVG value={join.url} size={140} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
                <div><div className="display leading-none" style={{ fontSize: 72, color: "var(--color-gold)", letterSpacing: "0.08em" }}>{join.code}</div>
                  <div className="text-18 text-[var(--color-ink-2)] mt-2">Not in yet? Scan, pick your team, and you&rsquo;re on its list.</div></div>
              </div>}
              {seats && <div className="grid grid-cols-2 gap-x-6 gap-y-1">{T.map((t, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0 text-20"><Dot t={i} color={t.color} size={18} /><span className="display truncate" style={{ color: t.color }}><bdi>{t.name}</bdi></span><span className="text-[var(--color-ink-2)] shrink-0">· {seats[i] ?? 0} in</span></div>))}
              </div>}
            </div>
          </div>) : <div className="w-full max-w-[1080px]"><IntroMany pub={pub} size="tv" /></div>)}

        {/* the question: the same screens as the two-team TV, with every team's state under the clock */}
        {pub.screen === "q" && g && g.key === "flag" && (<>
          <FlagImg name={pub.flag} h={dense ? 240 : 260} maxW={520} />
          <Clock deadline={pub.deadline} left={pub.left} size={110} />
          <Sent pub={pub} />
        </>)}
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
          <div className="display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }}>{R.answer}</div>
          <FlagRowsMany pub={pub} size="tv" delay={(i) => d(i * 0.08)} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.5), color: W.color }}>{W.text}</div>
        </>)}
        {pub.screen === "reveal" && g && R && g.key === "closest" && (<>
          <div className="text-22 text-[var(--color-ink-2)] max-w-[1000px] truncate">{pub.question}</div>
          <div className="display beat slam leading-none" style={{ ...QUICK, fontSize: dense ? 64 : 80, color: "var(--color-gold)" }}>{showNum(Number(R.answer))}</div>
          {R.notes && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] -mt-3 truncate">{R.notes}</div>}
          <Ruler ans={Number(R.answer)} teams={T.map((t, i) => ({ name: t.name, color: t.color, letter: LETTERS[i], guess: R.nums?.[i] ?? null, win: R.winners.includes(i), pts: R.pts?.[i] }))} />
          <div className="display text-44 beat" style={{ ...QUICK, ...d(0.6), color: W.color }}>{W.text}</div>
        </>)}
        {pub.screen === "reveal" && g && R && g.key === "pin" && R.at && (
          <div className="flex gap-10 items-center w-full">
            <div className="flex-1 min-w-0"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
              ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, label: `${t.name.replace(/[⁨⁩]/g, "")} · ${showKm(R.off?.[i] ?? 0)}` } : null)).filter((x): x is NonNullable<typeof x> => !!x)]}
              fly height={430} size={1.6} interactive={false} label={`Where it is: ${R.place}`} /></div>
            <div className="w-[400px] shrink-0 flex flex-col items-center gap-3">
              <div className="eyebrow text-16">It&rsquo;s here</div>
              <div className="display text-36 leading-tight" style={{ color: "var(--color-gold)" }}>{R.answer}</div>
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
                <span className="shrink-0 text-26 mr-counts flex items-baseline gap-2" aria-label={`${R.counts![i] ?? 0} picked it`}><b>{R.counts![i] ?? 0}</b><span className="text-16 text-[var(--color-ink-2)]">{(R.counts![i] ?? 0) === 1 ? "pick" : "picks"}</span></span>
              </div>); })}</div>
          {R.notes && <div className="max-w-[1300px] text-26 leading-snug -mt-1" style={{ color: "var(--color-gold)" }}>{R.notes}</div>}
          {/* this question, team by team; the game so far is in the bar at the top */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 max-w-[1200px] mr-counts" style={{ fontSize: dense ? 20 : 24 }}>
            <span className="text-[var(--color-ink-2)]">This one:</span>
            {T.map((t, i) => <span key={i} className="whitespace-nowrap"><b style={{ color: t.color }}><bdi>{t.name}</bdi></b> {R.right?.[i] ?? 0} of {R.of?.[i] ?? 0} right</span>)}
          </div>
        </>)}

        {/* a game's result: the board, and who it pays */}
        {pub.screen === "summary" && g && pub.summary && (<>
          <div className="display text-52 leading-none slam" style={{ color: "var(--color-gold)" }}>{g.title}</div>
          <BoardMany pub={pub} cols={summaryCols(pub)} size="tv" label={pub.summary.shares ? "Share right" : "Points this game"} />
          <div className="display text-52" style={{ color: paid(pub).color }}>{paid(pub).text}</div>
          {pub.summary.line && <div className="text-22" style={{ color: "var(--color-gold)" }}>{pub.summary.line}</div>}
        </>)}

        {/* the end: "The winner", a beat, then the name slams down with a flash and a shockwave, and the confetti
            bursts; then the standings come up under it */}
        {pub.screen === "final" && pub.final && (() => {
          const tops = pub.final!.order.filter((x) => x.place === 1).map((x) => x.team), c = tops.length === 1 ? T[tops[0]].color : "var(--color-gold)";
          const name = tops.map((t) => T[t].name).join(" & ");
          return (<>
            <div className="win-flash" style={{ ["--c" as string]: c }} aria-hidden />
            <div className="confetti-late"><Confetti n={140} /></div>
            <div className="eyebrow text-22 enter">{tops.length > 1 ? "A shared win" : "The winner"}</div>
            <div className="relative grid place-items-center">
              <span className="win-ring" style={{ ["--c" as string]: c }} aria-hidden />
              <span className="win-ring r2" style={{ ["--c" as string]: c }} aria-hidden />
              <div className="display win-slam max-w-[1160px] leading-none" style={{ fontSize: (name.length > 10 ? 0.74 : 1) * (recap ? 64 : 150), color: c, transition: "font-size .6s ease" }}><bdi>{name}</bdi></div>
            </div>
            {/* the recap (the two-team night's, for N teams): the night drawn, the nutshell beside it, then the awards */}
            {recap && (<>
              <div className="flex gap-8 items-center justify-center w-full enter" style={{ position: "relative", zIndex: 60 }}>
                {pub.final!.log.length > 2 ? <NightChartMany pub={pub} /> : <BoardMany pub={pub} cols={finalCols(pub)} size="tv" label="Final standings" width={700} />}
                {pub.final!.lines.length > 0 && (
                  <div className="card text-left !py-2 w-[380px] shrink-0">
                    <div className="eyebrow text-13 mb-0.5" style={{ color: "var(--color-gold)" }}>The night in a nutshell</div>
                    <ul className="flex flex-col gap-1 text-18 leading-snug">{pub.final!.lines.map((l) => <li key={l}><bdi>{l}</bdi></li>)}</ul>
                  </div>)}
              </div>
              {pub.final!.awards.length > 0 && (
                <div className="grid gap-3 enter w-full max-w-[1168px]" style={{ gridTemplateColumns: `repeat(${pub.final!.awards.length}, minmax(0, 1fr))`, position: "relative", zIndex: 60 }}>
                  {pub.final!.awards.map((a) => (
                    <div key={a.t} className="card !p-2 !px-3 text-left min-w-0" style={{ borderColor: a.team != null ? T[a.team].color : undefined }}>
                      <div className="eyebrow text-12" style={{ color: "var(--color-gold)" }}>{a.spoon ? "🥄" : "🏆"} {a.t}</div>
                      <div className="text-15 font-bold leading-snug" style={{ color: a.team != null ? T[a.team].color : undefined }}><bdi>{a.who}</bdi></div>
                      {a.note && <div className="text-12 text-[var(--color-ink-2)] italic">{a.note}</div>}
                    </div>))}
                </div>)}
            </>)}
          </>); })()}
      </div>

      {/* between questions: a soft glow in the leader's colour; it fades out when a question comes up */}
      <div className="tv-glow" style={{ ["--c" as string]: lead != null ? T[lead].color : "transparent", opacity: lead != null && pub.screen !== "q" ? 1 : 0 }} aria-hidden />
      {/* the strip along the bottom, kept clear of the screen's content: news, and who taps Next, small, on the right */}
      <div className="tv-foot" role="status" aria-live="polite">
        {toastOn && <span key={pub.toast!.id} className="tv-note enter">{pub.toast!.text}</span>}
        {host && next && <span className="next-hint">Waiting for <b><bdi>{host}</bdi></b> to tap {next}</span>}
      </div>
    </div>);
}

/* every team: locked in, or still thinking (the two-team "Team A: thinking…", for N teams: a row that wraps, or a column) */
function Sent({ pub, column }: { pub: PubMany; column?: boolean }) {
  const T = pub.teams, dense = T.length > 4, pin = pub.game?.key === "pin", mr = pub.game?.key === "majority";
  return (
    <div className={"flex " + (column ? "flex-col items-center gap-0.5" : "flex-wrap justify-center gap-y-0.5 " + (dense ? "gap-x-5" : "gap-x-10"))} role="status" style={{ maxWidth: 1168 }}>{T.map((t, i) => (
      <span key={i} className="font-bold whitespace-nowrap" style={{ fontSize: column && dense ? 20 : 22, color: pub.sent[i] ? t.color : "var(--color-ink-3)" }}>
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

/* the night, drawn (the two-team NightChart, for N teams): every team's score after each game, drawing itself
   across; each line ends on the team's place and score, the labels kept apart so none sits on another */
function NightChartMany({ pub }: { pub: PubMany }) {
  const L = pub.final!.log, T = pub.teams, W = 480, H = 190, PAD = 14, n = L.length, max = Math.max(1, ...L.flat());
  const x = (i: number) => (i / (n - 1)) * W, y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const place = Object.fromEntries(pub.final!.order.map((o) => [o.team, o.place]));
  /* the labels: in score order, each at least 22 apart, kept inside the chart */
  const lab = T.map((_, t) => t).sort((a, b) => T[b].score - T[a].score || a - b), at: Record<number, number> = {};
  let last = -Infinity; for (const t of lab) { const v = Math.max(y(L[n - 1][t]), last + 22); at[t] = v; last = v; }
  const over = last - (H - 4); if (over > 0) for (const t of lab) at[t] -= over;
  return (
    <svg className="night-chart shrink-0" viewBox={`0 0 ${W + 250} ${H}`} width={W + 250} height={H} aria-label={"The scores through the night: " + lab.map((t) => `${T[t].name} ${T[t].score}`).join(", ")}>
      <line x1={0} y1={H - PAD} x2={W} y2={H - PAD} stroke="rgba(255,255,255,.14)" strokeWidth={2} />
      {L.map((_, i) => i > 0 && <line key={i} x1={x(i)} y1={PAD} x2={x(i)} y2={H - PAD} stroke="rgba(255,255,255,.06)" strokeWidth={1} />)}
      {T.map((t, i) => <polyline key={i} points={L.map((row, j) => `${x(j).toFixed(1)},${y(row[i]).toFixed(1)}`).join(" ")} fill="none" stroke={t.color} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-line" style={{ animationDelay: i * 0.12 + "s" }} />)}
      {lab.map((t) => (
        <g key={"l" + t}>
          <line x1={W} y1={y(L[n - 1][t])} x2={W + 14} y2={at[t]} stroke={T[t].color} strokeWidth={1.5} opacity={0.6} />
          <text x={W + 20} y={at[t] + 6} fill={T[t].color} fontSize={17} fontWeight={800}>{place[t]}. {T[t].name.length > 14 ? T[t].name.slice(0, 13) + "…" : T[t].name} · {T[t].score}</text>
        </g>))}
    </svg>);
}
