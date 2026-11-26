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
  const T = { sudden: 60, quiz: 60, flag: 15, airport: 30, map: 60, closest: 60, pin: 45, majority: 15, say: 30, dish: 3, dishLast: 8, roulette: 45, stakes: 45, stakesPick: 20, see: 20, fool: 45, foolPick: 20 };
  const longNames = ["The Quizzical Owls", "Lions", "Brainy Bunch", "Team D", "Smarty Pants", "Les Gros Malins", "Quizteama Aguilera", "Agatha Quiztie"];
  /* (SCREENS_TEAMS=4,8: other team counts than the usual 3, 5 and 8, e.g. for pictures of a room of four) */
  const asked = (process.env.SCREENS_TEAMS || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 3 && n <= 8);
  for (const [k, seed] of (asked.length ? asked.map((n) => [n, n] as const) : [[3, 1], [5, 2], [8, 3]] as const)) {
    let sd = seed * 7919; const rng = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    const dealer = QMB.createDealer({ bank: () => bank.bank, used: () => new Set(), noRepeat: () => true, rng, never: () => bank.never || [],
      ok: { map: (q: Q) => q.type === "map", flag: (q: Q) => q.type === "flag", dish: (q: Q) => q.type === "dish", pin: (q: Q) => q.type === "pin" && Number.isFinite(q.lat) && !!q.photo,
        airport: (q: Q) => q.type === "airport" && Array.isArray(q.board) && q.board.length > 0, majority: (q: Q) => q.type === "majority" && Array.isArray(q.options) && q.options.length === 4 } });
    const every = [...new Set(bank.bank.filter((q: Q) => q.type === "standard" && q.theme && q.theme !== "Know the Host").map((q: Q) => q.theme))];
    const keys: L.ManyKey[] = ["quiz", "majority", "flag", "airport", "map", "closest", "pin", "say", "dish", "see", "fool", "roulette", "quiz", "stakes"];
    const g = dealer.buildGame({ standard: true, rounds: 4 + 6, themes: every, difficulty: "easy+medium+hard", minis: ["majority", "flag", "airport", "map", "closest", "pin", "saysame", "dish", "see", "fool", "roulette", "stakes"],
      rouletteChambers: QMB.rouletteChambers(k), rouletteThemes: [], seeLegs: L.MANY_LEGS.see, teamA: { name: "A" }, teamB: { name: "B" } });
    const all = (m: { qs?: unknown[]; spare?: unknown[] }) => [...(m?.qs || []), ...(m?.spare || [])] as Q[];
    const say = (dealer.saySameDeck({}) as { pool?: string[] }[]).filter((q) => (q.pool || []).length >= 5).slice(0, 10).map((q) => dealer.drawSaySame(q));
    const quiz = (g.rounds || []).flatMap((r: { q: Q[] }) => r.q);
    const decks = { quiz: quiz.slice(0, 12), sudden: quiz.slice(12), flag: all(g.flagGame), airport: all(g.airportGame), map: all(g.mapGame), closest: all(g.mini), pin: all(g.pinGame),
      majority: all(g.majorityGame), say, dish: all(g.dishGame), see: all(g.seeGame), roulette: all(g.rouletteGame),
      stakes: [...(g.stakesGame?.rounds || []), ...(g.stakesGame?.spare || [])], fool: all(g.foolGame),
      /* the comeback's easy questions (17 Nov): the night below is made a massacre at its middle, so its screens come up */
      comeback: bank.bank.filter((q: Q) => q.type === "standard" && q.difficulty === "easy" && q.theme !== "Know the Host" && !quiz.some((x: Q) => x.id === q.id)).slice(0, 5) } as Partial<Record<L.ManyKey, Q[]>>;
    const teams = Array.from({ length: k }, (_, t) => ({ name: longNames[t], captain: "Captain" + t }));
    const s = L.newNight(teams, decks, keys, { quiz: [4, 6] });   // (the second game three rounds: "Rounds 3, 4 and 5", an odd round never plays alone)
    s.intro = true;
    /* (SCREENS_PLAYERS=8: eight on every team, the biggest list Majority Rules shows: 25 Nov) */
    const per = Number(process.env.SCREENS_PLAYERS) || 3, PPL = ["Nour", "Karim", "Joe", "Maya", "Rami", "Lea", "Tarek", "Zeina", "Christophe", "Alexandra", "Sami", "Rita", "Hadi", "Yara", "Omar", "Dana",
      "Fadi", "Lina", "Georges", "Nathalie", "Elie", "Carla", "Jean-Paul", "Mireille", "Ziad", "Hala", "Marc", "Joanna", "Wissam", "Raya", "Antoine", "Stephanie"];
    const roster = Array.from({ length: k * per }, (_, i) => ({ name: PPL[i % PPL.length] + (i >= PPL.length ? i : ""), team: i % k }));
    /* the list before Start: most on the game screen, one not here yet, one taken off */
    const mrList = roster.map((r, i) => ({ ...r, here: i % 7 !== 3, ...(i === 5 ? { out: true } : {}) }));
    let now = Date.UTC(2026, 9, 18, 19, 0, 0);
    const snap = (extra = "") => { const { pub } = buildMany(s); const m = L.miniOf(s); const key = `m${k}.${pub.screen}${m ? "." + m.key : ""}${(pub as { intro?: unknown }).intro ? ".intro" : ""}${extra}`;
      const rec = { pub: JSON.parse(JSON.stringify(pub)), secret: JSON.parse(JSON.stringify(buildMany(s).secret)), now }; if (!got[key + ".a"]) got[key + ".a"] = rec; else got[key + ".z"] = rec; };
    snap(); s.intro = false;
    for (let guard = 0; guard < 3000 && s.screen !== "final"; guard++) {
      if (s.screen === "intro") { if (L.miniOf(s)?.key === "majority") s.mrList = mrList; snap(); delete s.mrList; L.startMini(s, now, T, roster.filter((_, i) => i !== 5)); continue; }
      /* Secret Stakes' bets: before any is in, then with all but one in (the last takes the safe bet at time-up) */
      /* Fool Me Twice: the answers up, none picked; then all but the last (the reveal at time-up) */
      if (s.screen === "pick" && L.miniOf(s)?.key === "fool") { snap(".none"); const F = s.fool!;
        for (let t = 0; t < k - 1; t++) { const can = F.opts.map((_, i) => i).filter((i) => !F.opts[i].by.includes(t)); L.captainAnswer(s, t, { pick: can[Math.floor(rng() * can.length)], pred: (t + 1) % k }); }
        snap(".some"); L.foolReveal(s); continue; }
      if (s.screen === "pick") { snap(".none"); for (let t = 0; t < k - 1; t++) L.stakesBet(s, t, Math.floor(rng() * 3), ["easy", "medium", "hard", "expert"][Math.floor(rng() * 4)], now, T); snap(".some"); L.lockStakes(s, now, T); continue; }
      if (s.screen === "q") {
        const m = L.miniOf(s)!, q = L.qOf(s)!;
        snap();
        /* Fool Me Twice: lies of every length (40 letters the longest), the last team none (ours in its place) */
        if (m.key === "fool") { for (let t = 0; t < k - 1; t++) L.captainAnswer(s, t, { text: ["A wig", "Its weight in chocolate", "A hamster", "Forty sheep and a goat", "Wax", "Pickled herring", "Seventeen rubber chickens"][t % 7] }); snap(); L.foolOpen(s, now, T); continue; }
        /* the comeback: the first team in it gets all three, the others two times in three (one misses, one sends nothing) */
        if (m.key === "comeback") { (m.only || []).forEach((t, j) => { if (m.cb?.out[t]) return; if (j > 0 && rng() < 0.15) return; L.captainAnswer(s, t, { text: j === 0 || rng() < 0.66 ? String(q.answer) : "Atlantis" }, undefined, now + 1500 + j * 900); }); }
        else if (m.key === "majority") for (const p of s.roster) { if (rng() < 0.1) continue; L.vote(s, p.name, rng() < 0.5 ? q.answer : (q.options as string[])[Math.floor(rng() * 4)]); }
        else if (m.key === "dish") { for (let t = 0; t < k && s.screen === "q"; t++) L.captainAnswer(s, t, { text: rng() < 0.4 ? String(q.answer) : "Atlantis" }); }
        /* What Do You See? (the buzzer): a first team buzzes (the picture stops) and gets it wrong (out, the clock goes
           on); a second buzzes, and two times in three gets it right */
        else if (m.key === "see") {
          /* (the first to buzz is the team the phones in these pictures are on, Maya its player: its captain's phone
             shows the answer box, then "out of this picture") */
          const a = 0, b = 1 + Math.floor(rng() * (k - 1));
          now += 3000; L.buzzSee(s, a, now, "Maya"); now += 2000; snap(".buzz");
          L.captainAnswer(s, a, { text: "Atlantis" }, undefined, now); now += 1000; snap(".out");
          if (s.screen === "q") { now += 1000; L.buzzSee(s, b, now, "Karim"); now += 2000; L.captainAnswer(s, b, { text: m.i % 3 !== 1 ? String(q.answer) : "Atlantis" }, undefined, now); }   // (two pictures in three are got, the first and the last among them)
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
      /* (the night's middle: the last teams far behind, so the comeback comes) */
      if (s.screen === "summary" && !s.cbDone && s.mi + 1 >= Math.ceil(s.minis.filter((x) => !L.extraGame(x.key)).length / 2)) { const top = Math.max(...s.teams.map((x) => x.score));
        snap(); s.teams[k - 1].score = Math.round(top * 0.15); if (k > 4) s.teams[k - 2].score = Math.round(top * 0.3); if (k > 6) s.teams[k - 3].score = Math.round(top * 0.33);
        /* (8 teams: five left behind, every long name in the announcement, 18 Nov) */
        if (k > 7) { s.teams[k - 4].score = Math.round(top * 0.36); s.teams[k - 5].score = Math.round(top * 0.39); s.teams.slice(0, 3).forEach((x) => { x.score = Math.max(x.score, Math.round(top * 0.9)); }); }
        L.next(s, now, T); continue; }
      if (s.screen === "reveal" || s.screen === "summary") { snap(); if (s.screen === "summary" && s.mi === s.minis.length - 1 && s.teams[0].score !== s.teams[1].score) { s.teams[1].score = s.teams[0].score = Math.max(...s.teams.map((x) => x.score)) + 5; } L.next(s, now, T); continue; }
      snap(); L.next(s, now, T);
    }
    snap();
    /* Russian Roulette once the barrel has stopped (22 Nov: the nights pass it too quickly to catch, as with 2 teams):
       the question up, the clock running, half the teams in */
    { const rr = got[`m${k}.q.roulette.a`] as { pub: Q; secret: Q; now: number } | undefined;
      if (rr?.pub.roulette?.spinAt) { const c = JSON.parse(JSON.stringify(rr)); c.now = c.pub.roulette.spinAt + 9000; c.pub.deadline = c.now + 25000; c.pub.left = 0; c.pub.timeUp = false;
        c.pub.sent = c.pub.teams.map((_: unknown, t: number) => t % 2 === 1); got[`m${k}.q.roulette.extra.stopped.a`] = c; } }
    /* Fool Me Twice's worst cases on the reveal (16 Nov, the owner: "will it fit with 8 teams?"), from the first fact's:
       every team writes a lie and every team's named team falls for it (k right predictions); and one lie fools every
       other team, its writer's named team among them (one right prediction, k-1 teams on one lie) */
    const base = got[`m${k}.reveal.fool.a`] as { pub: Q; secret: Q; now: number } | undefined;
    if (base) {
      const lies = ["A wig", "Its weight in chocolate", "A hamster", "Forty sheep and a goat", "Wax", "Pickled herring", "Seventeen rubber chickens", "A very small lighthouse"];
      const truth = base.pub.fool.rev.opts.find((o: Q) => o.truth);
      const make = (tag: string, picks: number[]) => {
        const rec = JSON.parse(JSON.stringify(base)), opts = [{ ...truth, by: [] }, ...Array.from({ length: k }, (_, t) => ({ text: lies[t], by: [t] }))];
        if (k === 3) opts.push({ text: "A lighthouse keeper", ours: true, by: [] });
        const pred = Array.from({ length: k }, (_, t) => (t + 1) % k), r = QMB.foolScore(opts, picks, pred);
        rec.pub.fool.opts = opts.map((o) => o.text);
        /* (the tracker's "this game" counts the fact on the reveal: this one's points in place of the first fact's) */
        if (rec.pub.game?.pts) { rec.pub.game.pts = rec.pub.game.pts.map((v: number, t: number) => v - (base.pub.fool.rev.pts[t] || 0) + r.pts[t]); }
        rec.pub.fool.rev = { ...rec.pub.fool.rev, opts, fooled: r.fooled, pts: r.pts, hits: r.hits, predicts: pred };
        if (rec.secret && Array.isArray(rec.secret.typed)) rec.secret.typed = lies.slice(0, k);
        got[`m${k}.reveal.fool.${tag}.a`] = rec;
      };
      /* (the answers: 0 the truth, then team t's lie at t + 1) */
      make("allcalled", Array.from({ length: k }, (_, u) => 1 + ((u - 1 + k) % k)));
      make("allfooled", Array.from({ length: k }, (_, u) => (u === 0 ? 0 : 1)));
    }
    /* Majority Rules' reveal with the bank's longest four answers and longest fact (25 Nov, the owner: "make sure it fits
       in the maximum case"): each team's count on every answer up to four teams, the room's from five */
    { const mr = got[`m${k}.reveal.majority.z`] as { pub: Q; secret: Q; now: number } | undefined, deck = (decks.majority || []) as Q[];
      const long = deck.slice().sort((a, b) => (b.options as string[]).join("").length - (a.options as string[]).join("").length)[0];
      const note = deck.slice().sort((a, b) => String(b.notes || "").length - String(a.notes || "").length)[0];
      if (mr && long) { const c = JSON.parse(JSON.stringify(mr));
        c.pub.question = long.question; c.pub.options = long.options; c.pub.reveal.answer = long.answer; c.pub.reveal.notes = note?.notes || long.notes;
        c.pub.reveal.byTeam = (long.options as string[]).map((_, i) => c.pub.teams.map((_: unknown, t: number) => (i * 3 + t * 5) % 9));
        c.pub.reveal.counts = c.pub.reveal.byTeam.map((r: number[]) => r.reduce((a, x) => a + x, 0));
        got[`m${k}.reveal.majority.extra.long.a`] = c; }
      /* ...and three players right all ten, the flame on every phone (25 Nov) */
      if (mr) { const c = JSON.parse(JSON.stringify(mr)); c.pub.mrFire = [{ name: "Christophe", n: 10 }, { name: "Alexandra", n: 10 }, { name: "Jean-Paul", n: 10 }];
        got[`m${k}.reveal.majority.extra.fire.a`] = c; } }
    /* the night's card with the furthest pin on it (23 Nov, the owner: as with 2 teams), its landmark the longest */
    { const fk = Object.keys(got).find((x) => x.startsWith(`m${k}.final`)), fin = fk ? (got[fk] as { pub: Q }) : undefined;
      if (fin?.pub.final?.awards?.length) { const c = JSON.parse(JSON.stringify(fin)), A = c.pub.final.awards as Q[];
        const far = { t: "Furthest pin", who: `${longNames[k - 1]}, 12,345 km off`, team: k - 1, note: "Borobudur (Near Magelang, Central Java, Indonesia)" };
        c.pub.final.awards = [...A.filter((a) => !a.spoon).slice(0, 3), far, ...A.filter((a) => a.spoon)].slice(0, 5);
        got[`m${k}.final.extra.far.a`] = c; } }
    /* (26 Nov, the wording pictures: a night that ends with two teams on top, "Tied at the top"; and a game two teams
       tie for, "… tied for 1st, +10 each", with the two longest names) */
    { const fk = Object.keys(got).find((x) => x.startsWith(`m${k}.final`) && !x.includes("extra")), fin = fk ? (got[fk] as { pub: Q }) : undefined;
      if (fin?.pub.final?.order?.length > 1) { const c = JSON.parse(JSON.stringify(fin)), O = c.pub.final.order as { team: number; place: number }[];
        const top = O.find((o) => o.place === 1) || O[0], next = O.find((o) => o.team !== top.team)!;
        next.place = 1; c.pub.teams[next.team].score = c.pub.teams[top.team].score;
        got[`m${k}.final.extra.tied.a`] = c; } }
    { const sk = Object.keys(got).find((x) => x.startsWith(`m${k}.summary.flag`)), sm = sk ? (got[sk] as { pub: Q }) : undefined;
      if (sm?.pub.summary?.places) { const c = JSON.parse(JSON.stringify(sm)), S = c.pub.summary as { places: number[]; award: number[]; pts: number[] };
        const byLen = c.pub.teams.map((t: { name: string }, i: number) => [t.name.length, i]).sort((a: number[], b: number[]) => b[0] - a[0]).map((x: number[]) => x[1]), a = byLen[0], b = byLen[1];
        const was = S.places.indexOf(1), best = Math.max(...S.pts);
        if (was >= 0 && was !== a && was !== b) { S.places[was] = 3; S.award[was] = 6; S.pts[was] = Math.max(0, best - 1); }
        S.places[a] = 1; S.places[b] = 1; S.award[a] = 10; S.award[b] = 10; S.pts[a] = best; S.pts[b] = best;
        got[`m${k}.summary.flag.extra.tied.a`] = c; } }
  }
  return got;
}
