/* Everything the TV holds about the night, beside the engine's own game object (g):
   the screen and its clocks, what each captain sent, pending calls, pop-ups. The
   TV saves most of it on this laptop (see SAVED) so a reload carries on. */
import type { Bank, Q } from "../engine";
import type { MiniKey, Pub, Two } from "../game";
import type { G, PKind } from "./rules";

export const newState = () => ({
  ack: {} as Record<string, { tap: string; no?: string }>,   // per phone: the last tap dealt with (see Pub.ack)
  g: null as G, nohost: false, screen: "", step: 0, deadline: null as number | null, left: 0, timeUp: false, total: 0,
  lifeline: null as Pub["lifeline"], toast: null as Pub["toast"], toastN: 0, bank: null as Bank | null,
  decided: null as null | { key: MiniKey; winner: 0 | 1; spare: number },   // the "decided" screen: which mini-game
  appeal: null as null | { team: 0 | 1; text: string },                      // no host: an appeal waiting for the other captain
  offList: [false, false] as Two<boolean>,                                   // Say the Same: not a real answer to the prompt
  qkeys: {} as Record<string, number>,                                        // real question id → the number the phones see
  scoreLog: [] as Two<number>[],                                              // the score after every change (lead changes, for the recap)
  typed: [null, null] as Two<string[] | null>,       // what each captain sent for the question on screen
  guesses: [null, null] as Two<number | null>,       // Closest To Wins
  ok: [null, null] as Two<boolean | null>,           // Flag / Map / Say verdicts, as they stand
  app: [null, null] as Two<boolean | null>,          // ...and what the app said first (the "App suggests" tag)
  sdBuzz: null as 0 | 1 | null, sdOut: [false, false] as Two<boolean>,
  pending: null as null | { kind: PKind; team: 0 | 1; text: string; v: boolean; until: number },
  autoAt: null as number | null,                     // no host: when an unruled map answer stands as right
  paused: false,                                     // the clock stopped by a Pause (the question hides meanwhile)
  bids: { leg: -1, by: [null, null] as Two<number | null> },   // the Auction: each captain's latest bid this leg
  waitSince: 0,                                      // no host: when this screen started waiting for a Start or Next
  flags: [] as NonNullable<Pub["flags"]>, flagN: 0,  // phones that left the game screen during a question
  tvAway: 0, awayPaused: false,                      // when the TV's screen went to sleep (0: it's on), and whether that paused the clock
  imad: null as Pub["imad"] | null, imadN: 0, imadQ: [] as string[],   // Imad's latest line, and the ones waiting to go up together
  custom: [] as Q[],                                 // questions of their own, sent by the phone that started
  buzzAt: 0, late: null as 0 | 1 | null,             // Guess the Cocktail or Dish: when the buzz came (10 s to type), and who ran out
  lastAns: null as null | { answer: string; got: boolean | null },   // the Battle: the last question's answer, shown once it's settled
  exit: false,                                       // the night is over and Exit was tapped: every screen goes home
});
export type TvState = ReturnType<typeof newState>;
