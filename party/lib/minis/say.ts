/* Don't Say the Same as Me: one copy for every setup (24 Nov, the owner's answers 1 to 21). Its words; the screens are
   in components/SayGame.tsx. Apart on purpose: with 3 to 8 teams the same answer as another team scores nothing too,
   and how a question pays (2 teams: +1, best of 6 takes the game, a tie-breaker; 3 to 8: everyone who dodges it shares
   1st), in each setup's own lines. "Question", never "prompt"; "the game's secret answer", never "the app's word". */
import { T_SAY } from "../game";

export const SAY = {
  title: "Don't Say the Same as Me",
  unit: "question",
  /* six questions in every setup (How to Play's "Best of 6.") */
  legs: 6,
  secret: "The game's secret answer",
  setupLine: (secs?: number) => `Six questions, ${secs ?? T_SAY} seconds each: a real answer, but not the game's secret one.`,
  rule1: (secs?: number) => `A question with many right answers, like "Name a colour". Captains have ${secs ?? T_SAY} seconds to type a valid one.`,
  /* 2 teams' rules 2 and 3 (the owner's words, 24 Nov) */
  rules2: (n: number, pts: string) => ["Dodge the game's secret answer: +1. No points for the game's secret answer, or one not on the list.", `Best of ${n} takes ${pts}. Tied? One more question, or a point each.`],
  /* 3 to 8 teams' rule 2: the same, with the other teams' answers, and the points every dodge gets */
  ruleMany: (k: number) => `Dodge the game's secret answer: +${k}. No points for the game's secret answer, the same answer as another team, or one not on the list.`,
  /* under the question on the TV, and under the captain's answer box */
  line: (many: boolean) => `One valid answer each. No points for the game's secret answer${many ? ", or the same answer as another team" : ""}.`,
  boxLine: (many: boolean) => `One valid answer. No points for the game's secret answer${many ? ", or the same answer as another team" : ""}.`,
  topCaptain: "Type an answer the game won't think of",
  topPlayer: "Don't Say the Same as Me: help your captain",
  change: "Change question",
  /* the host's answer card */
  hostEyebrow: "The game's secret answer: it scores nothing. Only you see this",
  hostNote: (many: boolean) => `Any other answer on the list scores${many ? ", if no other team says it too" : ""}.`,
  /* each team's call at the reveal: why an answer scores nothing ("Doesn't score": the host changed it, 24 Nov) */
  why: { said: "Said it", off: "Off the list", same: "Same word" } as Record<string, string>,
  dodged: "Dodged it",
  noScore: "Doesn't score",
};
