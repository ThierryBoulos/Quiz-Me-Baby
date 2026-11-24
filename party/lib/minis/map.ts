/* Guess the Map: one copy for every setup (24 Nov, the owner's answers 1 to 19). Its words; the screens are in
   components/MapGame.tsx. Apart on purpose: how a map scores (2 teams: +1, best of 3 takes the game, a tie-breaker
   map; 3 to 8: places, the fastest right first), in each setup's own rule lines. */
import { T_MAP } from "../game";

export const MAP = {
  title: "Guess the Map",
  unit: "map",
  /* three maps in every setup (How to Play's "Best of 3.") */
  legs: 3,
  setupLine: (secs?: number) => `Three maps, ${secs ?? T_MAP} seconds each: what does it show?`,
  rule1: (secs?: number) => `A map with no title goes up. Captains have ${secs ?? T_MAP} seconds to type what it shows: the idea counts, not the exact words.`,
  /* 2 teams' rules 2 and 3 (short, the same with or without a host, as Flag's) */
  rules2: (n: number, pts: string) => ["Guess it right: +1. Both right? A point each. Nobody? Nobody.", `Best of ${n} takes ${pts}. Tied? One more map, or a point each.`],
  /* the question, on the TV and on the captains' phones ("what does this map show?", not "what do they have in
     common?": many maps are colour scales, 24 Nov) */
  ask: "What does this map show?",
  topCaptain: "What does this map show?",
  topPlayer: "Guess the Map: help your captain",
  change: "Change map",
  /* the fact under the title at every reveal, TV and phones, as with Flag (24 Nov, the owner): the map's sourced note,
     without its "Source: …" (the host's card keeps the answer sentence: "Which side of the road they drive on…") */
  fact: (notes?: string | null) => (notes ? notes.replace(/\s*Sources?:[\s\S]*$/, "").trim() || undefined : undefined),
};
