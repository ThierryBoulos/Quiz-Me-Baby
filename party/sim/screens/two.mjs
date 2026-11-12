/* The screen check's two-team nights: every screen they reach, the first and the last of each (screen, game).
   No host, with a host, and a long night of Roulette, Majority Rules and the Battle. `night` is sim/night.jsx's. */
const ALL = ["flag", "closest", "auction", "battle", "dish", "saysame", "map", "pin", "airport", "majority", "roulette", "see", "stakes"];
const NIGHTS = [
  { tag: "nh", seed: 41, minis: ALL, rounds: 4, crowd: 5, tieMore: 1 },
  { tag: "h", seed: 42, minis: ALL, rounds: 4, host: true, crowd: 5, tieMore: 1 },
  { tag: "nh2", seed: 43, minis: ["roulette", "majority", "battle"], rounds: 14, crowd: 3 },
];

/* load(n): a fresh copy of the night module for night n (the engine and the bank keep things between games) */
export async function dumpTwo(load) {
  const got = {};
  let n = 0;
  for (const { tag, ...o } of NIGHTS) {
    const night = await load(n++);
    await night({ ...o, check: (pub, now, _v, secret) => {
      let k = `${tag}.${pub.screen}${pub.mini ? "." + pub.mini.key : ""}${pub.intro ? ".intro" : ""}${pub.paused || pub.deadline === null && pub.left ? ".paused" : ""}`;
      /* the Roulette spin: before it turns, while it turns, after it stops, for each of the three spins */
      /* Secret Stakes' bets: before any is in, and once one team's is (its phone shows its own bet) */
      if (pub.screen === "stakesPick" && pub.stakes) k += pub.stakes.locked.some(Boolean) ? ".one" : ".none";
      if (pub.screen === "rouletteQ" && pub.roulette?.spinAt) { const d = now - pub.roulette.spinAt; k += d < 1800 ? ".hold" : d < 4400 ? ".turn" : ".after"; k += ".lap" + pub.roulette.lap; }
      const rec = { pub: JSON.parse(JSON.stringify(pub)), secret: secret ? JSON.parse(JSON.stringify(secret)) : null, now };
      if (!got[k + ".a"]) got[k + ".a"] = rec; else got[k + ".z"] = rec;
      return null;
    } });
  }
  return got;
}
