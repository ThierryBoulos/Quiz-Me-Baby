/* The screen check's 3 to 8 team nights (3, 5 and 8 teams, every game, Roulette too): every screen they reach, the
   first and the last of each (screen, game). Built and run by sim/screens/run.mjs. */
import * as L from "../../lib/many/logic";
import { buildMany } from "../../lib/many/view";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QMB = require("../../../engine/core.js");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

export function dumpMany(bank: { bank: Q[]; never?: unknown[] }) {
  const got: Record<string, unknown> = {};
  const T = { sudden: 60, quiz: 60, flag: 15, airport: 30, map: 60, closest: 60, pin: 45, majority: 15, say: 30, dish: 3, dishLast: 8, roulette: 45, stakes: 45, stakesPick: 20, see: 20 };
  const longNames = ["The Quizzical Owls", "Lions", "Brainy Bunch", "Team D", "Smarty Pants", "Les Gros Malins", "Quizteama Aguilera", "Agatha Quiztie"];
  for (const [k, seed] of [[3, 1], [5, 2], [8, 3]] as const) {
    let sd = seed * 7919; const rng = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    const dealer = QMB.createDealer({ bank: () => bank.bank, used: () => new Set(), noRepeat: () => true, rng, never: () => bank.never || [],
      ok: { map: (q: Q) => q.type === "map", flag: (q: Q) => q.type === "flag", dish: (q: Q) => q.type === "dish", pin: (q: Q) => q.type === "pin" && Number.isFinite(q.lat) && !!q.photo,
        airport: (q: Q) => q.type === "airport" && Array.isArray(q.board) && q.board.length > 0, majority: (q: Q) => q.type === "majority" && Array.isArray(q.options) && q.options.length === 4 } });
    const every = [...new Set(bank.bank.filter((q: Q) => q.type === "standard" && q.theme && q.theme !== "Know the Host").map((q: Q) => q.theme))];
    const keys: L.ManyKey[] = ["quiz", "majority", "flag", "airport", "map", "closest", "pin", "say", "dish", "see", "roulette", "quiz", "stakes"];
    const g = dealer.buildGame({ standard: true, rounds: 4 + 6, themes: every, difficulty: "easy+medium+hard", minis: ["majority", "flag", "airport", "map", "closest", "pin", "saysame", "dish", "see", "roulette", "stakes"],
      rouletteChambers: QMB.rouletteChambers(k), rouletteThemes: [], teamA: { name: "A" }, teamB: { name: "B" } });
    const all = (m: { qs?: unknown[]; spare?: unknown[] }) => [...(m?.qs || []), ...(m?.spare || [])] as Q[];
    const say = (dealer.saySameDeck({}) as { pool?: string[] }[]).filter((q) => (q.pool || []).length >= 5).slice(0, 10).map((q) => dealer.drawSaySame(q));
    const quiz = (g.rounds || []).flatMap((r: { q: Q[] }) => r.q);
    const decks = { quiz: quiz.slice(0, 12), sudden: quiz.slice(12), flag: all(g.flagGame), airport: all(g.airportGame), map: all(g.mapGame), closest: all(g.mini), pin: all(g.pinGame),
      majority: all(g.majorityGame), say, dish: all(g.dishGame), see: all(g.seeGame), roulette: all(g.rouletteGame),
      stakes: [...(g.stakesGame?.rounds || []), ...(g.stakesGame?.spare || [])] } as Partial<Record<L.ManyKey, Q[]>>;
    const teams = Array.from({ length: k }, (_, t) => ({ name: longNames[t], captain: "Captain" + t }));
    const s = L.newNight(teams, decks, keys, { quiz: [4, 4] });
    s.intro = true;
    const roster = Array.from({ length: k * 3 }, (_, i) => ({ name: ["Nour", "Karim", "Joe", "Maya", "Rami", "Lea", "Tarek", "Zeina"][i % 8] + (i >= 8 ? i : ""), team: i % k }));
    let now = Date.UTC(2026, 9, 18, 19, 0, 0);
    const snap = (extra = "") => { const { pub } = buildMany(s); const m = L.miniOf(s); const key = `m${k}.${pub.screen}${m ? "." + m.key : ""}${(pub as { intro?: unknown }).intro ? ".intro" : ""}${extra}`;
      const rec = { pub: JSON.parse(JSON.stringify(pub)), secret: JSON.parse(JSON.stringify(buildMany(s).secret)), now }; if (!got[key + ".a"]) got[key + ".a"] = rec; else got[key + ".z"] = rec; };
    snap(); s.intro = false;
    for (let guard = 0; guard < 3000 && s.screen !== "final"; guard++) {
      if (s.screen === "intro") { snap(); L.startMini(s, now, T, roster); continue; }
      /* Secret Stakes' bets: before any is in, then with all but one in (the last takes the safe bet at time-up) */
      if (s.screen === "pick") { snap(".none"); for (let t = 0; t < k - 1; t++) L.stakesBet(s, t, Math.floor(rng() * 3), ["easy", "medium", "hard", "expert"][Math.floor(rng() * 4)], now, T); snap(".some"); L.lockStakes(s, now, T); continue; }
      if (s.screen === "q") {
        const m = L.miniOf(s)!, q = L.qOf(s)!;
        snap();
        if (m.key === "majority") for (const p of s.roster) { if (rng() < 0.1) continue; L.vote(s, p.name, rng() < 0.5 ? q.answer : (q.options as string[])[Math.floor(rng() * 4)]); }
        else if (m.key === "dish") { for (let t = 0; t < k && s.screen === "q"; t++) L.captainAnswer(s, t, { text: rng() < 0.4 ? String(q.answer) : "Atlantis" }); }
        /* What Do You See? (the buzzer): a first team buzzes (the picture stops) and gets it wrong (out, the clock goes
           on); a second buzzes, and more often than not gets it right */
        else if (m.key === "see") {
          const a = Math.floor(rng() * k), b = (a + 1) % k;
          now += 3000; L.buzzSee(s, a, now); now += 2000; snap(".buzz");
          L.captainAnswer(s, a, { text: "Atlantis" }, undefined, now); now += 1000; snap(".out");
          if (s.screen === "q") { now += 1000; L.buzzSee(s, b, now); now += 2000; L.captainAnswer(s, b, { text: rng() < 0.6 ? String(q.answer) : "Atlantis" }, undefined, now); }
        }
        else for (let t = 0; t < k; t++) {
          if (rng() < 0.1) continue;
          if (L.typedKey(m.key)) L.captainAnswer(s, t, { text: rng() < 0.5 ? String(m.key === "map" ? q.question : m.key === "roulette" ? q.ch?.[q.draw?.[t]]?.q?.answer ?? "Paris" : m.key === "stakes" ? L.skQm(s, t)?.answer ?? "Paris" : q.answer) : "Atlantis" }, undefined, now + 1500 + t * 900);
          if (m.key === "closest") L.captainAnswer(s, t, { n: String(Math.round(Number(q.answer) * (0.5 + rng()))) });
          if (m.key === "pin") L.captainAnswer(s, t, { pin: { lat: Number(q.lat) + (rng() - 0.5) * 20, lon: Number(q.lon) + (rng() - 0.5) * 20 } });
        }
        if (s.screen === "q") snap();
        now += 10000; if (s.screen === "q") L.reveal(s); continue;
      }
      if (s.screen === "reveal" || s.screen === "summary") { snap(); if (s.screen === "summary" && s.mi === s.minis.length - 1 && s.teams[0].score !== s.teams[1].score) { s.teams[1].score = s.teams[0].score = Math.max(...s.teams.map((x) => x.score)) + 5; } L.next(s, now, T); continue; }
      snap(); L.next(s, now, T);
    }
    snap();
  }
  return got;
}
