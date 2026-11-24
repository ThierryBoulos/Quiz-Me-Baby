/* Guess the Airport: one copy for every setup (24 Nov, the merge). Its words; the answer's flaps, code and city are in
   components/Airport.tsx. Apart on purpose: how a board scores (2 teams: +1, best of 5 takes the game; 3 to 8:
   places, the fastest right first), in each setup's own rule lines. The city always counts (24 Nov, the owner). */
import { T_AIRPORT } from "../game";

export const AIRPORT = {
  title: "Guess the Airport",
  unit: "board",
  setupLine: (secs?: number) => `Five departure boards, ${secs ?? T_AIRPORT} seconds, which airport is it?`,
  rule1: (secs?: number) => `A departures board goes up. Captains have ${secs ?? T_AIRPORT} seconds to type which airport it is.`,
  /* 2 teams' rules 2 and 3 */
  rules2: (n: number, pts: string) => ["Guess it right: +1. Both right? A point each. Nobody? Nobody.", `Best of ${n} takes ${pts}. Tied? One more board, or a point each.`],
  topCaptain: "Which airport?",
  topPlayer: "Guess the Airport: help your captain",
  change: "Change board",
  ask: "Which airport?",
};
