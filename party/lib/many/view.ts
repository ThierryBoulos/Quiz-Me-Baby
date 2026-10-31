/* MANY TEAMS: what the TV publishes (PubMany, for every phone) and what only the host's phone gets
   (the answer and every team's typed answer). Built from the night's state, never stored. */
import { MANY_COLORS, allIn, answered, dishRight, distances, fireOfMany, legPlaces, legPoints, legWinners, miniOf, mrCount, mrLine, qOf, ranking, recapMany, share, titleOf, typedKey, type AwardM, type LatLon, type ManyKey, type StateM } from "./logic";
import { dishKind } from "../tv/rules";

export type TeamPub = { name: string; captain: string; score: number; color: string };
export type PubMany = {
  many: true; at?: number; step: number; screen: StateM["screen"];
  teams: TeamPub[];
  /* this game: legs taken, its place points so far (this leg's counted from its reveal), Majority Rules' shares */
  game?: { key: ManyKey; title: string; leg: number; of: number; wins: number[]; pts: number[]; shares?: number[]; index: number; count: number;
    only?: number[];                              // sudden death: the teams level at the top, the only ones who answer
    themes?: string[] };                          // a question round: its themes, in the order they come
  qid?: string; question?: string; flag?: string; options?: string[];
  pin?: { photo: string; credit: string; licence: string };
  /* Guess the Airport: the board (its name and code only at the reveal); Guess the Map: the map; the Cocktail or
     Dish: the ingredients up so far, and the teams whose one guess was wrong (out of this one) */
  airport?: { title: string; board: string[][]; code?: string; city?: string };
  map?: { id: string; reveal: boolean; title?: string };
  dish?: { kind: string; ings: string[]; n: number };
  out?: boolean[];
  theme?: string;                                 // a question round: the question's theme
  deadline: number | null; left: number; sent: boolean[];
  roster?: string[];                              // Majority Rules: who plays
  voted?: string[];                               // ...and who has answered (names only, never what)
  reveal?: { answer: string; notes?: string; typed?: (string | null)[]; ok?: (boolean | null)[]; nums?: (number | null)[]; off?: (number | null)[];
    pins?: (LatLon | null)[]; at?: LatLon; place?: string; winners: number[]; counts?: number[]; right?: number[]; of?: number[];
    why?: (string | null)[];                      // Don't Say the Same: why an answer doesn't score ("said", "off", "same")
    places?: (number | null)[]; pts?: number[] };            // this leg's places and what they pay this game
  /* a game's result: its tally (or shares), its places, what each place pays the night */
  summary?: { wins: number[]; pts: number[]; shares?: number[]; places: number[]; award: number[]; line?: string; noAward?: boolean; plus?: boolean };
  final?: { order: { team: number; place: number }[]; log: number[][]; awards: AwardM[]; games: string[] };
  fire?: boolean[];                                // three legs in a row at 1st, this game
  toast: { id: number; text: string } | null; exit?: boolean; ack?: Record<string, Record<string, string>>;
};
export type SecretMany = { answer?: string; notes?: string; typed?: (string | null)[]; nums?: (number | null)[] };

export function buildMany(s: StateM): { pub: PubMany; secret: SecretMany } {
  const m = miniOf(s), q = qOf(s);
  const pub: PubMany = { many: true, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, sent: answered(s), toast: s.toast, exit: s.exit,
    teams: s.teams.map((t, i) => ({ name: t.name, captain: t.captain, score: t.score, color: MANY_COLORS[i] })) };
  const now = m && m.key !== "majority" && s.screen === "reveal" ? legPoints(s) : null;
  if (m) pub.game = { key: m.key, title: titleOf(s.minis, s.mi), leg: Math.min(m.i + 1, m.qs.length), of: m.qs.length, wins: [...m.wins],
    pts: m.pts.map((p, t) => p + (now ? now[t] : 0)), index: s.mi, count: s.minis.filter((x) => x.key !== "sudden").length, ...(m.only ? { only: m.only } : {}),
    ...(m.key === "quiz" ? { themes: [...new Set(m.qs.map((q) => String(q.theme || "")).filter(Boolean))] } : {}) };
  /* Majority Rules: each team's share so far, for the tracker's "this game" line; on the reveal this question
     counts too (it is only banked at Next), so the line agrees with "2 of 2 right" under it (the reviewers, 31 Oct) */
  if (m && m.key === "majority" && pub.game) { const c = s.screen === "reveal" ? mrCount(s) : null;
    pub.game.shares = s.teams.map((_, t) => { const r = m.right[t] + (c ? c.right[t] : 0), of = m.of[t] + (c ? c.of[t] : 0); return of ? r / of : 0; }); }
  if (m && q && (s.screen === "q" || s.screen === "reveal")) {
    pub.qid = String(q.id ?? m.key + m.i);
    const rev = s.screen === "reveal";
    if (m.key === "flag") pub.flag = q.flag;
    else if (m.key === "pin") pub.pin = { photo: q.photo, credit: q.credit, licence: q.licence };
    else if (m.key === "airport") pub.airport = { title: q.boardTitle, board: q.board, code: rev ? q.code : undefined, city: rev ? q.city : undefined };
    else if (m.key === "map") pub.map = { id: q.id, reveal: rev, title: rev ? q.question : undefined };
    else if (m.key === "dish") { pub.dish = { kind: dishKind(q), ings: (q.ings || []).slice(0, rev ? undefined : Math.max(1, s.shown)), n: (q.ings || []).length };
      pub.out = s.teams.map((_, t) => s.typed[t] != null && !dishRight(s, t)); }
    else pub.question = q.question;
    if (m.key === "quiz" && q.theme) pub.theme = q.theme;
    if (m.key === "majority") { pub.options = q.options; pub.roster = s.roster.map((r) => r.name); pub.voted = Object.keys(s.votes); }
  }
  if (m && q && s.screen === "reveal") {
    /* (sudden death pays the night one point, to the fastest right answer) */
    const w = legWinners(s), places = legPlaces(s), pl = { places, pts: m.key === "sudden" ? places.map((p) => (p === 1 ? 1 : 0)) : legPoints(s) };
    if (m.key === "map") pub.reveal = { answer: q.question, notes: q.answer, typed: s.typed, ok: s.ok, winners: w, ...pl };
    else if (typedKey(m.key)) pub.reveal = { answer: q.answer, notes: q.notes || (m.key === "airport" ? [q.city, q.code].filter(Boolean).join(", ") : undefined), typed: s.typed, ok: s.ok, winners: w, ...pl,
      ...(m.key === "say" ? { why: s.why } : {}) };
    else if (m.key === "closest") pub.reveal = { answer: String(q.answer), notes: q.notes, nums: s.nums, off: distances(s), winners: w, ...pl };
    else if (m.key === "pin") pub.reveal = { answer: q.answer, place: q.place, at: { lat: q.lat, lon: q.lon }, pins: s.pins, off: distances(s), winners: w, ...pl };
    else { const c = mrCount(s); pub.reveal = { answer: q.answer, notes: q.notes, counts: c.counts, right: c.right, of: c.of, winners: [] }; }
  }
  if (m && s.screen === "summary") pub.summary = { wins: [...m.wins], pts: [...m.pts], shares: m.key === "majority" ? s.teams.map((_, t) => share(m, t)) : undefined,
    places: m.places || s.teams.map(() => s.teams.length), award: m.award || [], line: m.key === "majority" ? mrLine(s) || undefined : undefined };
  if (s.screen === "final") pub.final = { order: ranking(s), log: s.log, awards: recapMany(s), games: s.minis.map((_, i) => titleOf(s.minis, i)) };
  if (s.screen !== "final") { const f = fireOfMany(s); if (f.some(Boolean)) pub.fire = f; }
  /* the host's phone: the answer while it's up, and what every captain typed */
  const secret: SecretMany = m && q && (s.screen === "q" || s.screen === "reveal")
    ? { answer: String(m.key === "map" ? q.question : q.answer), notes: m.key === "map" ? q.answer : m.key === "say" ? `The app's word. Any other answer on the list scores, if no other team says it too.` : q.notes, typed: s.typed, nums: s.nums } : {};
  void allIn;
  return { pub, secret };
}
