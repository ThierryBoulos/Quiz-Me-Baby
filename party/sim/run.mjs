/* Plays a set of whole nights in the simulator (sim/night.jsx) and checks each
   one's trace against the one saved in sim/golden. Every night must reach the
   final screen; with the same seed, the same screens must come in the same order
   with the same scores.
     node sim/run.mjs            check every night
     node sim/run.mjs --update   save the traces as the new golden ones (after a change meant to alter play)
     node sim/run.mjs 3          only night 3 (prints its trace) */
import { bundleNight } from "./bundle.mjs";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, ".out/night.mjs");
await bundleNight(out);
/* each night gets fresh modules (the engine and the bank keep things between games, as on a real TV) */
const load = async (n) => (await import(pathToFileURL(out).href + "?night=" + n)).night;

const DEFAULT = ["flag", "closest", "auction", "battle"];
const NIGHTS = [
  { seed: 1, minis: DEFAULT },
  { seed: 2, minis: DEFAULT, again: true },
  { seed: 3, minis: ["dish", "saysame", "map"] },
  { seed: 4, minis: ["flag", "closest", "dish", "auction", "saysame", "map", "battle"], rounds: 4 },
  { seed: 5, minis: [] },
  { seed: 6, minis: DEFAULT, host: true },
  { seed: 7, minis: ["dish", "saysame", "map", "closest"], host: true, rounds: 4 },
  { seed: 8, minis: DEFAULT, rounds: 8 },
  /* slow captains: questions time out, overrule windows close on their own */
  { seed: 9, minis: ["flag", "closest", "dish", "auction", "saysame", "map", "battle"], slow: 0.97 },
  { seed: 10, minis: DEFAULT, host: true, slow: 0.95 },
  /* the TV reloads mid-game, twice over */
  { seed: 11, minis: DEFAULT, reload: 40 },
  { seed: 12, minis: ["dish", "saysame", "map"], host: true, reload: 25 },
  /* the TV's screen sleeps during a question: the answer sent meanwhile counts, a Resume can't start the clock */
  { seed: 13, minis: DEFAULT, sleep: 2 },
  /* 22 Oct: Drop the Pin and Guess the Airport, with and without a host, and with slow captains (pins taken at time-up) */
  { seed: 14, minis: ["pin", "airport", "battle"] },
  { seed: 15, minis: ["closest", "pin", "airport"], host: true, rounds: 4 },
  { seed: 16, minis: ["pin", "airport"], slow: 0.97 },
  /* 23 Oct: Majority Rules: everyone answers; with no host one player never turns up (their captain asks, the other agrees) */
  { seed: 17, minis: ["majority", "battle"], crowd: 5, absent: "Joe" },
  { seed: 18, minis: ["closest", "majority"], host: true, rounds: 4, crowd: 3, absent: "Karim" },
  { seed: 19, minis: ["majority"], crowd: 2, slow: 0.9 },
  /* 29 Oct: the "something went wrong" paths: Pause and Resume, the scores set by hand, a question swapped,
     the host's and a captain's phone gone (and back), "one more" at a tie */
  { seed: 20, minis: DEFAULT, host: true, events: [{ at: 20, type: "pause", for: 15 }, { at: 70, type: "score", a: 5, b: 1 }, { at: 110, type: "swap" }, { at: 150, type: "pause", for: 10 }], tieMore: 1 },
  { seed: 21, minis: DEFAULT, events: [{ at: 25, type: "pause", for: 12 }, { at: 60, type: "score", a: 4, b: 4 }, { at: 100, type: "swap" }, { at: 140, type: "swap" }], tieMore: 1 },
  { seed: 22, minis: ["dish", "saysame", "map", "closest"], host: true, rounds: 4, events: [{ at: 40, type: "hostGone", for: 90 }, { at: 150, type: "capGone", team: 1 }, { at: 200, type: "swap" }] },
  { seed: 23, minis: ["flag", "closest", "pin", "battle"], events: [{ at: 30, type: "capGone", team: 0 }, { at: 90, type: "score", a: 2, b: 3 }, { at: 120, type: "pause", for: 8 }, { at: 160, type: "swap" }], tieMore: 2 },
  /* 7 Nov: sudden death and the Battle's tie-breaker with no buzzer: both captains type, the first right answer wins
     (no host, with a host, both answers in the same instant; a Battle that ends tied) */
  { seed: 24, minis: [], rounds: 4, events: [{ at: 0, type: "levelEnd" }] },
  { seed: 25, minis: [], rounds: 4, host: true, events: [{ at: 0, type: "levelEnd" }] },
  { seed: 26, minis: [], rounds: 4, simul: true, events: [{ at: 0, type: "levelEnd" }] },
  { seed: 27, minis: ["battle"], rounds: 4, battleLevel: true, tieMore: 1 },
  { seed: 28, minis: ["battle"], rounds: 4, host: true, battleLevel: true, tieMore: 1 },
  /* 9 Nov: Russian Roulette: no host (the app calls, the captains contest), with a host, and mini-games only with a
     reload in the middle of it */
  { seed: 29, minis: ["roulette", "flag"], rounds: 4, tieMore: 1 },
  { seed: 30, minis: ["roulette", "closest"], rounds: 4, host: true, tieMore: 1 },
  { seed: 31, minis: ["roulette"], rounds: 0, reload: 11 },
  /* 11 Nov: Secret Stakes, the night's last game: after the Battle, no host and with a host; with a reload in the middle
     of it; and slow captains (no bet: the safe one; answers taken at time-up) */
  { seed: 32, minis: ["flag", "battle", "stakes"], rounds: 4 },
  { seed: 33, minis: ["closest", "battle", "stakes"], rounds: 4, host: true },
  { seed: 34, minis: ["stakes"], rounds: 2, reload: 30 },
  { seed: 35, minis: ["stakes", "battle"], rounds: 3, slow: 0.95 },
  { seed: 36, minis: ["stakes"], rounds: 4, host: true, events: [{ at: 49, type: "swap" }] },
  /* 12 Nov: What Do You See?: no host (the app checks each guess as it lands), with a host and a tie asked about, the
     pictures alone with a reload in the middle, slow captains (guesses taken at time-up), a pause and a new picture */
  { seed: 37, minis: ["see", "flag"], rounds: 4 },
  { seed: 38, minis: ["see", "closest"], rounds: 4, host: true, tieMore: 1 },
  { seed: 39, minis: ["see"], rounds: 0, reload: 12 },
  { seed: 40, minis: ["see", "battle"], rounds: 3, slow: 0.95 },
  /* 14 Nov: the night a new room starts with (the owner): six rounds, Flag, Closest, the Auction, What Do You See?,
     Russian Roulette, the Battle; no host and with a host */
  { seed: 50, minis: ["flag", "closest", "auction", "see", "roulette", "battle"] },
  { seed: 51, minis: ["flag", "closest", "auction", "see", "roulette", "battle"], host: true },
  { seed: 41, minis: ["see"], rounds: 2, host: true, events: [{ at: 14, type: "pause", for: 8 }, { at: 30, type: "swap" }] },
  /* 15 Nov: Repeat a theme (the owner): Geography three times, History twice; no host and with a host. Every round
     its theme, never the same question twice, never the same theme back to back */
  { seed: 52, minis: ["flag", "closest"], themes: ["Geography", "Geography", "Geography", "History", "History", "Music"] },
  { seed: 53, minis: ["closest", "battle"], host: true, themes: ["Geography", "Geography", "Geography", "History", "History", "Music"] },
  /* 15 Nov: What Do You See?'s pictures chosen under the game (the owner): with no host the captain leaves a kind out
     too; every picture dealt, spares too, is of a kind left on */
  { seed: 54, minis: ["see"], rounds: 2, seeKinds: ["logo"] },
  { seed: 55, minis: ["see", "closest"], rounds: 2, host: true, seeKinds: ["face", "close"] },
  /* 15 Nov: lifelines off for the night (the owner): none used, no host and with a host */
  { seed: 56, minis: ["flag", "battle"], rounds: 4, lifelines: false },
  { seed: 57, minis: ["closest"], rounds: 4, host: true, lifelines: false },
  /* 16 Nov: Fool Me Twice (the owner): no host and with a host, on a TV and on the game phone with no TV (a reload, Pause
     and Change fact with a host) */
  { seed: 58, minis: ["fool", "flag"], rounds: 4, tieMore: 1 },
  { seed: 59, minis: ["fool", "closest"], rounds: 4, host: true, tieMore: 1 },
  { seed: 60, minis: ["fool"], rounds: 2, phone: true, reload: 14 },
  { seed: 61, minis: ["fool", "battle"], rounds: 2, host: true, phone: true, events: [{ at: 15, type: "pause", for: 8 }, { at: 34, type: "swap" }] },
  /* 17 Nov: The Comeback (the owner): the scores set far apart by hand before the night's middle, so it comes up. No host
     and with a host, on a TV and on the game phone with no TV: made (all three right), missed (a wrong answer; no answer
     in its 15 seconds), a new question asked for, a Pause; the host skips it; switched off in Setup, it never comes up */
  { seed: 62, minis: [], rounds: 4, events: [{ at: 5, type: "score", a: 1, b: 12 }], comeback: "make" },
  { seed: 63, minis: ["flag"], rounds: 4, host: true, events: [{ at: 5, type: "score", a: 12, b: 1 }], comeback: "miss", comebackSwap: true },
  { seed: 64, minis: ["closest", "battle"], rounds: 3, phone: true, events: [{ at: 5, type: "score", a: 10, b: 0 }], comeback: "quiet", comebackSwap: true },
  { seed: 65, minis: [], rounds: 4, host: true, phone: true, events: [{ at: 5, type: "score", a: 2, b: 14 }], comeback: "make" },
  { seed: 66, minis: [], rounds: 4, host: true, events: [{ at: 5, type: "score", a: 12, b: 1 }], comeback: "skip" },
  { seed: 67, minis: [], rounds: 4, events: [{ at: 5, type: "score", a: 12, b: 1 }], comeback: "off" },
];

const args = process.argv.slice(2), update = args.includes("--update"), only = args.filter((a) => /^\d+$/.test(a)).map(Number);
const gold = join(here, "golden");
mkdirSync(gold, { recursive: true });
let bad = 0;
for (const n of NIGHTS) {
  if (only.length && !only.includes(n.seed)) continue;
  const t = performance.now();
  /* a clock never sits past zero with nothing happening (while the TV is on) */
  const check = (p, now, vis) => (vis === "visible" && p.deadline && !p.paused && !p.pending && now - p.deadline > 6000 ? `${p.screen}: the clock is ${Math.round((now - p.deadline) / 1000)} s past zero and nothing happened` : null);
  const r = await (await load(n.seed))({ ...n, check });
  const file = join(gold, `night-${n.seed}.txt`), text = r.trace.join("\n") + "\n";
  const label = `night ${n.seed} (${n.host ? "host" : "no host"}${n.phone ? ", no TV" : ""}, ${n.rounds || 6} rounds, ${n.minis.join(" ") || "no mini-games"})`;
  const ends = r.outcome === "final" || r.outcome === "sudden-cap";
  let verdict;
  const repeat = n.themes && (() => {
    const want = [...n.themes].sort().join(), got = [...r.dealt].sort().join();
    if (want !== got) return `the rounds played ${r.dealt.join(", ")}, not ${n.themes.join(", ")}`;
    const i = r.dealt.findIndex((t, k) => k > 0 && t === r.dealt[k - 1]);
    return i > 0 ? `${r.dealt[i]} twice in a row (${r.dealt.join(", ")})` : null;
  })();
  const offKind = n.seeKinds && (r.kinds.length ? r.kinds.find((x) => !n.seeKinds.includes(x)) : "none dealt");
  const llBad = n.lifelines === false && (!r.noLl || r.llUsed) ? (r.llUsed ? "a lifeline was used" : "the night has its lifelines") : null;
  /* The Comeback: it came up (or, switched off, didn't), went as the night says, and moved the score only when made:
     to 85% of the leader's score, never past the leader */
  const cbBad = n.comeback && (() => {
    const c = r.cb, shown = r.screens.filter((x) => /^comeback/.test(x)).sort().join(" ");
    if (n.comeback === "off") return c || shown ? "it came up, switched off" : null;
    if (!c) return "it never came up";
    if (n.comeback === "skip") return !c.skipped || c.made != null || shown !== "comebackIntro" ? `skipped, but ${shown}` : null;
    if (shown !== "comebackIntro comebackQ comebackReveal comebackSummary") return `its screens: ${shown}`;
    const L = Math.max(...c.before), up = c.after[c.team] - c.before[c.team];
    if (n.comeback === "make") return c.made !== true || c.asked !== 3 || c.after[c.team] !== Math.min(Math.round(0.85 * L), L - 1) || c.after[1 - c.team] !== L ? `made: ${JSON.stringify(c)}` : null;
    return c.made !== false || up !== 0 || c.asked !== (n.comeback === "miss" ? 2 : 1) ? `missed: ${JSON.stringify(c)}` : null;
  })();
  if (cbBad) { verdict = `THE COMEBACK: ${cbBad}`; bad++; }
  else if (llBad) { verdict = `LIFELINES OFF: ${llBad}`; bad++; }
  else if (offKind) { verdict = `PICTURES: a ${offKind} picture, with only ${n.seeKinds.join(" and ")} on`; bad++; }
  else if (repeat) { verdict = `REPEAT A THEME: ${repeat}`; bad++; }
  else if (!ends) { verdict = `NEVER ENDED (${r.outcome}${r.stuckOn ? " on " + r.stuckOn : ""})`; bad++; }
  else if (update || !existsSync(file)) { writeFileSync(file, text); verdict = "saved"; }
  else {
    const want = readFileSync(file, "utf8").split("\n"), got = text.split("\n");
    const i = want.findIndex((l, k) => l !== got[k]);
    if (i === -1 && want.length === got.length) verdict = "same as golden";
    else { verdict = `DIFFERS at line ${i + 1}:\n    golden: ${want[i] ?? "(end)"}\n    now:    ${got[i] ?? "(end)"}`; bad++; }
  }
  console.log(`${label}: ${r.outcome}, ${r.score}, ${r.minutes.toFixed(1)} min played in ${((performance.now() - t) / 1000).toFixed(2)} s, ${r.trace.length} screens, ${r.actions} taps, ${r.writes} writes — ${verdict}`);
  if (only.length) console.log(r.trace.join("\n"), "\nrecap:", JSON.stringify(r.recap));
}
process.exit(bad ? 1 : 0);
