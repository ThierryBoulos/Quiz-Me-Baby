/* Bots in a real room (11 Nov, the owner): they join the room the way phones do and send the same taps a phone
   sends, so the owner can be the TV, the host or a captain and play a whole night with a full room.
     npm run bots -- ABCD                  a bot captain (and a bot player) on every team that has no captain
     npm run bots -- ABCD --host           ...and a bot host: it starts the night, taps Next, makes the calls
     npm run bots -- ABCD --teams 8        3 to 8 teams (they need a host: you, or --host, which sets the number)
     npm run bots -- ABCD --players 2      players per team (Majority Rules has everyone answer)
     npm run bots -- ABCD --delay 3        seconds before each answer (3 by default, the owner's pick)
     npm run bots -- ABCD --rounds 4 --minis flag,roulette   what a bot starter starts (all games by default)
   The bots take only the seats nobody has: join first if you want to be a captain. A bot that holds the seat that
   starts the night (the host; with no host, Team A's captain) starts it once every team has a captain. They play to
   the final screen and stay; stop them (Ctrl+C) and they leave the room. The live site: the owner's yes, for a few
   games at a time (11 Nov). Each bot is an anonymous guest, as at a party; the nightly clean-up removes them.
   What each game needs is the simulator's bots' (sim/night.jsx), sent only from the seats bots hold. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), party = join(here, "../..");
/* the project's public address and publishable key, as the phones have them (lib/supabase.ts): not a second copy */
const src = readFileSync(join(party, "lib/supabase.ts"), "utf8");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || src.match(/"(https:\/\/[a-z0-9]+\.supabase\.co)"/)?.[1];
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || src.match(/"(sb_publishable_[A-Za-z0-9_-]+)"/)?.[1];

/* the command line */
const argv = process.argv.slice(2), flag = (n) => argv.includes("--" + n), opt = (n, d) => { const i = argv.indexOf("--" + n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const CODE = (argv.find((a) => /^[A-Za-z0-9]{4}$/.test(a)) || "").toUpperCase();
if (!CODE || !URL || !KEY) { console.error("Usage: npm run bots -- ABCD [--host] [--teams 2-8] [--players 1] [--delay 3] [--rounds 4] [--minis a,b]"); process.exit(2); }
const WANT_HOST = flag("host"), WANT_TEAMS = Number(opt("teams", 0)) || 0, PLAYERS = Math.max(0, Number(opt("players", 1))), DELAY = Math.max(0.5, Number(opt("delay", 3))) * 1000;
const ROUNDS = Number(opt("rounds", 4)), MINIS = opt("minis", "");
const TWO_MINIS = ["flag", "closest", "auction", "battle", "dish", "saysame", "map", "pin", "airport", "majority", "roulette"];
const MANY_MINIS = ["quiz", "majority", "flag", "airport", "map", "closest", "pin", "say", "dish", "roulette"];
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a.map((x) => (typeof x === "string" ? x.replace(/[\u2066-\u2069]/g, "") : x)));

/* the bank (answers for some questions, and wrong answers that look like answers) */
const bank = JSON.parse(readFileSync(join(party, "data/bank.json"), "utf8")).bank || [];
const byText = new Map(bank.filter((q) => q.question).map((q) => [String(q.question).trim(), q]));
/* (What Do You See?: the picture's file name finds it; a bot with no host to peek at needs it to be right now and then) */
const byPhoto = new Map(bank.filter((q) => q.type === "see" && q.photo).map((q) => [q.photo, q]));
const pool = (type) => [...new Set(bank.filter((q) => q.type === type && q.answer).map((q) => String(q.answer)))];
const POOLS = { flag: pool("flag"), map: pool("map"), airport: pool("airport"), dish: pool("dish"), standard: pool("standard").filter((a) => a.length < 24) };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
/* a guess: the right answer now and then (when it's known), otherwise something that looks like an answer */
const guess = (right, kind = "standard") => (right && chance(0.45) ? String(right) : pick(POOLS[kind]?.length ? POOLS[kind] : POOLS.standard) || "Paris");
const rightFor = (pub, secret, t) => secret?.answers?.[t] || secret?.answer || byText.get(String(pub?.question || "").trim())?.answer || byPhoto.get(pub?.see?.photo)?.answer || null;

const NAMES = ["Rami", "Lea", "Karim", "Maya", "Joe", "Nour", "Sami", "Rita", "Hadi", "Yara", "Omar", "Dana", "Fadi", "Lina", "Tarek", "Zeina", "Ziad", "Mira",
  "Elie", "Hala", "Jad", "Nadia", "Rayan", "Sara", "Walid", "Tala", "Adam", "Carla", "Marc", "Dima", "Paul", "Jana", "Ali", "Rana"];
/* (14 letters at most, as on a phone; long ones too, so the screens get tested with them) */
const TEAM_NAMES = ["Lions", "Quizzical Owls", "Brainy Bunch", "Smarty Pants", "Gros Malins", "Quiz Khalifa", "Agatha Quiztie", "Team Spirit"];

/* ---------- a bot: its own sign-in, its seat, its taps ---------- */
const bots = [];
async function newBot(name) {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: true } });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error("sign-in: " + error.message);
  const b = { c, id: data.user.id, name, team: null, role: "player", ch: null };
  b.rpc = async (fn, args) => { const r = await c.rpc(fn, args); if (r.error) throw new Error(fn + ": " + r.error.message); return r.data; };
  b.send = async (kind, payload = {}) => {
    const r = await c.from("actions").insert({ room: CODE, kind, payload: { ...payload, tap: Math.random().toString(36).slice(2, 10) } });
    if (r.error) log(`${b.name}: ${kind} not sent (${r.error.message})`);
  };
  return b;
}
async function seat(name, team, want) {
  /* the first bot in waits without a team (it's the one that looks at the room): it takes the first seat going */
  const spare = bots.find((b) => b.team == null && b.role === "player" && want !== "host" && team != null);
  if (spare) {
    await spare.rpc("qmb_update_me", { r: CODE, nm: spare.name, tm: team }); spare.team = team;
    if (want !== "player") { await spare.rpc("qmb_claim", { r: CODE, want }); spare.role = want; }
    log(`${spare.name} took team ${"ABCDEFGH"[team]} as ${want}`);
    return spare;
  }
  for (let i = 0; i < 6; i++) {
    const b = await newBot(name);
    const res = await b.rpc("qmb_join", { r: CODE, nm: name, face: null });
    if (res?.error === "name_taken") { name = pick(NAMES) + " " + (2 + Math.floor(Math.random() * 8)); continue; }
    if (res?.error) throw new Error(`join: ${res.error}`);
    b.name = name;
    if (team != null) { await b.rpc("qmb_update_me", { r: CODE, nm: name, tm: team }); b.team = team; }
    if (want !== "player" && (team != null || want === "host")) { await b.rpc("qmb_claim", { r: CODE, want }); b.role = want; }
    /* here: on the room's live channel, as a phone on screen is (the TV sees who's present there) */
    try {
      const { data } = await b.c.auth.getSession();
      if (data.session) b.c.realtime.setAuth(data.session.access_token);
      b.ch = b.c.channel("here:" + CODE, { config: { presence: { key: b.id } } });
      b.ch.subscribe((s) => { if (s === "SUBSCRIBED") void b.ch.track({ on: 1 }).catch(() => {}); });
    } catch { /* the log below still says hello */ }
    await b.c.from("actions").insert({ room: CODE, kind: "count", payload: { hello: 1 } });
    bots.push(b);
    log(`${name} joined${team != null ? " team " + "ABCDEFGH"[team] : ""} as ${team == null && want !== "host" ? "a waiting player" : want}`);
    return b;
  }
  throw new Error("no free name");
}
async function leaveAll() {
  await Promise.all(bots.map(async (b) => { try { await b.c.from("members").delete().eq("room", CODE).eq("user_id", b.id); if (b.ch) await b.c.removeChannel(b.ch); } catch { /* gone */ } }));
  log(`${bots.length} bots left the room`);
}
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await leaveAll(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

/* ---------- what the room shows (one reader for every bot) ---------- */
let room = null, members = [], secret = null;
const read = async () => {
  const eyes = bots[0];
  if (!eyes) return;
  const [r, m] = await Promise.all([eyes.c.from("rooms").select("code,status,mode,state").eq("code", CODE).maybeSingle(), eyes.c.from("members").select("*").eq("room", CODE)]);
  if (r.data) room = r.data;
  if (m.data) members = m.data;
  const host = bots.find((b) => b.role === "host");
  if (host) { const s = await host.c.from("secrets").select("data").eq("room", CODE).maybeSingle(); secret = s.data?.data || null; }
};
const mine = (id) => bots.find((b) => b.id === id);
const capOf = (t) => members.find((m) => m.team === t && m.role === "captain");
const botCap = (t) => { const m = capOf(t); return m ? mine(m.user_id) : null; };
const hostM = () => members.find((m) => m.role === "host");
const botHost = () => { const h = hostM(); return h ? mine(h.user_id) : null; };

/* each tap once per moment, after the delay (again after 8 s if the moment hasn't moved: a refused tap) */
const done = new Map();
function once(key, ms, fn, retry = true) {
  const now = Date.now(), d = done.get(key);
  if (d && (!retry || d.at > now || now - d.at < 8000)) return;
  done.set(key, { at: now + ms });
  setTimeout(() => { if (!stopping) void fn(); }, ms * (0.85 + Math.random() * 0.3));
}

/* ---------- the lobby: fill the empty seats, name the teams, start ---------- */
let filling = false, startedAt = 0, teamsAsked = false;
async function lobby() {
  if (filling) return; filling = true;
  try {
    const many = WANT_TEAMS > 2 || Number(room.state?.teamCount) > 2;
    if (WANT_HOST && !hostM()) await seat(pick(NAMES), null, "host");
    const k = Math.max(2, Math.min(8, Number(room.state?.teamCount) || 2));
    /* the bot host sets the number of teams (only a host can) */
    if (WANT_TEAMS && WANT_TEAMS !== k && botHost() && !teamsAsked) { teamsAsked = true; await botHost().send("setup", { teams: WANT_TEAMS }); return; }
    if (WANT_TEAMS && WANT_TEAMS !== k && hostM() && !botHost() && !lobby.hint) { lobby.hint = true; log(`set ${WANT_TEAMS} teams on the host's phone: the bots fill every team there is`); }
    const used = new Set(members.map((m) => m.name));
    const free = () => { let n; do n = pick(NAMES); while (used.has(n)); used.add(n); return n; };
    for (let t = 0; t < k; t++) {
      if (!capOf(t)) { const b = await seat(free(), t, "captain"); b.named = 1; b.namedAt = Date.now(); await b.send("team_name", { team: t, name: TEAM_NAMES[t] }); await read(); }
      const have = bots.filter((b) => b.team === t && b.role === "player").length;
      for (let i = have; i < PLAYERS; i++) await seat(free(), t, "player");
    }
    await read();
    /* a team name the TV didn't take (sent the moment the armband came): again, a few times */
    const names = room.state?.teamNames || [];
    for (const b of bots) if (b.role === "captain" && b.team != null && names[b.team] !== TEAM_NAMES[b.team] && (b.named || 0) < 4 && Date.now() - (b.namedAt || 0) > 5000) {
      b.named = (b.named || 0) + 1; b.namedAt = Date.now(); await b.send("team_name", { team: b.team, name: TEAM_NAMES[b.team] });
    }
    /* start: only from the seat that starts the night (the host; with no host, Team A's captain), once it's ready */
    const starter = hostM() || capOf(0), ready = [...Array(k).keys()].every((t) => capOf(t)) && (!many || hostM());
    lobby.readyAt = ready ? lobby.readyAt || Date.now() : 0;
    if (starter && mine(starter.user_id) && ready && Date.now() - lobby.readyAt > 4000 && Date.now() - startedAt > 15000) {
      startedAt = Date.now();
      const minis = MINIS ? MINIS.split(",") : many ? MANY_MINIS : TWO_MINIS;
      /* a theme for each round, as the host's Setup sends (the broad ones everyone knows) */
      const themes = ["General Knowledge", "Movies", "Music", "Geography", "History", "Science", "Sports", "Food & Drink", "TV Series", "Nature", "Celebrities", "Art & Books", "Tech & Business", "Quotes"]
        .sort(() => Math.random() - 0.5).slice(0, Math.max(1, ROUNDS));
      const cfg = many ? { minis: minis.includes("quiz") || !MINIS ? [...new Set(["quiz", ...minis])] : minis, rounds: ROUNDS, themes }
        : { standard: ROUNDS > 0, rounds: Math.max(1, ROUNDS), difficulty: "easy+medium+hard", themes, minis };
      log(`starting: ${k} teams, ${ROUNDS} rounds, ${cfg.minis.join(", ")}`);
      await mine(starter.user_id).send("setup", { start: true, cfg });
    } else if (ready && starter && !mine(starter.user_id) && !lobby.told) { lobby.told = true; log(`every team has a captain: ${starter.name} starts the night`); }
  } finally { filling = false; }
}

/* ---------- two teams: the simulator's bots' moves (sim/night.jsx), from the seats bots hold ---------- */
const NEXT = { roundIntro: "round/begin", miniIntro: "closest/start", flagIntro: "flag/start", dishIntro: "dish/start", mapIntro: "map/start", auctionIntro: "auction/begin",
  sayIntro: "say/start", battleIntro: "battle/start", battleHandoff: "battle/start", sayReveal: "ui/next", mapReveal: "ui/next", saySummary: "say/done", battleSummary: "battle/done",
  answer: "round/afterAnswer", roundScore: "round/next", closestReveal: "ui/next", flagReveal: "ui/next", dishReveal: "dish/next", auctionLeg: "auction/nextLeg",
  auctionResult: "auction/done", miniSummary: "closest/done", flagSummary: "flag/done", dishSummary: "dish/done", mapSummary: "map/done", battleReview: "battle/reviewDone",
  pinIntro: "pin/start", airportIntro: "airport/start", pinReveal: "ui/next", airportReveal: "ui/next", pinSummary: "pin/done", airportSummary: "airport/done",
  majorityIntro: "majority/start", majorityReveal: "ui/next", majoritySummary: "majority/done",
  rouletteIntro: "roulette/start", rouletteReveal: "ui/next", rouletteSummary: "roulette/done",
  stakesIntro: "stakes/start", stakesReveal: "ui/next", stakesSummary: "stakes/done",
  seeIntro: "see/start", seeReveal: "ui/next", seeSummary: "see/done" };
const LEVELS = ["easy", "medium", "hard", "expert"];
/* reveals and results get a longer look before Next: whoever watches the TV has time to read them */
const look = (sc) => (/Reveal|Summary|Result|roundScore|answer|Review|Leg$|decided|Tie$/.test(sc) ? DELAY * 2 : DELAY);
const pinGuess = () => ({ lat: Math.random() * 120 - 50, lon: Math.random() * 300 - 150 });

function two(pub) {
  const sc = pub.screen, step = pub.step, lead = pub.lead ?? 0, k = `${sc}|${step}|${pub.qid || ""}`;
  const H = hostM(), BH = botHost();
  /* who moves the night on: the host (if it's a bot); with no host, the lead captain (if it's a bot) */
  const mover = (t, type) => (H ? (["auction/raise", "auction/pass"].includes(type) ? botCap(t) : BH) : botCap(t));
  const go = (t, type, extra = {}, ms = look(sc)) => { const w = mover(t, type); if (w) once(`${k}|go|${type}|${pub.auction?.count ?? ""}`, ms, () => w.send(w.role === "host" ? "judge" : "next", { move: { type, ...extra }, step })); };
  const answer = (t, payload) => { const b = botCap(t); if (b && !pub.sent?.[t]) once(`${k}|ans|${t}`, DELAY, () => b.send("answer", payload)); };
  if (sc === "final") { if (!two.over) { two.over = true; log(`final: ${pub.teams.map((x) => x.name + " " + x.score).join(", ")}. The bots stay; Ctrl+C takes them out.`); } return; }
  two.over = false;
  if (pub.paused) return;
  if (pub.intro) return go(lead, "ui/introGo", {}, DELAY * 2);
  if (pub.agree && !H) { const b = botCap(1 - pub.agree.team); if (b) once(`${k}|agree`, DELAY, () => b.send("next", { move: { type: "ui/agree", v: true, id: pub.agree.id }, step })); return; }
  if (pub.contest) { const v = chance(0.5), w = H ? BH : botCap(1 - pub.contest.by); if (w) once(`${k}|contest`, DELAY, () => w.send(w.role === "host" ? "judge" : "next", { move: { type: "ui/contestOk", v }, step })); return; }
  if (pub.lifeline) { const t = pub.turn ?? 0; return pub.lifeline.wait ? go(t, "ui/startCall", {}, DELAY) : go(t, "ui/closeLifeline", {}, DELAY * 3); }
  if (sc === "roundIntro" && chance(0.02)) { const b = botCap(chance(0.5) ? 0 : 1); if (b) once(`${k}|dbl`, DELAY, () => b.send("lifeline", { key: "dbl" })); }
  if (sc === "decided") return go(lead, chance(0.3) ? "decided/more" : "decided/stop");
  if (sc === "majorityQ") {
    if (BH && pub.timeUp) go(0, "ui/reveal", {}, 1000);
    for (const b of bots) if (b.team != null && b.team < 2) once(`${k}|vote|${b.id}`, DELAY * (0.5 + Math.random()), () => b.send("answer", { pick: chance(0.5) && secret?.answer ? secret.answer : pick(pub.majority?.options || ["x"]), k: `${pub.qid}|majorityQ` }), false);
    return;
  }
  if (NEXT[sc]) return go(lead, NEXT[sc]);
  if (/Tie$|Level$/.test(sc) && sc !== "battleTie") return go(lead, "tie/stop");
  const right = (t) => rightFor(pub, secret, t);
  if (sc === "ask" || sc === "steal") {
    const t = pub.turn ?? 0;
    if (!pub.sent?.[t] && !pub.timeUp) return answer(t, { texts: [guess(right(t))] });
    /* (nothing typed by time-up: wrong) */
    if (BH) go(0, sc === "ask" ? "round/judge" : "round/judgeSteal", { v: pub.sent?.[t] ? secret?.match?.[t] ?? chance(0.5) : false }, DELAY);
    return;
  }
  if (sc === "miniQ") { for (const t of [0, 1]) answer(t, { n: String(Math.round((Number(right(t)) || 100) * (0.5 + Math.random()))) }); if (BH && pub.timeUp) go(0, "ui/reveal", {}, 1500); return; }
  /* Secret Stakes: each bot captain bets (a theme, a level), once */
  if (sc === "stakesPick") {
    for (const t of [0, 1]) { const b = botCap(t); if (b && !pub.stakes?.locked?.[t]) once(`${k}|bet|${t}`, DELAY, () => b.send("next", { move: { type: "stakes/pick", k: Math.floor(Math.random() * 3), level: pick(LEVELS) }, step })); }
    return;
  }
  if (["flagQ", "mapQ", "sayQ", "airportQ", "rouletteQ", "stakesQ", "seeQ"].includes(sc)) {
    const kind = { flagQ: "flag", mapQ: "map", airportQ: "airport" }[sc] || "standard";
    /* (tagged as a real phone tags its answer: Russian Roulette's and Secret Stakes' tags were refused before 11 Nov) */
    for (const t of [0, 1]) answer(t, { text: guess(right(t), kind), ...(sc === "rouletteQ" || sc === "stakesQ" || sc === "seeQ" ? { k: `${pub.qid}|${sc}` } : {}) });
    /* the host reveals once both are in, or when the clock has run out (a person's captain who didn't answer) */
    if (BH && ((pub.sent?.[0] && pub.sent?.[1]) || pub.timeUp)) go(0, "ui/reveal", {}, DELAY);
    return;
  }
  if (sc === "pinQ") { for (const t of [0, 1]) answer(t, { pin: pinGuess() }); if (BH && pub.timeUp) go(0, "ui/reveal", {}, 1500); return; }
  if (sc === "dishQ") {
    if (pub.buzz == null) { const t = [0, 1].filter((x) => !pub.out?.[x])[Math.floor(Math.random() * 2)] ?? 0; const b = botCap(t); if (b && !pub.out?.[t]) once(`${k}|buzz`, DELAY * 2, () => b.send("buzz", {})); }
    else if (!pub.sent?.[pub.buzz]) answer(pub.buzz, { text: guess(right(pub.buzz), "dish") });
    else if (BH) go(0, secret?.match?.[pub.buzz] ?? chance(0.5) ? "dish/right" : "dish/wrong", {}, DELAY);
    return;
  }
  if (sc === "auctionBid") { const a = pub.auction; return go(a.turn, a.bid === 0 ? "auction/raise" : "auction/pass", a.bid === 0 ? { n: 2 + Math.floor(Math.random() * 4) } : {}, DELAY); }
  if (sc === "auctionRun") { const a = pub.auction; if (a.count < a.bid) go(1 - a.by, "auction/tick", {}, 1500); else if (BH) go(0, "auction/resolve", {}, DELAY); return; }
  if (sc === "battleQ") { if (H) { if (BH) go(0, "battle/mark", { got: chance(0.5) }, DELAY); } else answer(pub.battle.cap, { text: guess(right(pub.battle.cap)) }); return; }
  if (sc === "sudden" || sc === "battleTie") {
    if (sc === "sudden" && !pub.sudden?.ready) return go(lead, "sudden/go", {}, DELAY);
    if (BH && pub.buzz != null) return go(0, chance(0.5) ? "ui/sdRight" : "ui/sdWrong", {}, DELAY);
    for (const t of [0, 1]) if (!pub.out?.[t]) answer(t, { text: guess(right(t)) });
  }
}

/* ---------- 3 to 8 teams: the host runs it, captains answer, everyone plays Majority Rules ---------- */
function many(pub) {
  const sc = pub.screen, step = pub.step, k = `m|${sc}|${step}|${pub.qid || ""}`, key = pub.game?.key, BH = botHost();
  const judge = (type, extra = {}, ms = DELAY) => { if (BH) once(`${k}|${type}`, ms, () => BH.send("judge", { move: { type, ...extra }, step })); };
  if (sc === "final") { if (!many.over) { many.over = true; log(`final: ${pub.teams.map((x) => x.name + " " + x.score).join(", ")}. The bots stay; Ctrl+C takes them out.`); } return; }
  many.over = false;
  if (pub.paused) return;
  if (pub.intro) return judge("m/go", {}, DELAY * 2);
  if (pub.contest && BH) return judge("m/contestOk", { v: chance(0.5) });
  if (sc === "intro") return judge("m/start");
  if (sc === "reveal" || sc === "summary") return judge("m/next", {}, DELAY * 2);
  /* Secret Stakes: every bot captain bets (the TV takes the safe bet for anyone who doesn't, at time-up) */
  if (sc === "pick") {
    for (const b of bots) if (b.role === "captain" && b.team != null && !pub.stakes?.locked?.[b.team]) once(`${k}|bet|${b.team}`, DELAY, () => b.send("next", { move: { type: "m/bet", k: Math.floor(Math.random() * 3), level: pick(LEVELS) } }));
    return;
  }
  if (sc !== "q") return;
  const only = pub.game?.only;
  for (const b of bots) {
    if (b.team == null) continue;
    const t = b.team, qk = `${pub.qid}|q`;
    if (key === "majority") { if (b.role !== "host") once(`${k}|v|${b.id}`, DELAY * (0.5 + Math.random()), () => b.send("answer", { pick: chance(0.5) && secret?.answer ? secret.answer : pick(pub.options || ["x"]), k: qk }), false); continue; }
    if (b.role !== "captain" || pub.sent?.[t] || pub.out?.[t] || (only && !only.includes(t))) continue;
    const right = rightFor(pub, secret, t);
    const payload = key === "closest" ? { n: String(Math.round((Number(right) || 100) * (0.5 + Math.random()))) }
      : key === "pin" ? { pin: pinGuess() } : { text: guess(right, { flag: "flag", map: "map", airport: "airport", dish: "dish" }[key] || "standard") };
    once(`${k}|a|${t}`, key === "dish" ? DELAY * 2 : DELAY, () => b.send("answer", { ...payload, k: qk }));
  }
  /* the clock's run out: the host reveals (the TV does it once everyone's in) */
  if (pub.deadline && Date.now() > pub.deadline + 1500) judge("m/reveal", {}, 500);
}

/* ---------- the loop ---------- */
const loop = { last: "" };
log(`bots for room ${CODE}: ${WANT_HOST ? "a host, " : ""}a captain on every team without one, ${PLAYERS} player${PLAYERS === 1 ? "" : "s"} each, answers in about ${DELAY / 1000} s`);
{ const probe = await newBot("probe"), st = await probe.rpc("qmb_room_state", { r: CODE });
  if (st === "gone" || st === "done") { console.error(`Room ${CODE}: ${st === "done" ? "that game is over" : "there's no such room"}.`); process.exit(2); }
  /* the first bot in looks at the room for all of them: the host if one's wanted, else a player waiting for a seat */
  await seat(pick(NAMES), null, WANT_HOST ? "host" : "player"); }
await read();
for (;;) {
  try {
    await read();
    if (room.status === "done") { log("the room was closed"); await stop(); }
    else if (room.status === "lobby") await lobby();
    else if (room.state?.pub) {
      const p = room.state.pub, line = `${p.screen}${p.intro ? " (intro)" : ""}  ${(p.teams || []).map((x) => x.score).join("-")}`;
      if (line !== loop.last) { loop.last = line; log("  " + line); }
      (room.mode === "many" || p.many ? many : two)(p);
    }
  } catch (e) { log("(" + (e instanceof Error ? e.message : String(e)) + ")"); }
  await new Promise((r) => setTimeout(r, 700));
}
