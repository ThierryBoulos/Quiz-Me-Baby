/* FOOL ME TWICE (the owner, 16 Nov): a strange true fact with a blank. Every team writes a lie to fill it; then the
   lies, a few of ours and the truth come up together, shuffled, and every team picks the one it thinks is true.
   +2 for the truth, +1 for each team your lie fools, nothing for falling for one of ours; and with your lie you say
   which team will fall for it: if it does, that team loses 1 (with two teams it's always the other team). 6 facts,
   the last 2 hard. The rules themselves are the engine's (engine/core.js: foolOptions, foolScore), shared by the
   two-team TV (lib/tvGame.ts) and the 3-8 team one (lib/many/logic.ts). */
export type FoolOpt = { text: string; truth?: boolean; ours?: boolean; by: number[] };
export type FoolRev = { opts: FoolOpt[]; fooled: number[][]; pts: number[]; hits: { by: number; on: number }[]; lost: number[];
  predicts: (number | null)[]; answer: string; notes?: string };
export type FoolPub = {
  fact: string; n: number; of: number;     // the fact, which one, of how many
  hard?: boolean;                          // one of the night's last two (ours: shown only as "Hard one")
  name?: boolean;                          // the truth is a name or a title: it keeps its capital in the sentence
  wrote: boolean[];                        // who has written their lie
  opts?: string[];                         // picking: the answers, shuffled (whose they are stays on the TV)
  picked?: boolean[];                      // who has picked
  rev?: FoolRev;                           // the reveal
  total: number[];                         // this game's points so far (at the reveal, with this fact's)
};
/* a lie's longest (16 Nov, the owner: so every answer fits in its box, two lines at most on the narrowest phone; our own
   answers are 25 at most too). The phone says "Limit reached." when it's reached, never the number */
export const FOOL_MAX = 25;
