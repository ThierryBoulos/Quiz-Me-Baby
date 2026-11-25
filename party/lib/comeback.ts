/* THE COMEBACK (the owner, 17 Nov): once a night, at its middle, when it's a massacre. The teams too far behind to
   catch up get one chance: three easy questions, 15 seconds each, all three right or nothing. A team that makes it
   moves up to 85% of the leader's score, but never past another team (one point behind the team above it, at most).
   On by default; a switch in the Setup. The rules themselves are the engine's (engine/core.js: comebackPlan,
   comebackSettle, the dealer's comebackDeck), shared by the two-team TV (lib/tvGame.ts) and the 3-8 team one
   (lib/many/logic.ts). This is what the screens are sent, the same in both. */
export type ComebackPub = {
  teams: number[];              // the teams playing for it, the highest first
  target: (number | null)[];    // per team: the most it can reach, if it makes it (null: not in it)
  before: number[];             // every team's score as it began
  i: number; of: number;        // the question on (0-based), of 3
  out: boolean[];               // per team: missed one, so it's over for it
  made?: boolean[];             // the result: per team, all three right
  after?: number[];             // the result: every team's score after it
};
export const COMEBACK_TITLE = "The Comeback";
/* names in a line: "Team B", "Team B and Team E", "Team B, Team E and Team F" */
export const listNames = (xs: string[]) => (xs.length > 2 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs.join(" and "));
/* the same for a screen reader, or a line of plain text */
/* the announcement, the owner's words (17 Nov), one copy for every setup: its two sentences, the teams named between
   them (the screen colours each name), and what it takes */
export const CB_SAYS1 = "Okay, we can now call this a massacre… Someone in this room actually went to school.";
export const CB_SAYS2 = ["We\u2019re all for equity.", "get a chance for a comeback… Miss it and, well, you deserve that last place."] as const;
export const comebackSays = (names: string[]) => `${CB_SAYS1} ${CB_SAYS2[0]} ${listNames(names)} ${CB_SAYS2[1]}`;
export const cbTakes = (n: number, secs: number) => `${n} easy questions · ${secs} seconds each · All ${n} right, or nothing`;
