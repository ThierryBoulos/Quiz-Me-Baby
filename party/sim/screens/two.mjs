/* The screen check's two-team nights: every screen they reach, the first and the last of each (screen, game).
   No host, with a host, and a long night of Roulette, Majority Rules and the Battle. `night` is sim/night.jsx's. */
const ALL = ["flag", "closest", "auction", "battle", "dish", "saysame", "map", "pin", "airport", "majority", "roulette", "see", "stakes"];
const NIGHTS = [
  { tag: "nh", seed: 41, minis: ALL, rounds: 4, crowd: 5, tieMore: 1 },
  { tag: "h", seed: 42, minis: ALL, rounds: 4, host: true, crowd: 5, tieMore: 1 },
  { tag: "nh2", seed: 43, minis: ["roulette", "majority", "battle"], rounds: 14, crowd: 3 },
  /* Fool Me Twice (16 Nov): no host and with a host */
  /* lifelines off for the night (28 Nov, the owner: none on any screen, not crossed out): its standard rounds only */
  { tag: "nhl", seed: 50, minis: [], rounds: 2, crowd: 3, lifelines: false, only: /^(roundIntro|ask|steal|answer)$/ },
  { tag: "hl", seed: 51, minis: [], rounds: 2, host: true, crowd: 3, lifelines: false, only: /^(roundIntro|ask|steal|answer)$/ },
  { tag: "nhf", seed: 44, minis: ["fool"], rounds: 2, crowd: 3, tieMore: 1 },
  { tag: "hf", seed: 45, minis: ["fool"], rounds: 2, host: true, crowd: 3, tieMore: 1 },
  /* The Comeback (17 Nov): no host and with a host, a team that makes it and a team that misses; the phones' captain
     and player are Lions, so once Lions play for it (the answer box) and once Owls do. only: just its own four
     screens are kept from these nights (the rest of them is the nights above) */
  { tag: "nhcm", seed: 46, minis: [], rounds: 4, crowd: 3, events: [{ at: 5, type: "score", a: 1, b: 12 }], comeback: "make", only: /^comeback/ },
  { tag: "nhcx", seed: 47, minis: [], rounds: 4, crowd: 3, events: [{ at: 5, type: "score", a: 12, b: 1 }], comeback: "miss", only: /^comeback/ },
  { tag: "hcm", seed: 48, minis: [], rounds: 4, host: true, crowd: 3, events: [{ at: 5, type: "score", a: 12, b: 1 }], comeback: "make", only: /^comeback/ },
  { tag: "hcx", seed: 49, minis: [], rounds: 4, host: true, crowd: 3, events: [{ at: 5, type: "score", a: 1, b: 12 }], comeback: "quiet", only: /^comeback/ },
];

/* load(n): a fresh copy of the night module for night n (the engine and the bank keep things between games) */
export async function dumpTwo(load) {
  const got = {};
  let n = 0;
  for (const { tag, only, ...o } of NIGHTS) {
    const night = await load(n++);
    await night({ ...o, check: (pub, now, _v, secret) => {
      if (only && !only.test(pub.screen)) return null;
      let k = `${tag}.${pub.screen}${pub.mini ? "." + pub.mini.key : ""}${pub.intro ? ".intro" : ""}${pub.paused || pub.deadline === null && pub.left ? ".paused" : ""}`;
      /* the Roulette spin: before it turns, while it turns, after it stops, for each of the three spins */
      /* Secret Stakes' bets: before any is in, and once one team's is (its phone shows its own bet) */
      if (pub.screen === "stakesPick" && pub.stakes) k += pub.stakes.locked.some(Boolean) ? ".one" : ".none";
      /* What Do You See? (the buzzer): a team has buzzed (the picture stopped, its 10 seconds running); a team is out */
      if (pub.screen === "seeQ" && pub.buzz != null) k = k.replace(".paused", "") + ".buzz";
      else if (pub.screen === "seeQ" && pub.out?.some(Boolean)) k += ".out";
      /* ...and its reveal both ways: a team got it, nobody did */
      if (pub.screen === "seeReveal" && pub.see?.rev) k += pub.see.rev.who != null ? ".won" : ".none";
      /* The Comeback's reveal and result both ways: right or wrong, made it or missed it */
      if (pub.screen === "comebackReveal" && pub.comeback) k += pub.comeback.out.some(Boolean) ? ".wrong" : ".right";
      if (pub.screen === "comebackSummary" && pub.comeback) k += pub.comeback.made?.some(Boolean) ? ".made" : ".missed";
      if (pub.screen === "rouletteQ" && pub.roulette?.spinAt) { const d = now - pub.roulette.spinAt; k += d < 1800 ? ".hold" : d < 4400 ? ".turn" : ".after"; k += ".lap" + pub.roulette.lap; }
      const rec = { pub: JSON.parse(JSON.stringify(pub)), secret: secret ? JSON.parse(JSON.stringify(secret)) : null, now };
      if (!got[k + ".a"]) got[k + ".a"] = rec; else got[k + ".z"] = rec;
      return null;
    } });
  }
  /* Fool Me Twice tied at the end (16 Nov): the nights rarely end it tied, so its tie screen is the night's own tie screen
     (the same screen every game shares) with Fool Me Twice's name and points; no host and with a host */
  for (const tag of ["nh", "h"]) { const src = got[`${tag}.sayTie.saysame.a`]; if (!src) continue;
    const rec = JSON.parse(JSON.stringify(src)), w = rec.pub.mini.wins[0];
    rec.pub.screen = "foolTie"; rec.pub.mini = { ...rec.pub.mini, key: "fool", title: "Fool Me Twice", wins: [w + 6, w + 6] };
    got[`${tag}f.foolTie.fool.a`] = rec; }
  /* moments the nights pass too quickly to catch (21 Nov, the before-and-after pictures): Russian Roulette once the
     barrel has stopped (the host's clock; with no TV, the other team has answered), Secret Stakes' question once the
     other team has answered, and a night that ends tied. The phones are Lions': the other team is Owls */
  const copy = (k) => (got[k] ? JSON.parse(JSON.stringify(got[k])) : null);
  for (const tag of ["nh", "h"]) {
    for (const lap of [1, 2, 3]) {   // (each spin: one of them has a team on the bullet)
      const rr = copy(`${tag}.rouletteQ.roulette.hold.lap${lap}.a`);
      if (rr) { rr.now = rr.pub.roulette.spinAt + 9000; rr.pub.deadline = rr.now + 25000; rr.pub.left = null; rr.pub.timeUp = false;
        rr.pub.sent = [false, true]; got[`${tag}.rouletteQ.roulette.extra.stopped${lap === 1 ? "" : lap}.a`] = rr; } }
    /* (Russian Roulette's reveal, the worst case for a row: a long theme beside the bullet's tag, 22 Nov: "O…" was all
       of Owls) */
    const rv = copy(`${tag}.rouletteReveal.roulette.z`);
    if (rv?.pub.roulette?.rev && rv.pub.roulette.draw?.[1]) { rv.pub.roulette.draw[1].theme = "Mythology & Folklore"; rv.pub.roulette.draw[1].level = "bullet"; rv.pub.roulette.rev.level[1] = "bullet";
      got[`${tag}.rouletteReveal.roulette.extra.bullet.a`] = rv; }
    const sq = copy(`${tag}.stakesQ.stakes.z`) || copy(`${tag}.stakesQ.stakes.a`);
    if (sq) { sq.pub.sent = [false, true]; got[`${tag}.stakesQ.stakes.extra.other.a`] = sq; }
    /* (26 Nov, the wording pictures: a game still tied after its tie-break, the host's three buttons, "A point each" in
       the middle; and the Battle called tied) */
    const st = copy(`${tag}.flagSummary.flag.a`);
    if (st?.pub.summary) { st.pub.summary = { ...st.pub.summary, wins: [3, 3], winner: null, needsHost: true, award: [0, 0], note: "" }; st.pub.mini = { ...st.pub.mini, wins: [3, 3] };
      got[`${tag}.flagSummary.flag.extra.still.a`] = st; }
    const bt = copy(`${tag}.battleSummary.battle.a`);
    if (bt?.pub.battle) { const h = Math.floor((bt.pub.mini?.pts ?? 2) / 2); bt.pub.battle = { ...bt.pub.battle, winner: null, award: [h, h], note: `Tied: called there, ${h} point${h === 1 ? "" : "s"} each.`, score: [bt.pub.battle.score?.[0] ?? 5, bt.pub.battle.score?.[0] ?? 5] };
      got[`${tag}.battleSummary.battle.extra.tied.a`] = bt; }
    const fin = copy(`${tag}.final.a`);
    if (fin) { const sc = Math.max(...fin.pub.teams.map((t) => t.score)); fin.pub.teams.forEach((t) => { t.score = sc; }); fin.pub.winner = null;
      got[`${tag}.final.extra.tied.a`] = fin; }
  }
  return got;
}
