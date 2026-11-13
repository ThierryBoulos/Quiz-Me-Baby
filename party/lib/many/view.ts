/* MANY TEAMS: what the TV publishes (PubMany, for every phone) and what only the host's phone gets
   (the answer and every team's typed answer). Built from the night's state, never stored. */
import { MANY_COLORS, qidOf, allIn, answered, dishRight, distances, fireOfMany, legPlaces, legPoints, legWinners, miniOf, mrCount, mrLine, qOf, ranking, recapMany, share, titleOf, roundNumbers, typedKey, type AwardM, type FlagM, type LatLon, type ManyKey, type StateM } from "./logic";
import { dishKind } from "../tv/rules";
import { revOf } from "../engine";
import type { IntroPub } from "../intro";
import { rrPub, rrQ, rrSpins, type RrLap, type RrPub } from "../roulette";
import { skPub, type SkGame, type SkPub } from "../stakes";
import { SEE_TYPE, sePic, type SePub } from "../see";
import { QMB } from "../engine";
import { skQm } from "./logic";

export type TeamPub = { name: string; captain: string; score: number; color: string };
export type PubMany = {
  many: true; at?: number; step: number; screen: StateM["screen"];
  teams: TeamPub[];
  /* this game: legs taken, its place points so far (this leg's counted from its reveal), Majority Rules' shares */
  game?: { key: ManyKey; title: string; leg: number; of: number; wins: number[]; pts: number[]; shares?: number[]; index: number; count: number;
    keys?: ManyKey[];                             // the night's games in order (the pips: a dot a question round, a dash a mini-game)
    only?: number[];                              // sudden death: the teams tied at the top, the only ones who answer
    themes?: string[] };                          // a question round: its themes, in the order they come
  qid?: string; question?: string; flag?: string; options?: string[];
  pin?: { photo: string; credit: string; licence: string };
  /* Guess the Airport: the board (its name and code only at the reveal); Guess the Map: the map; the Cocktail or
     Dish: the ingredients up so far, and the teams whose one guess was wrong (out of this one) */
  airport?: { title: string; board: string[][]; code?: string; city?: string };
  map?: { id: string; reveal: boolean; title?: string; rev?: string; hint?: string };
  dish?: { kind: string; ings: string[]; n: number };
  out?: boolean[];
  roulette?: RrPub;                               // Russian Roulette: the barrel, each team's chamber and question (what's behind them at the reveal)
  see?: SePub;                                    // What Do You See?: the picture and how it clears; at the reveal what it was, the fastest right guess
  preload?: { sees?: string[] };                  // What Do You See?: the next pictures, fetched ahead (the TV its size, a phone its own)
  stakes?: SkPub;                                 // Secret Stakes: the round's themes, who has bet (and each team's bet, drawn only on its own phones), the questions, the reveal
  theme?: string;                                 // a question round: the question's theme
  deadline: number | null; left: number; sent: boolean[]; now?: number; paused?: boolean;
  roster?: string[];                              // Majority Rules: who plays
  voted?: string[];                               // ...and who has answered (names only, never what)
  reveal?: { answer: string; notes?: string; typed?: (string | null)[]; ok?: (boolean | null)[]; nums?: (number | null)[]; off?: (number | null)[];
    pins?: (LatLon | null)[]; at?: LatLon; place?: string; winners: number[]; counts?: number[]; right?: number[]; of?: number[];
    why?: (string | null)[];                      // Don't Say the Same: why an answer doesn't score ("said", "off", "same")
    places?: (number | null)[]; pts?: number[] };            // this leg's places and what they pay this game
  /* a game's result: its tally (or shares), its places, what each place pays the night */
  summary?: { wins: number[]; pts: number[]; shares?: number[]; places: number[]; award: number[]; line?: string; noAward?: boolean; plus?: boolean;
    spins?: number[][];   // Russian Roulette: each team's points spin by spin (its barrel at the result)
    got?: string[][] };   // What Do You See?: the pictures each team took (its pile at the result)
  final?: { order: { team: number; place: number }[]; log: number[][]; awards: AwardM[]; games: string[] };
  fire?: boolean[];                                // three legs in a row at 1st, this game
  intro?: IntroPub;                              // the night's intro (before the first game), until Let's go
  toast: { id: number; text: string } | null; exit?: boolean; ack?: Record<string, Record<string, string>>;
  /* a captain's contest open on the reveal (the host decides), and the calls already looked at */
  contest?: { t: number; by: number; ok: boolean; text: string } | null;
  contested?: number[];
  hostGone?: { name: string | null; since: number; openAt: number } | null;   // the night waits for a host (TV time)
  mrOut?: string[];                               // Majority Rules: taken off the list (the host's, at its intro)
  imad?: { id: number; text: string; mood?: string };   // Imad's latest line (the TV's bubble)
  flags?: FlagM[];                                // left the screen during a question, or pasted (the host's list; no host: the captains')
};
export type SecretMany = { answer?: string; notes?: string; typed?: (string | null)[]; nums?: (number | null)[];
  answers?: string[];                           // Russian Roulette, Secret Stakes: each team's own question's answer
  step?: number; qid?: string;                  // which question this answer is for (the host's card shows only a match)
  out?: boolean[] };                            // the Cocktail or Dish: the teams whose one guess was wrong (the host's phone only)

export function buildMany(s: StateM): { pub: PubMany; secret: SecretMany } {
  const m = miniOf(s), q = qOf(s);
  const pub: PubMany = { many: true, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, sent: answered(s), toast: s.toast, exit: s.exit, ...(s.paused ? { paused: true } : {}),
    teams: s.teams.map((t, i) => ({ name: t.name, captain: t.captain, score: t.score, color: MANY_COLORS[i] })) };
  const now = m && m.key !== "majority" && s.screen === "reveal" ? legPoints(s) : null;
  if (m) pub.game = { key: m.key, title: titleOf(s.minis, s.mi), leg: Math.min(m.i + 1, m.qs.length), of: m.qs.length, wins: [...m.wins],
    pts: m.pts.map((p, t) => p + (now ? now[t] : 0)), index: s.mi, count: s.minis.filter((x) => x.key !== "sudden").length, keys: s.minis.filter((x) => x.key !== "sudden").map((x) => x.key), ...(m.only ? { only: m.only } : {}),
    ...(m.key === "quiz" ? { themes: [...new Set(m.qs.map((q) => String(q.theme || "")).filter(Boolean))] } : {}) };
  /* Majority Rules: each team's share so far, for the tracker's "this game" line; on the reveal this question
     counts too (it is only banked at Next), so the line agrees with "2 of 2 right" under it (the reviewers, 31 Oct) */
  if (m && m.key === "majority" && pub.game) { const c = s.screen === "reveal" ? mrCount(s) : null;
    pub.game.shares = s.teams.map((_, t) => { const r = m.right[t] + (c ? c.right[t] : 0), of = m.of[t] + (c ? c.of[t] : 0); return of ? r / of : 0; }); }
  /* Secret Stakes: the round as the screens show it; at the reveal the night's totals already move with the calls (the
     points are banked at Next), and the tracker's "this game" line is what each team has won or lost */
  if (m?.key === "stakes") {
    const G: SkGame = { rounds: m.qs, spare: [], i: m.i, base: m.qs.length, unit: m.unit || 1, picks: s.picks || [], log: m.log || [], net: m.net || s.teams.map(() => 0), done: false };
    const sc = s.screen === "pick" ? "stakesPick" : s.screen === "q" ? "stakesQ" : s.screen === "reveal" ? "stakesReveal" : s.screen === "summary" ? "stakesSummary" : "";
    const scores = s.teams.map((x) => x.score);
    pub.stakes = skPub(G, sc, scores, s.screen === "reveal" ? s.ok : null, s.screen === "reveal" ? s.typed : null);
    if (s.screen === "pick") { pub.sent = s.teams.map((_, t) => !!s.picks?.[t]); pub.qid = qidOf(s); }
    if (s.screen === "reveal") {
      const res = QMB.stakesResult(scores, s.picks || [], s.ok.map(Boolean), m.unit || 1);
      pub.teams = pub.teams.map((x, i) => ({ ...x, score: res.after[i] }));
      if (pub.game) pub.game.pts = (m.net || []).map((v, i) => v + res.delta[i]);
    } else if (pub.game) pub.game.pts = [...(m.net || s.teams.map(() => 0))];
  }
  if (m && q && (s.screen === "q" || s.screen === "reveal")) {
    /* (a key for this question, not its id in the bank, which anyone can look up: the 4 Nov audit, 4.5) */
    pub.qid = qidOf(s);
    const rev = s.screen === "reveal";
    if (m.key === "flag") pub.flag = q.flag;
    else if (m.key === "pin") pub.pin = { photo: q.photo, credit: q.credit, licence: q.licence };
    else if (m.key === "airport") pub.airport = { title: q.boardTitle, board: q.board, code: rev ? q.code : undefined, city: rev ? q.city : undefined };
    else if (m.key === "map") pub.map = { id: q.id, reveal: rev, title: rev ? q.question : undefined, ...(rev && revOf(q) ? { rev: revOf(q) } : {}), ...(s.mapHint ? { hint: "on" } : {}) };
    else if (m.key === "dish") { pub.dish = { kind: dishKind(q), ings: (q.ings || []).slice(0, rev ? undefined : Math.max(1, s.shown)), n: (q.ings || []).length };
      if (rev) pub.out = s.teams.map((_, t) => s.typed[t] != null && !dishRight(s, t)); }
    else if (m.key === "roulette") pub.roulette = rrPub(q as RrLap, m.i, m.qs.length, (q as RrLap).ch.length, m.pts, s.spinAt ?? null, rev ? s.ok : null);
    else if (m.key === "stakes") { /* (each team's own question: pub.stakes.q) */ }
    /* What Do You See?: the picture (never its answer); who buzzed and until when it has to say it and type it, and
       the teams out of this picture (everyone heard it); at the reveal, what it was and the fastest right answer */
    else if (m.key === "see") {
      pub.see = { ...sePic(q), total: s.total || 20, n: m.i + 1, of: m.qs.length, out: s.teams.map((_, t) => !!s.out?.[t]) };
      if (!rev) { pub.see.buzz = s.buzz ?? null; pub.see.by = s.buzz != null ? s.buzzBy ?? null : null; pub.see.typeBy = s.buzz != null && s.buzzAt ? s.buzzAt + SEE_TYPE * 1000 : null; pub.out = pub.see.out; }
      if (rev) { const pl = legPlaces(s), w = pl.indexOf(1), ms = s.ms || [];
        pub.see.rev = { answer: q.answer, notes: q.notes || undefined, credit: q.credit, licence: q.licence, who: w >= 0 ? w : null, ms: w >= 0 ? ms[w] ?? null : null, at: s.teams.map((_, t) => ms[t] ?? null) };
        pub.out = s.teams.map((_, t) => !!s.out?.[t] && !s.ok[t]); }
    }
    else pub.question = q.question;
    if (m.key === "quiz" && q.theme) pub.theme = q.theme;
    if (m.key === "majority") { pub.options = q.options; pub.roster = s.roster.map((r) => r.name); pub.voted = Object.keys(s.votes); }
  }
  if (s.screen === "reveal") { pub.contest = s.contest ?? null; pub.contested = s.contested || []; }
  if (s.hostGone) pub.hostGone = s.hostGone;
  if (s.flags?.length) pub.flags = s.flags.slice(-30);
  if (s.mrOut?.length) pub.mrOut = s.mrOut;
  if (s.imad) pub.imad = s.imad;
  if (m && q && s.screen === "reveal") {
    /* (sudden death pays the night one point, to the fastest right answer) */
    const w = legWinners(s), places = legPlaces(s), pl = { places, pts: m.key === "sudden" ? places.map((p) => (p === 1 ? 1 : 0)) : legPoints(s) };
    if (m.key === "map") pub.reveal = { answer: q.question, notes: q.answer, typed: s.typed, ok: s.ok, winners: w, ...pl };
    else if (m.key === "roulette") pub.reveal = { answer: "", typed: s.typed, ok: s.ok, winners: w, ...pl };
    else if (m.key === "stakes") pub.reveal = { answer: "", typed: s.typed, ok: s.ok, winners: w, places: s.teams.map(() => null), pts: pub.stakes?.rev?.delta || [] };
    else if (typedKey(m.key)) pub.reveal = { answer: q.answer, notes: q.notes || (m.key === "airport" ? [q.city, q.code].filter(Boolean).join(", ") : undefined), typed: s.typed, ok: s.ok, winners: w, ...pl,
      ...(m.key === "say" ? { why: s.why } : {}) };
    else if (m.key === "closest") pub.reveal = { answer: String(q.answer), notes: q.notes, nums: s.nums, off: distances(s), winners: w, ...pl };
    else if (m.key === "pin") pub.reveal = { answer: q.answer, place: q.place, at: { lat: q.lat, lon: q.lon }, pins: s.pins, off: distances(s), winners: w, ...pl };
    else { const c = mrCount(s); pub.reveal = { answer: q.answer, notes: q.notes, counts: c.counts, right: c.right, of: c.of, winners: [] }; }
  }
  if (m && s.screen === "summary") pub.summary = { wins: [...m.wins], pts: [...m.pts], shares: m.key === "majority" ? s.teams.map((_, t) => share(m, t)) : undefined,
    places: m.places || s.teams.map(() => s.teams.length), award: m.award || [], line: m.key === "majority" ? mrLine(s) || undefined : undefined,
    spins: m.key === "roulette" ? rrSpins(m.qs as RrLap[], s.teams.length) : undefined, got: m.key === "see" ? s.teams.map((_, t) => [...(m.got?.[t] || [])]) : undefined };
  /* (Secret Stakes pays nothing at its end: the bets are already on the totals; its summary is pub.stakes.sum) */
  if (m?.key === "stakes" && pub.summary) { pub.summary.award = s.teams.map(() => 0); pub.summary.noAward = true; }
  if (m?.key === "see" && s.screen !== "summary") pub.preload = { sees: m.qs.slice(m.i, m.i + 2).map((q) => String(q?.photo || "")).filter(Boolean) };
  if (s.intro) { const games = s.minis.filter((x) => x.key !== "sudden");
    pub.intro = { many: true, teams: s.teams.length, items: games.map((x, i) => ({ kind: x.key === "quiz" ? "q" as const : "mini" as const, key: x.key + i, game: x.key, title: titleOf(s.minis, i),
      ...(x.key === "quiz" ? { themes: [...new Set(x.qs.map((q) => String(q.theme || "")).filter(Boolean))], rounds: roundNumbers(s.minis, i) } : {}) })) }; }
  if (s.screen === "final") pub.final = { order: ranking(s), log: s.log, awards: recapMany(s), games: s.minis.map((_, i) => titleOf(s.minis, i)) };
  if (s.screen !== "final") { const f = fireOfMany(s); if (f.some(Boolean)) pub.fire = f; }
  /* the host's phone: the answer while it's up, and what every captain typed */
  const secret: SecretMany = m && q && (s.screen === "q" || s.screen === "reveal")
    ? { answer: m.key === "roulette" || m.key === "stakes" ? "" : String(m.key === "map" ? q.question : q.answer), notes: m.key === "map" ? q.answer : m.key === "say" ? `The app's word. Any other answer on the list scores, if no other team says it too.` : m.key === "roulette" || m.key === "stakes" ? undefined : q.notes, typed: s.typed, nums: s.nums,
        ...(m.key === "roulette" ? { answers: s.teams.map((_, t) => String(rrQ(q as RrLap, t)?.answer ?? "")) } : {}),
        ...(m.key === "stakes" ? { answers: s.teams.map((_, t) => String(skQm(s, t)?.answer ?? "")) } : {}),
        step: s.step, qid: pub.qid, ...(m.key === "dish" ? { out: s.teams.map((_, t) => s.typed[t] != null && !dishRight(s, t)) } : {}),
        ...(m.key === "see" ? { out: s.teams.map((_, t) => !!s.out?.[t]) } : {}) } : { step: s.step };
  void allIn;
  return { pub, secret };
}
