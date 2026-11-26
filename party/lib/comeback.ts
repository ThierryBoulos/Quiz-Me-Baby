/* THE COMEBACK (the owner, 17 Nov): once a night, at its middle, when it's a massacre. The teams too far behind to
   catch up get one chance: three easy questions, 15 seconds each, all three right or nothing. A team that makes it
   moves up to 85% of the leader's score at most, and never closer than a game's worth of points (4 at least) to a team
   that wasn't playing for it; a team that made it can pass one that missed (26 Nov, the owner; till then one point
   behind the team above it).
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

/* the headlines, the same on the TV and every phone, every setup (25 Nov, the owner). At a reveal: who is still in it
   after this question (ok: the teams in it that got it right; last: it was the third), all three right or nothing */
type Named = { name: string; color: string };
export const cbRevealHead = (ok: number[], last: boolean, T: Named[]): { text: string; color: string } => {
  if (!ok.length) return { text: "No comeback", color: "var(--color-ink-2)" };
  const who = ok.length === 1 ? T[ok[0]].name : `${ok.length} teams`;
  return { text: last ? `${who} make the comeback!` : `${who} still in it`, color: ok.length === 1 ? T[ok[0]].color : "var(--color-gold)" };
};
/* ...and at the result: who is back in it (made it, and moved up) */
export const cbResultHead = (c: ComebackPub, T: Named[]): { text: string; color: string } => {
  const up = c.teams.filter((t) => c.made?.[t] && (c.after?.[t] ?? 0) > c.before[t]);
  if (!up.length) return { text: "No comeback", color: "var(--color-ink-2)" };
  return { text: `${up.length === 1 ? T[up[0]].name : `${up.length} teams`} are back in it`, color: up.length === 1 ? T[up[0]].color : "var(--color-gold)" };
};
/* a team's own line on its phones at a reveal (x: it sent an answer) */
export const cbYouPill = (ok: boolean, x: boolean, last: boolean, of: number): { text: string; tone: "ok" | "no" } =>
  ok ? { text: last ? `Your team: all ${of} right!` : "Your team: right · still in it", tone: "ok" } : { text: `Your team: ${x ? "wrong" : "no answer"} · no comeback`, tone: "no" };
/* the phones' top lines */
export const CB_TOP_CAP = "Your question. Type your answer.", CB_TOP_PLAYER = "Your captain is answering.", CB_OUT = "Your team is out of the comeback.";
export const cbTopWatch = (names: string) => `${names} are playing for a comeback.`;
/* refusals */
export const CB_NOT_YOURS = "Only the teams playing for the comeback answer this one.", CB_IN = "Your answer is in.";
/* the result's headline comes once the last team's row is in */
export const cbResultDone = (c: ComebackPub) => 0.6 + c.teams.length * 0.5;
/* a team's own line on its phones at the result */
export const cbSumPill = (c: ComebackPub, t: number): { text: string; tone: "ok" | "no" } =>
  c.made?.[t] ? { text: `Your team: all ${c.of} right · ${c.before[t]} → ${c.after?.[t] ?? c.before[t]}`, tone: "ok" } : { text: "Your team: no comeback", tone: "no" };
