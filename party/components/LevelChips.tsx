"use client";
/* ONE PIECE FOR EVERY SETUP (the owner, 15 Nov: a change lands in every setup at once). A game's levels (or kinds of
   picture) as one row of chips: tap to add or drop one, the last one can't be dropped. The 2-team Setup (with a host
   and with no host) and the 3-8 team Setup both use it, with a TV and with none. Compact for the mini-games; Guess the
   Flag's and the question rounds' rows are full height (big): they need the room. */

/* Expert stands out as the hard one (the owner, 15 Nov): a red-ish chip with a small warning mark */
export const ExpertMark = () => (
  <svg className="xp-mark" width="13" height="12" viewBox="0 0 13 12" aria-hidden><path d="M6.5 0.8 L12.4 11.2 H0.6 Z" fill="currentColor" /><path d="M6.5 4.3 V7.4" stroke="#1a0606" strokeWidth="1.6" strokeLinecap="round" /><circle cx="6.5" cy="9.3" r="0.9" fill="#1a0606" /></svg>);
/* (the mark beside the word where there's room; on a narrow chip it sits above the word, never off its edge: 15 Nov) */
export const chipLabel = (key: string, label: string) => key === "expert" ? <span className="xp-label"><ExpertMark /><span>{label}</span></span> : label;
/* Guess the Flag with Expert on (the owner's words, 15 Nov) */
export const FlagExpertNote = ({ on }: { on: boolean }) => on ? <p className="xp-note text-12 px-1" role="note">Warning, only real buffs get those!</p> : null;

/* What Do You See?: the kinds of picture, under the game with its levels (a kind can be left out: the owner, 15 Nov;
   "Celebrities", not "Faces") */
export const SEE_KIND_OPTS = [["face", "Celebrities"], ["logo", "Logos"], ["close", "Close-ups"]] as const;

export function LevelChips({ label, opts, value, set, big }: { label: string; opts: readonly (readonly [string, string])[]; value: string[]; set: (v: string[]) => void; big?: boolean }) {
  return (
    <div className={"lvl-row" + (big ? "" : " compact")} role="group" aria-label={label}>
      {opts.map(([k, l]) => { const on = value.includes(k); return (
        <button key={k} type="button" className={"chip " + (on ? "chip-on" : "") + (k === "expert" ? " lvl-expert" : "")} aria-pressed={on}
          onClick={() => { const next = on ? value.filter((x) => x !== k) : [...value, k]; if (next.length) set(opts.map(([x]) => x).filter((x) => next.includes(x))); }}>{chipLabel(k, l)}</button>); })}
    </div>);
}
