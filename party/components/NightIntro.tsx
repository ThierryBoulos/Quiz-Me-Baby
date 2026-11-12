"use client";
/* The night's intro (the owner, 1 Nov): before the first round, the plan on the TV. The tracker's dots and
   dashes big across the top; the question rounds light up one by one with their themes, then the mini-games
   with their names and a line on each; then how to win and who starts the game. It explains itself without a
   host, and a host can talk over it. The phones show the same plan, small, and the Let's go button to the one
   who starts the night. Both modes (lib/intro.ts). */
import { introLine, type IntroItem, type IntroPub } from "@/lib/intro";
import { PLACE_PTS } from "@/lib/many/logic";
import { useAfter } from "./Clock";
import { useNoTv } from "./NoTv";

const ordinal = (n: number) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/* how the night is won, in a line */
export function introWin(I: IntroPub) {
  if (I.many) return `Each game ranks the teams: ${PLACE_PTS.slice(0, Math.min(I.teams, 4)).map((p, i) => `${ordinal(i + 1)} ${p}`).join(", ")}${I.teams > 4 ? "…" : ""} points to the night. Score nothing in a game, add nothing. Most points at the end wins.`;
  return "Most points at the end wins the night. Tied at the end? Sudden death.";
}
/* (3-8 teams: a round is one theme, as with two teams; they play two at a time: 11 Nov, the owner) */
const roundCount = (I: IntroPub) => I.items.filter((x) => x.kind === "q").reduce((a, x) => a + (I.many ? x.rounds?.length || 1 : 1), 0);

/* THE NIGHT LINE (11 Nov, the owner picked option B, reworked): the night as a line of stops, in the order it's played,
   wrapping onto new rows on a long night (up to 7 a row, 8 past 21, shared out evenly; an arrow at a row's end shows it
   carries on). Gold stops are rounds (3-8 teams: two rounds, played together), blue ones mini-games with a line on what
   each is (gone on four-row nights, so nothing gets too small). The points are a small legend in the top corner. */
const IC: Record<string, string> = {
  flag: "M5 21V4h11l-2 4 2 4H5", closest: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9",
  auction: "M13 4l7 7-3 3-7-7zM10 10l-7 7 2 2 7-7M4 21h9", saysame: "M4 5h16v11H10l-5 4v-4H4z", say: "M4 5h16v11H10l-5 4v-4H4z",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14", pin: "M12 21s7-6.3 7-11.5a7 7 0 1 0-14 0C5 14.7 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
  airport: "M10.5 3.5h2l3.5 7h4.5a1.5 1.5 0 0 1 0 3h-4.5l-3.5 7h-2l1.5-7H7.5l-2 2.5H4l1-4-1-4h1.5l2 2.5H12z", majority: "M5 20V11M12 20V4M19 20v-6",
  dish: "M5 4h14l-7 8zM12 12v7M8 20h8", roulette: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 6.2v1.6M16.3 9.5v.01M16.3 14.5v.01M12 16.2v1.6M7.7 14.5v.01M7.7 9.5v.01",
  battle: "M3 18h18L19 7l-4 4-3-6-3 6-4-4z",
  /* Secret Stakes: a stack of chips */
  /* What Do You See?: an eye */
  see: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  stakes: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 11v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4M4 15v2c0 1.7 3.6 3 8 3s8-1.3 8-3v-2" };
export const GameIcon = ({ k }: { k: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={IC[k] || ""} /></svg>);
const rLab = (x: IntroItem) => (x.rounds && x.rounds.length > 1 ? `R${x.rounds[0]}\u2013${x.rounds[x.rounds.length - 1]}` : `R${x.rounds?.[0] ?? x.title.replace(/\D/g, "")}`);
const summary = (I: IntroPub) => {
  const r = roundCount(I), m = I.items.filter((x) => x.kind === "mini").length;
  return [r ? plural(r, "round", "rounds") : "", m ? plural(m, "mini-game", "mini-games") : ""].filter(Boolean).join(" \u00b7 ");
};
function Legend({ I }: { I: IntroPub }) {
  if (I.many) return (
    <div className="nl-legend">
      <div className="li"><span className="sw r" /><b>Rounds</b><span>same question for every team</span></div>
      <div className="li"><span className="sw m" /><b>Mini-games</b><span>every team plays at once</span></div>
      <div className="places">Each one ranks the teams: {PLACE_PTS.slice(0, Math.min(I.teams, 3)).map((p, i) => <span key={i}><b>+{p}</b> {ordinal(i + 1)}{i < 2 ? " \u00b7 " : ""}</span>)}{I.teams > 3 && <>{" \u00b7 then "}<b>{PLACE_PTS.slice(3, Math.min(I.teams, 6)).map((p) => "+" + p).join(" ")}</b></>}</div>
    </div>);
  const m = I.miniPts ?? 2;
  return (
    <div className="nl-legend">
      <div className="li"><span className="sw r" /><b>Rounds</b><span><span className="pts r">+1</span>a right answer, or a steal</span></div>
      <div className="li"><span className="sw m" /><b>Mini-games</b><span><span className="pts m">+{m}</span>to the winner</span></div>
    </div>);
}
/* who: the TV's last line ("Nour starts the game") */
export function NightIntroTv({ intro: I, who }: { intro: IntroPub; who: string }) {
  const k = I.items.length, maxC = k <= 21 ? 7 : 8, rows = Math.max(1, Math.ceil(k / maxC)), cols = Math.max(1, Math.ceil(k / rows)), compact = rows >= 4;
  const d = (s: number) => ({ animationDelay: `${s.toFixed(2)}s` });
  const step = (100 / cols);
  return (
    <div className="night-intro nl" role="region" aria-label="Tonight's game">
      <div className="nl-head ni-in" style={d(0.1)}>
        <div><div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: 16 }}>Tonight{I.many ? ` \u00b7 ${I.teams} teams` : ""}</div>
          <div className="display nl-big">{summary(I)}</div></div>
        <Legend I={I} />
      </div>
      <ol className={"nl-body" + (compact ? " compact" : "")} aria-label="Tonight's game, in order">
        {Array.from({ length: rows }, (_, r) => {
          const its = I.items.slice(r * cols, (r + 1) * cols), more = r < rows - 1;
          const left = r === 0 ? step / 2 : 0, right = more ? 0 : (cols - its.length) * step + step / 2;
          return (
            <li key={r} className="nl-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              <span className={"nl-track" + (more ? " cont" : "")} style={{ left: `${left}%`, right: `${right}%` }} aria-hidden />
              {its.map((x, i) => (
                <div key={x.key} className="nl-stop ni-in" style={d(0.5 + (r * cols + i) * 0.16)}>
                  {x.kind === "q"
                    ? <><span className={"nl-dot r" + (x.rounds && x.rounds.length > 1 ? " two" : "")}>{rLab(x)}</span><span className="nl-nm">{(x.themes?.length ? x.themes : [x.title]).join(" + ")}</span></>
                    : <><span className="nl-dot m"><GameIcon k={x.game} /></span><span className="nl-nm">{x.title}</span>{!compact && <span className="nl-ds">{introLine(x.game, I.many)}</span>}</>}
                </div>))}
            </li>);
        })}
      </ol>
      <div className="nl-foot ni-in" style={d(0.6 + k * 0.16)}>
        <span>{I.many ? "Most points at the end wins." : "Most points wins. Tied at the end? Sudden death."} Captains answer on their phones.</span>
        <b>{who}</b>
      </div>
    </div>);
}

/* the phones: the plan, small, and (for the one who starts the night) Let's go */
/* goAt: the button only from then (no host: the other captain, if the one who starts hasn't after a while) */
export function NightIntroPhone({ intro: I, go, goAt, busy, who }: { intro: IntroPub; go?: () => void; goAt?: number; busy?: boolean; who: string }) {
  const late = useAfter(goAt ?? null);
  const noTv = useNoTv();
  if (goAt != null && !late) go = undefined;
  return (
    <section className="flex flex-col gap-3 enter flex-1">
      <div>
        <div className="eyebrow" style={{ color: "var(--color-gold)" }}>Tonight{I.many ? ` \u00b7 ${I.teams} teams` : ""}{noTv ? "" : " \u00b7 the plan is on the TV"}</div>
        <h1 className="display text-32 mt-1">{summary(I)}</h1>
      </div>
      <div className="nl-plg">
        {I.many ? <><span><i className="sw r" />Rounds</span><span><i className="sw m" />Mini-games</span><span>Each ranks the teams: <b>+{PLACE_PTS[0]} · +{PLACE_PTS[1]} · +{PLACE_PTS[2]}…</b></span></>
          : <><span><i className="sw r" />Rounds <b>+1</b></span><span><i className="sw m" />Mini-games <b>+{I.miniPts ?? 2}</b></span></>}
      </div>
      <ol className="nl-vline" aria-label="Tonight's game, in order">
        {I.items.map((x) => (
          <li key={x.key} className={x.kind === "q" ? "r" : "m"}>
            <span className="k">{x.kind === "q" ? rLab(x) : <GameIcon k={x.game} />}</span>
            <span className="n">{x.kind === "q" ? (x.themes?.length ? x.themes : [x.title]).join(" + ") : x.title}</span>
            {x.kind === "mini" && <span className="d">{introLine(x.game, I.many)}</span>}
          </li>))}
      </ol>
      <p className="text-13 text-center text-[var(--color-ink-2)]">{introWin(I)}</p>
      {go ? <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={go}>Let&rsquo;s go</button>
        : <p className="text-14 text-center text-[var(--color-ink-3)] mt-auto">{who}</p>}
    </section>);
}
