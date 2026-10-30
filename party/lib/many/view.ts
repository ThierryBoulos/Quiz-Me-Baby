/* MANY TEAMS: what the TV publishes (PubMany, for every phone) and what only the host's phone gets
   (the answer and every team's typed answer). Built from the night's state, never stored. */
import { MANY_COLORS, MANY_TITLES, allIn, answered, distances, fireOfMany, legPlaces, legPoints, legWinners, miniOf, mrCount, mrLine, qOf, ranking, recapMany, share, type AwardM, type LatLon, type ManyKey, type StateM } from "./logic";

export type TeamPub = { name: string; captain: string; score: number; color: string };
export type PubMany = {
  many: true; at?: number; step: number; screen: StateM["screen"];
  teams: TeamPub[];
  /* this game: legs taken, its place points so far (this leg's counted from its reveal), Majority Rules' shares */
  game?: { key: ManyKey; title: string; leg: number; of: number; wins: number[]; pts: number[]; shares?: number[]; index: number; count: number };
  qid?: string; question?: string; flag?: string; options?: string[];
  pin?: { photo: string; credit: string; licence: string };
  deadline: number | null; left: number; sent: boolean[];
  roster?: string[];                              // Majority Rules: who plays
  voted?: string[];                               // ...and who has answered (names only, never what)
  reveal?: { answer: string; notes?: string; typed?: (string | null)[]; ok?: (boolean | null)[]; nums?: (number | null)[]; off?: (number | null)[];
    pins?: (LatLon | null)[]; at?: LatLon; place?: string; winners: number[]; counts?: number[]; right?: number[]; of?: number[];
    places?: (number | null)[]; pts?: number[] };            // this leg's places and what they pay this game
  /* a game's result: its tally (or shares), its places, what each place pays the night */
  summary?: { wins: number[]; pts: number[]; shares?: number[]; places: number[]; award: number[]; line?: string };
  final?: { order: { team: number; place: number }[]; log: number[][]; awards: AwardM[]; lines: string[] };
  fire?: boolean[];                                // three legs in a row at 1st, this game
  toast: { id: number; text: string } | null; exit?: boolean; ack?: Record<string, Record<string, string>>;
};
export type SecretMany = { answer?: string; notes?: string; typed?: (string | null)[]; nums?: (number | null)[] };

export function buildMany(s: StateM): { pub: PubMany; secret: SecretMany } {
  const m = miniOf(s), q = qOf(s);
  const pub: PubMany = { many: true, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, sent: answered(s), toast: s.toast, exit: s.exit,
    teams: s.teams.map((t, i) => ({ name: t.name, captain: t.captain, score: t.score, color: MANY_COLORS[i] })) };
  const now = m && m.key !== "majority" && s.screen === "reveal" ? legPoints(s) : null;
  if (m) pub.game = { key: m.key, title: MANY_TITLES[m.key], leg: Math.min(m.i + 1, m.qs.length), of: m.qs.length, wins: [...m.wins],
    pts: m.pts.map((p, t) => p + (now ? now[t] : 0)), index: s.mi, count: s.minis.length };
  /* Majority Rules: each team's share so far, for the tracker's "this game" line (the questions counted already) */
  if (m && m.key === "majority" && pub.game) pub.game.shares = s.teams.map((_, t) => share(m, t));
  if (m && q && (s.screen === "q" || s.screen === "reveal")) {
    pub.qid = String(q.id ?? m.key + m.i);
    if (m.key === "flag") pub.flag = q.flag;
    else if (m.key === "pin") pub.pin = { photo: q.photo, credit: q.credit, licence: q.licence };
    else pub.question = q.question;
    if (m.key === "majority") { pub.options = q.options; pub.roster = s.roster.map((r) => r.name); pub.voted = Object.keys(s.votes); }
  }
  if (m && q && s.screen === "reveal") {
    const w = legWinners(s), pl = { places: legPlaces(s), pts: legPoints(s) };
    if (m.key === "flag") pub.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, winners: w, ...pl };
    else if (m.key === "closest") pub.reveal = { answer: String(q.answer), notes: q.notes, nums: s.nums, off: distances(s), winners: w, ...pl };
    else if (m.key === "pin") pub.reveal = { answer: q.answer, place: q.place, at: { lat: q.lat, lon: q.lon }, pins: s.pins, off: distances(s), winners: w, ...pl };
    else { const c = mrCount(s); pub.reveal = { answer: q.answer, notes: q.notes, counts: c.counts, right: c.right, of: c.of, winners: [] }; }
  }
  if (m && s.screen === "summary") pub.summary = { wins: [...m.wins], pts: [...m.pts], shares: m.key === "majority" ? s.teams.map((_, t) => share(m, t)) : undefined,
    places: m.places || s.teams.map(() => s.teams.length), award: m.award || [], line: m.key === "majority" ? mrLine(s) || undefined : undefined };
  if (s.screen === "final") pub.final = { order: ranking(s), log: s.log, ...recapMany(s) };
  if (s.screen !== "final") { const f = fireOfMany(s); if (f.some(Boolean)) pub.fire = f; }
  /* the host's phone: the answer while it's up, and what every captain typed */
  const secret: SecretMany = m && q && (s.screen === "q" || s.screen === "reveal") ? { answer: String(q.answer), notes: q.notes, typed: s.typed, nums: s.nums } : {};
  void allIn;
  return { pub, secret };
}
