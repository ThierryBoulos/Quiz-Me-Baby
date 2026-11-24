/* Guess the Flag: one copy for every setup (24 Nov, the merge). Everything about the game that both setups show:
   its words, its rules, its lines on the phones. The screens are in components/Flag.tsx. What stays apart is on
   purpose and named here: how a flag scores (2 teams: +1, the best of 10 takes the game; 3 to 8: places, the fastest
   right first), which each setup's rules say in their own lines. */
import { T_FLAG } from "../game";

export const FLAG = {
  title: "Guess the Flag",
  /* one flag: "Flag 3 of 10", "the flag" */
  unit: "flag",
  /* the setup screen's line, and the intro's first rule (23 Nov, the owner's words); the seconds as Settings has them */
  setupLine: (secs?: number) => `Ten flags, ${secs ?? T_FLAG} seconds each: whose is it?`,
  rule1: (secs?: number) => `A flag goes up and captains have ${secs ?? T_FLAG} seconds to type whose flag it is.`,
  /* 2 teams' rules 2 and 3: how it scores there (short, the same with or without a host: 23 Nov, the owner) */
  rules2: (n: number, pts: string) => ["Guess it right: +1. Both right? A point each. Nobody? Nobody.", `Best of ${n} takes ${pts}. Tied? One more flag, or a point each.`],
  /* the phones' top line while a flag is up ("flag", not "country": not every flag is a country, 23 Nov) */
  topCaptain: "Which flag?",
  topPlayer: "Guess the Flag: help your captain",
  /* the host's button; its words on the TV are the engine's (QMB.SWAP_WORDS.flag) */
  change: "Change flag",
  /* a 2-team phone's pill when its team takes the flag */
  taken: "Your team takes the flag",
};
