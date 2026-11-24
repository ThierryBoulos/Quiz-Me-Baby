/* Closest To Wins: one copy for every setup (24 Nov, the merge). Its words; the screens are in components/Closest.tsx.
   Apart on purpose: how a guess scores (2 teams: +1 to the closer, best of 5 takes the game; 3 to 8: places, the
   closest first), in each setup's own rule lines. */
import { T_CLOSEST } from "../game";

export const CLOSEST = {
  title: "Closest To Wins",
  setupLine: (secs?: number) => `Five number questions, ${secs ?? T_CLOSEST} seconds each: the closest guess wins.`,
  rule1: (secs?: number) => `A question with a number for an answer. Captains have ${secs ?? T_CLOSEST} seconds to type their best guess.`,
  /* 2 teams' rules 2 and 3 */
  rules2: (n: number, pts: string) => ["Closest guess: +1. Tied? A point each. Nobody? Nobody.", `Best of ${n} takes ${pts}. Tied? One more, or a point each.`],
  topCaptain: "Type a number. Nearest wins.",
  topPlayer: "Closest To Wins: help your captain",
};
