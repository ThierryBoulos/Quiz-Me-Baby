/* Majority Rules: one copy of its words for every setup (25 Nov, the owner's answers 1 to 18). Apart on purpose: how it
   scores (2 teams: the higher share takes the game, a tie-breaker; 3 to 8: places by share), in each setup's own line. */
import { T_MAJORITY } from "../game";

type Who = [string, { r: number; of: number; team: number }][];
const andList = (L: string[]) => (L.length > 1 ? `${L.slice(0, -1).join(", ")} & ${L[L.length - 1]}` : L.join(""));
/* players who share a count: up to three by name, more than that counted */
const names = (L: string[]) => (L.length > 3 ? `${L.length} players` : andList(L));
const spread = (who: Record<string, { r: number; of: number; team: number }>) => {
  const all: Who = Object.entries(who).filter(([, w]) => w.of > 0);
  return { all, hi: Math.max(0, ...all.map(([, w]) => w.r)), lo: Math.min(...all.map(([, w]) => w.r)), of: Math.max(0, ...all.map(([, w]) => w.of)) };
};

export const MAJ = {
  title: "Majority Rules",
  unit: "question",
  setupLine: (secs?: number) => `Ten questions, ${secs ?? T_MAJORITY} seconds each: everyone answers on their own phone.`,
  /* the intro's first three rules, the same in every setup (the first in red: 25 Nov, the owner's words) */
  rules: (n: number, secs?: number) => [
    { text: "Everyone plays on their own phone, captains too.", warn: true },
    { text: `${n} questions, four answers, ${secs ?? T_MAJORITY} seconds each. One tap and it's locked.` },
    { text: "Eyes on your own phone: this game is played solo" }],
  /* 2 teams' 4th rule: how it scores there, and the tie */
  ruleTwo: (pts: string) => `Each team scores the share of its answers that are right, so a smaller team isn't at a disadvantage. The higher share takes ${pts}. Tied? One more question, or a point each.`,
  /* 3 to 8 teams' 4th rule, then the night's points */
  ruleMany: "Teams are ranked by the share of their answers that are right.",
  /* one player's own line at a reveal (every setup: 25 Nov) */
  mine: (said: string | null | undefined, right: boolean) => !said ? "You didn't answer this one (it counts as wrong)." : right ? `You said ${said}: right!` : `You said ${said}: wrong.`,
  /* a team on the TV and the host's phone while a question is up: how many of its list have answered */
  count: (n: number, of: number) => `${n} of ${of}`,
  /* the TV turning a late joiner's tap away (every setup: 25 Nov), and their phone meanwhile */
  late: "You joined after this game started: watch this one.",
  /* the game's result line: the players with the most and the fewest right (every setup, the 3-to-8 words: 25 Nov) */
  whoLine: (who: Record<string, { r: number; of: number; team: number }>) => {
    const { all, hi, lo, of } = spread(who); if (all.length < 2) return "";
    const at = (v: number) => names(all.filter(([, w]) => w.r === v).map(([k]) => k));
    return hi === lo ? `Everyone got ${hi} of ${of}.` : `Most right: ${at(hi)}, ${hi} of ${of}. Least right: ${at(lo)}, ${lo} of ${of}.`;
  },
  /* the end of the night's two cards: the sharpest, and the least right said plainly, no jab (the owner, 31 Oct; every
     setup, 25 Nov). None when everyone got the same */
  awards: (who: Record<string, { r: number; of: number; team: number }>) => {
    const { all, hi, lo, of } = spread(who); if (all.length < 2 || hi <= lo) return null;
    const at = (v: number) => all.filter(([, w]) => w.r === v), one = (L: Who) => (L.length === 1 ? L[0][1].team : null);
    const top = at(hi), low = at(lo);
    return { sharp: { t: "Sharpest in Majority Rules", who: `${names(top.map(([k]) => k))}, ${hi} of ${of}`, team: one(top) },
      spoon: { t: "Least right, Majority Rules", who: `${names(low.map(([k]) => k))}, ${lo} of ${of}`, team: one(low), spoon: true as const } };
  },
  watching: "You joined after it started, so you\u2019re watching this one. You\u2019ll play the next Majority Rules.",
  /* someone taken off who's back on the game screen is put back: the TV says so */
  backOn: (L: string[]) => `${andList(L)} ${L.length > 1 ? "are" : "is"} back on the list.`,
  /* who plays, before Start: the TV's list, and a phone's */
  listHead: "Who plays",
  hostHead: "Who plays: take off anyone who has left",
  start: "Start: everyone\u2019s in",
  nobody: "nobody yet",
  key: "Grey: not on the game screen. Crossed out: taken off.",
  notOn: "You\u2019re not on a list yet.",
  phoneKey: "\u25cf on the game screen \u00b7 \u25cb not here. Everyone listed plays: no answer counts as wrong.",
};
