"use client";
/* The night's intro (the owner, 1 Nov): before the first round, the plan on the TV. The tracker's dots and
   dashes big across the top; the question rounds light up one by one with their themes, then the mini-games
   with their names and a line on each; then how to win and who starts the game. It explains itself without a
   host, and a host can talk over it. The phones show the same plan, small, and the Let's go button to the one
   who starts the night. Both modes (lib/intro.ts). */
import { introLine, introTimes, type IntroPub } from "@/lib/intro";
import { PLACE_PTS } from "@/lib/many/logic";
import { useAfter } from "./Clock";
import { useNoTv } from "./NoTv";

const ordinal = (n: number) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/* how the night is won, in a line */
export function introWin(I: IntroPub) {
  if (I.many) return `Each game ranks the teams: ${PLACE_PTS.slice(0, Math.min(I.teams, 4)).map((p, i) => `${ordinal(i + 1)} ${p}`).join(", ")}${I.teams > 4 ? "…" : ""} points. Most points at the end wins.`;
  return "Most points at the end wins the night. Level at the end? Sudden death.";
}
const qCaption = (I: IntroPub) => I.many ? "Two themes a round, four questions. Every team answers every one."
  : "One theme a round, a question for each team. Miss yours and the other team can steal it. 1 point a right answer.";

/* who: what the TV's last line says (the host, or the captain who starts) */
export function NightIntroTv({ intro: I, who }: { intro: IntroPub; who: string }) {
  const qs = I.items.filter((x) => x.kind === "q"), ms = I.items.filter((x) => x.kind === "mini");
  const { at, qHead, mHead, end } = introTimes(I.items);
  const d = (s: number) => ({ animationDelay: `${s.toFixed(2)}s` });
  const twoCols = qs.length > 0 && ms.length > 0, qWide = qs.length > 6;
  const tight = ms.length > 7;
  const pts = !I.many && I.miniPts ? `${I.miniPts} ${I.miniPts === 1 ? "point" : "points"} to each winner${ms.some((x) => x.game === "battle") && I.battlePts && I.battlePts !== I.miniPts ? ` (the Battle: ${I.battlePts})` : ""}` : "";
  return (
    <div className="night-intro" role="region" aria-label="Tonight's game">
      <div className="ni-top">
        <div className="eyebrow text-20 ni-in" style={d(0.1)}>Tonight</div>
        <div className="ni-pips" aria-hidden>
          {I.items.map((x, i) => <span key={x.key} className={"ni-pip" + (x.kind === "mini" ? " mini" : "") + (i === 0 ? " first" : "")}
            style={{ animationDelay: `${(at[x.key] ?? 0).toFixed(2)}s${i === 0 ? `, ${(end + 0.6).toFixed(2)}s` : ""}` }} />)}
        </div>
      </div>
      <div className={"ni-body" + (twoCols ? " two" : "")}>
        {qs.length > 0 && (
          <section className="ni-col" aria-label="Question rounds">
            <div className="ni-head ni-in" style={d(qHead)}><span className="ni-glyph" aria-hidden /><span>{plural(qs.length, "question round", "question rounds")}</span></div>
            <p className="ni-cap ni-in" style={d(qHead + 0.15)}>{qCaption(I)}</p>
            <ol className={"ni-list q" + (qWide ? " cols" : "")}>
              {qs.map((x, i) => (
                <li key={x.key} className="ni-row ni-in" style={d(at[x.key])}>
                  <span className="ni-n">{i + 1}</span>
                  <span className="ni-t">{x.themes?.length ? x.themes.join(" · ") : x.title}</span>
                </li>))}
            </ol>
          </section>)}
        {ms.length > 0 && (
          <section className="ni-col" aria-label="Mini-games">
            <div className="ni-head ni-in" style={d(mHead)}><span className="ni-glyph mini" aria-hidden /><span>{plural(ms.length, "mini-game", "mini-games")}</span>
              {pts && <span className="ni-pts">{pts}</span>}</div>
            {qs.length > 0 && <p className="ni-cap ni-in" style={d(mHead + 0.15)}>In between the rounds, in the order on the bar above.</p>}
            <ol className={"ni-list m" + (tight ? " tight" : "")}>
              {ms.map((x) => (
                <li key={x.key} className="ni-row ni-in" style={d(at[x.key])}>
                  <span className="ni-t">{x.title}</span>
                  <span className="ni-l">{introLine(x.game, I.many)}</span>
                </li>))}
            </ol>
          </section>)}
      </div>
      <div className="ni-foot ni-in" style={d(end)}>
        <div className="ni-win">{introWin(I)}</div>
        <div className="ni-sub">Captains answer for their team on their phones.</div>
        <div className="ni-go">{who}</div>
      </div>
    </div>);
}

/* the phones: the plan, small, and (for the one who starts the night) Let's go */
/* goAt: the button only from then (no host: the other captain, if the one who starts hasn't after a while) */
export function NightIntroPhone({ intro: I, go, goAt, busy, who }: { intro: IntroPub; go?: () => void; goAt?: number; busy?: boolean; who: string }) {
  const late = useAfter(goAt ?? null);
  const noTv = useNoTv();
  if (goAt != null && !late) go = undefined;
  const qs = I.items.filter((x) => x.kind === "q").length, ms = I.items.length - qs;
  return (
    <section className="flex flex-col gap-3 enter flex-1">
      <div className="card text-center">
        <div className="eyebrow">Tonight</div>
        <h1 className="display text-32 mt-1" style={{ color: "var(--color-gold)" }}>{noTv ? "Here\u2019s the plan" : "Eyes on the TV"}</h1>
        <p className="text-14 text-[var(--color-ink-2)] mt-1">{[qs ? plural(qs, "question round", "question rounds") : "", ms ? plural(ms, "mini-game", "mini-games") : ""].filter(Boolean).join(" and ")}.{noTv ? "" : " The plan is on the TV."}</p>
      </div>
      <ol className="card ni-phone" aria-label="Tonight's game, in order">
        {I.items.map((x) => (
          <li key={x.key}>
            <span className={"ni-glyph" + (x.kind === "mini" ? " mini" : "")} aria-hidden />
            <span className="min-w-0"><span className="font-bold">{x.title}</span>
              {x.themes?.length ? <span className="block text-13 text-[var(--color-ink-2)]">{x.themes.join(" · ")}</span> : null}</span>
          </li>))}
      </ol>
      <p className="text-13 text-center text-[var(--color-ink-2)]">{introWin(I)}</p>
      {go ? <button className="btn btn-gold btn-lg btn-block mt-auto dock" disabled={busy} onClick={go}>Let&rsquo;s go</button>
        : <p className="text-14 text-center text-[var(--color-ink-3)] mt-auto">{who}</p>}
    </section>);
}
