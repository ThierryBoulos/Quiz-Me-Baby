"use client";
/* MANY TEAMS: the TV's screens. Its own HUD (up to 8 teams across the top), the four games' question and
   reveal screens, a game's summary and the final standings. Shares only leaf pieces with the two-team TV. */
import { Clock } from "../Clock";
import { Confetti, FlagImg, PinPhoto } from "../GameParts";
import { PinMap } from "../PinMap";
import { showKm, showNum } from "@/lib/game";
import { LETTERS, MANY_TITLES } from "@/lib/many/logic";
import type { PubMany } from "@/lib/many/view";

const RULES: Record<string, string[]> = {
  majority: ["Everyone plays, on their own phone: 15 questions, four answers each.", "One tap and it's locked. No answer counts as wrong.", "Each team scores the share of its answers that are right."],
  flag: ["A flag goes up. Every captain types the country.", "Every team that gets it takes the leg.", "Ten flags."],
  closest: ["A number question for every captain at once.", "The nearest guess takes the leg; equal distance, they all take it.", "Five numbers."],
  pin: ["A landmark's photo. Every captain drops a pin on their phone.", "The nearest pin takes the leg.", "Seven landmarks."],
};

function Badge({ pub, t, big }: { pub: PubMany; t: number; big?: boolean }) {
  return <span className="inline-grid place-items-center rounded-full font-bold shrink-0" style={{ background: pub.teams[t].color, color: "#04050e", width: big ? 34 : 24, height: big ? 34 : 24, fontSize: big ? 18 : 13 }}>{LETTERS[t]}</span>;
}

function Hud({ pub }: { pub: PubMany }) {
  const g = pub.game;
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-[var(--line)]">
      <div className="flex items-center justify-between gap-2">
        {pub.teams.map((t, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            <Badge pub={pub} t={i} />
            <span className="truncate font-bold text-16" style={{ color: t.color, maxWidth: 110 }}>{t.name}</span>
            <span className="display text-36 leading-none">{t.score}</span>
          </div>))}
      </div>
      {g && pub.screen !== "final" && <div className="text-center eyebrow text-15" style={{ color: "var(--color-gold)" }}>{g.title} · {pub.screen === "intro" ? `game ${g.index + 1} of ${g.count}` : pub.screen === "summary" ? "result" : `${g.leg} of ${g.of}`}</div>}
    </div>);
}

function Sent({ pub }: { pub: PubMany }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {pub.teams.map((t, i) => (
        <span key={i} className="chip flex items-center gap-2" style={{ borderColor: pub.sent[i] ? t.color : undefined, opacity: pub.sent[i] ? 1 : 0.55, fontSize: 16 }}>
          <Badge pub={pub} t={i} />{t.name}{pub.sent[i] ? " ✓" : "…"}</span>))}
    </div>);
}

export function TvMany({ pub, join }: { pub: PubMany; join?: { url: string; code: string } }) {
  const g = pub.game, R = pub.reveal, T = pub.teams;
  return (
    <div className="flex flex-col h-full gap-4">
      <Hud pub={pub} />
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center min-h-0">
        {pub.screen === "intro" && g && (<>
          <div className="eyebrow text-18" style={{ color: "var(--color-gold)" }}>Game {g.index + 1} of {g.count}</div>
          <div className="display" style={{ fontSize: 96 }}>{MANY_TITLES[g.key]}</div>
          <ol className="card text-left text-22 flex flex-col gap-2 max-w-[1000px]">{(RULES[g.key] || []).map((l, i) => <li key={i}><b style={{ color: "var(--color-gold)" }}>{i + 1}.</b> {l}</li>)}
            <li><b style={{ color: "var(--color-gold)" }}>{(RULES[g.key] || []).length + 1}.</b> The winner takes 2 points; a tie at the top is a point each.</li></ol>
          {g.key === "majority" && join && <div className="text-20 text-[var(--color-ink-2)]">Not in yet? Join at <b>{join.url.replace(/^https?:\/\//, "")}</b> · code <b style={{ color: "var(--color-gold)" }}>{join.code}</b></div>}
          <div className="text-18 text-[var(--color-ink-3)]">The host starts it.</div>
        </>)}

        {pub.screen === "q" && g && (<>
          {g.key === "flag" && <FlagImg name={pub.flag} h={300} maxW={700} />}
          {g.key === "pin" && <PinPhoto pin={pub.pin} h={400} credit />}
          {pub.question && <div className="font-bold max-w-[1100px]" style={{ fontSize: pub.question.length > 110 ? 36 : 46, lineHeight: 1.15 }}>{pub.question}</div>}
          {g.key === "majority" && pub.options && <div className="grid grid-cols-2 gap-4 w-full max-w-[1100px]">{pub.options.map((o) => <div key={o} className="mr-tv-opt"><bdi>{o}</bdi></div>)}</div>}
          <div className="flex items-center gap-10">
            <Clock deadline={pub.deadline} left={pub.left} size={120} />
            {g.key === "majority" ? <div className="text-24 font-bold">{pub.voted?.length ?? 0} of {pub.roster?.length ?? 0} answered</div> : <Sent pub={pub} />}
          </div>
        </>)}

        {pub.screen === "reveal" && g && R && (<>
          <div className="eyebrow text-18">The answer</div>
          <div className="display leading-none" style={{ fontSize: g.key === "majority" || R.answer.length > 18 ? 56 : 80, color: "var(--color-gold)" }}>{g.key === "closest" ? showNum(Number(R.answer)) : R.answer}</div>
          {(R.notes || R.place) && g.key !== "pin" && <div className="text-20 text-[var(--color-ink-2)] max-w-[1000px] truncate">{R.place || R.notes}</div>}
          {g.key === "flag" && (
            <div className="grid gap-3 w-full" style={{ gridTemplateColumns: `repeat(${Math.min(T.length, 4)}, minmax(0, 1fr))`, maxWidth: Math.min(T.length, 4) * 295 }}>
              {T.map((t, i) => (
                <div key={i} className="card !p-3 text-left" style={{ borderColor: R.ok?.[i] ? "var(--color-ok)" : "var(--line)" }}>
                  <div className="flex items-center gap-2"><Badge pub={pub} t={i} /><b className="truncate" style={{ color: t.color }}>{t.name}</b></div>
                  <div className="text-20 truncate mt-1">{R.typed?.[i] ?? <span className="text-[var(--color-ink-3)]">No answer</span>}</div>
                  <div className="text-14 font-bold mt-1" style={{ color: R.ok?.[i] ? "var(--color-ok)" : "var(--color-no)" }}>{R.ok?.[i] ? "RIGHT" : "WRONG"}</div>
                </div>))}
            </div>)}
          {(g.key === "closest" || g.key === "pin") && (
            <div className={"flex gap-6 w-full max-w-[1180px] items-start " + (g.key === "pin" ? "" : "justify-center")}>
              {g.key === "pin" && R.at && <div className="flex-1 min-w-0"><PinMap marks={[{ at: R.at, kind: "truth", color: "#F5C518", label: R.answer },
                ...T.map((t, i) => (R.pins?.[i] ? { at: R.pins[i]!, kind: "pin" as const, color: t.color, label: LETTERS[i] } : null)).filter((x): x is NonNullable<typeof x> => !!x)]} fly height={300} interactive={false} label={`Where it is: ${R.place}`} /></div>}
              <ol className="flex flex-col gap-1.5 text-left min-w-[380px]">
                {T.map((_, i) => i).filter((i) => R.off?.[i] != null).sort((a, b) => (R.off![a]! - R.off![b]!)).concat(T.map((_, i) => i).filter((i) => R.off?.[i] == null)).map((i) => (
                  <li key={i} className="flex items-center gap-3 text-22" style={{ fontWeight: R.winners.includes(i) ? 800 : 500 }}>
                    <Badge pub={pub} t={i} /><span className="truncate flex-1" style={{ color: T[i].color }}>{T[i].name}</span>
                    <span>{R.off?.[i] == null ? "—" : g.key === "pin" ? showKm(R.off[i]!) : showNum(R.nums?.[i] ?? 0)}</span>
                    {g.key === "closest" && R.off?.[i] != null && <span className="text-16 text-[var(--color-ink-2)]">{R.off[i] === 0 ? "spot on" : "off by " + showNum(R.off[i]!)}</span>}
                    {R.winners.includes(i) && <span style={{ color: "var(--color-ok)" }}>✓</span>}
                  </li>))}
              </ol>
            </div>)}
          {g.key === "majority" && R.counts && (<>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[1000px]">{(pub.options || []).map((o, i) => (
              <div key={o} className={"mr-tv-opt " + (o === R.answer ? "ok" : "dim")}><span className="flex-1"><bdi>{o}</bdi></span><b>{R.counts![i] ?? 0}</b></div>))}</div>
            <div className="flex flex-wrap justify-center gap-4 text-18">{T.map((t, i) => <span key={i} className="flex items-center gap-2"><Badge pub={pub} t={i} />{R.right?.[i] ?? 0} of {R.of?.[i] ?? 0}</span>)}</div>
          </>)}
          {g.key !== "majority" && <div className="display text-36" style={{ color: "var(--color-gold)" }}>{R.winners.length === 0 ? "Nobody takes it" : R.winners.length === 1 ? `${T[R.winners[0]].name} takes it` : `${R.winners.length} teams take it`}</div>}
        </>)}

        {pub.screen === "summary" && g && pub.summary && (<>
          <div className="display" style={{ fontSize: 72, color: "var(--color-gold)" }}>{MANY_TITLES[g.key]}</div>
          <ol className="flex flex-col gap-2 text-left">
            {T.map((_, i) => i).sort((a, b) => (pub.summary!.shares ? pub.summary!.shares[b] - pub.summary!.shares[a] : pub.summary!.wins[b] - pub.summary!.wins[a])).map((i) => (
              <li key={i} className="flex items-center gap-4 text-26">
                <Badge pub={pub} t={i} big /><span className="w-[300px] truncate font-bold" style={{ color: T[i].color }}>{T[i].name}</span>
                <span className="w-[160px]">{pub.summary!.shares ? Math.round(100 * pub.summary!.shares[i]) + "%" : `${pub.summary!.wins[i]} leg${pub.summary!.wins[i] === 1 ? "" : "s"}`}</span>
                {pub.summary!.award[i] > 0 && <span className="display text-36" style={{ color: "var(--color-ok)" }}>+{pub.summary!.award[i]}</span>}
              </li>))}
          </ol>
          {pub.summary.line && <div className="text-22" style={{ color: "var(--color-gold)" }}>{pub.summary.line}</div>}
        </>)}

        {pub.screen === "final" && pub.final && (<>
          <div className="confetti-late"><Confetti n={120} /></div>
          <div className="eyebrow text-22">{pub.final.order.filter((x) => x.place === 1).length > 1 ? "A shared win" : "The winner"}</div>
          <div className="display win-slam" style={{ fontSize: 110, color: T[pub.final.order[0].team].color }}>{pub.final.order.filter((x) => x.place === 1).map((x) => T[x.team].name).join(" & ")}</div>
          <ol className="card flex flex-col gap-1.5 text-left min-w-[560px]" style={{ position: "relative", zIndex: 60 }}>
            {pub.final.order.map(({ team, place }) => (
              <li key={team} className="flex items-center gap-4 text-24">
                <span className="w-10 display text-30" style={{ color: place === 1 ? "var(--color-gold)" : "var(--color-ink-2)" }}>{place}</span>
                <Badge pub={pub} t={team} /><span className="flex-1 truncate font-bold" style={{ color: T[team].color }}>{T[team].name}</span>
                <span className="display text-32">{T[team].score}</span>
              </li>))}
          </ol>
        </>)}
      </div>
      <div className="tv-foot">{pub.toast && <span key={pub.toast.id} className="tv-note enter">{pub.toast.text}</span>}</div>
    </div>);
}
