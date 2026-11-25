/* Fool Me Twice: one copy of its words for every setup (25 Nov, the owner's answers 1 to 23). Apart on purpose:
   with 3 to 8 teams each captain also names the team that will fall for its lie (the -1, the +1 more, the Gotcha,
   Lock in), and how a game pays (2 teams: most points takes the game, a tie-breaker; 3 to 8: places), in each
   setup's own rules 3 to 5. "Fact", and no levels said: they're the game's own (internal) */
export const FOOL = {
  title: "Fool Me Twice",
  unit: "fact",
  setupLine: "Six strange true facts with a blank: write a lie that sounds true, then find the truth among the lies.",
  rule1: (secs: number) => `A strange true fact goes up, with a blank. Each captain writes a lie to fill it, one that sounds true: ${secs} seconds.`,
  rule2: "Type the real answer and the game says so: write a lie instead!",
  rule3: (secs: number, many: boolean) => `Then the truth comes up hidden among your lies and a few of ours. Captains pick the one they think is true${many ? ", and say which team will fall for their lie" : ""}: ${secs} seconds.`,
  /* the TV's answers to a captain's tap (every setup: the 3-to-8 words) */
  noLie: "Type a lie first.",
  lieIn: "Your lie is in.",
  pickIn: "Your pick is in.",
  truth: "That's the truth, write a lie!",
  ownLie: "That's your own lie: pick another one.",
  pickOne: "Pick one of the answers.",
  lateUp: "Too late: the answers are up.",
  lateLast: "Too late: that was for the last fact.",
  captainOnly: "Your captain answers this one.",
  /* a captain's phone once its lie is in */
  lieSent: (lie: string | null | undefined) => (lie ? `Lie sent: ${lie}. Waiting for the others.` : "Lie sent. Waiting for the others."),
  /* a player's box while the captain writes (none while picking) */
  suggest: (cap: string) => `Suggest a lie to ${cap}`,
  suggestHint: "A lie that sounds true",
  change: "Change fact",
  /* the lie box: its label, its hint, and what it says at the longest a lie can be (never the number) */
  lieLabel: "Your lie",
  /* a team's pill at a fact's reveal: what the fact gave it */
  pill: (v: number) => ({ text: `Your team: ${v > 0 ? `+${v}` : v < 0 ? `\u2212${-v}` : "0"}`, tone: (v > 0 ? "ok" : v < 0 ? "no" : "mid") as "ok" | "no" | "mid" }),
  limit: "Limit reached.",
  /* who's in, on the TV and every phone */
  writing: "writing a lie…", lieInShort: "lie in", picking: "picking…", picked: "picked",
};
