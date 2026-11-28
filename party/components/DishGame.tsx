"use client";
/* Guess the Cocktail or Dish's TV, one copy for every setup (24 Nov, the owner's answers): the ingredients as they come,
   "Which dish?", how many so far, the clock, and under it each setup's own line (2 teams: who buzzed or is out, and the
   buzzer's clock to type; 3 to 8: who has answered); at the reveal the 3-to-8 design, the ingredients on one line, the
   answer on its tile, each team's call with its points, who takes it. dense: five teams or more. */
import { answerLast } from "./TeamCalls";
import type { CSSProperties, ReactNode } from "react";

const QUICK = { ["--beat" as string]: ".15s" } as CSSProperties;
type DishPub = { kind: string; ings: string[]; n: number };
/* "60 ml — gin": the amount and the ingredient */
export const splitIng = (t: string) => { const i = t.indexOf(" — "); return i < 0 ? ["", t] : [t.slice(0, i), t.slice(i + 3)]; };

export function DishTv({ dish, clock, under }: { dish: DishPub; clock?: ReactNode; under?: ReactNode }) {
  return (
    <div className="flex gap-12 items-center w-full justify-center">
      <ol className="text-left grid gap-2 flex-1 min-w-0 max-w-[620px]" style={{ fontSize: dish.n > 8 ? 22 : 28 }}>
        {dish.ings.map((t, i) => { const [qty, name] = splitIng(t); return (
          <li key={i} className="enter flex gap-4 items-baseline"><span className="font-bold">{name}</span>{qty && <span className="text-[var(--color-ink-2)]" style={{ fontSize: "0.8em" }}>{qty}</span>}</li>); })}
      </ol>
      <div className="w-[380px] shrink-0 flex flex-col items-center gap-4">
        <div className="display text-44" style={{ color: "var(--color-gold)" }}>Which {dish.kind.toLowerCase()}?</div>
        <div className="text-22 text-[var(--color-ink-2)]"><b>{dish.ings.length}</b> of {dish.n} ingredients</div>
        {clock}
        {under}
      </div>
    </div>);
}

/* (28 Nov, the owner's yes to the ideas from Fibbage, motion only: each team's answer first, then the dish slams down,
   then the stamps and who takes it: components/TeamCalls answerLast; k: how many teams) */
export function DishRevealTv({ dish, answer, dense, rows, head, headStyle, k = 2 }: {
  dish?: DishPub; answer: string; dense?: boolean; rows?: ReactNode; head?: { text: string; color: string }; headStyle?: CSSProperties; k?: number;
}) {
  const n = answer.length, at = answerLast(k);
  return (<>
    {dish && <div className="text-20 text-[var(--color-ink-2)] max-w-[1100px] leading-snug clamp2">{dish.ings.map((t) => splitIng(t)[1]).join(", ")}</div>}
    <div className="ans-board display beat slam leading-none max-w-[1160px]" style={{ ["--beat" as string]: 0.15 + at.board + "s", fontSize: n > 34 ? (dense ? 40 : 44) : n > 24 ? (dense ? 44 : 56) : dense ? 64 : 80, color: "var(--color-gold)" }}>{answer}</div>
    {rows}
    {head && <div className="display text-44 beat" style={{ ...QUICK, ...headStyle, ["--d" as string]: at.head + "s", color: head.color }}>{head.text}</div>}
  </>);
}
