/* Guess the Map is checked by the app, and map answers are loose: "they drive on the left", "kings
   and queens", "no sea". For every map, answers people really give must count, and near misses must
   not (with the same check the TV makes at the reveal: the accepted wordings, then the map's key
   ideas, data/accept.json mapKeys). Usage: node scripts/check-maps.mjs (part of npm test). */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname, out = join(root, "sim/.out/maps.mjs");
await build({ entryPoints: [join(root, "lib/engine.ts")], outfile: out, bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "error",
  plugins: [{ name: "no-supabase", setup(b) { b.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: "x", namespace: "none" })); b.onLoad({ filter: /.*/, namespace: "none" }, () => ({ contents: "export {}" })); } }] });
const { QMB, mapHit } = await import(pathToFileURL(out).href);
const A = JSON.parse(readFileSync(join(root, "data/accept.json"), "utf8"));
const maps = JSON.parse(readFileSync(join(root, "data/bank.json"), "utf8")).bank.filter((q) => q.type === "map");
const ok = (t, q) => QMB.isMatch(t, q.answer, [...(A.byAnswer[q.answer] || []), q.question]) || mapHit(t, A.mapKeys?.[q.answer]);

/* by question id: [answers that count], [answers that don't] */
const CASES = {
  q1e42e6d: [["drive on the left", "they drive on the left side", "left hand driving", "driving side", "which side of the road", "countries that drive left", "left-hand traffic", "steering wheel on the right", "drivers on the left", "UK style driving on the left", "left side of the road"],
    ["former british colonies", "left", "islands", "commonwealth"]],
  q1e426t5: [["corruption", "most corrupt countries", "corruption index", "how corrupt they are", "corupt countries", "transparency international", "bribery", "CPI", "honest governments"],
    ["democracy", "freedom index", "poverty", "happiness"]],
  qk0tlnf: [["women's suffrage", "when women got the vote", "women voting", "year women could vote", "female voting rights", "suffragettes", "women's right to vote", "womens vote", "women elections"],
    ["independence year", "democracy", "gender equality", "year of independence"]],
  qdoluxk: [["vikings", "where the vikings went", "viking raids", "norse expansion", "norsemen", "vikinks", "scandinavian raids", "viking voyages and trade"],
    ["roman empire", "mongols", "trade routes", "crusades"]],
  q69b4gy: [["lights at night", "night lights", "city lights", "the earth at night", "light pollution", "electricity", "satellite photo at night", "where the lights are on", "nightlights", "lights from space"],
    ["population", "cities", "sunlight", "time zones"]],
  qlbguby: [["no mcdonalds", "countries without mcdonald's", "never had a mcdonalds", "no mcdo", "no big mac", "no maccies", "no golden arches", "mcdonalds free countries", "no mc donalds"],
    ["fast food", "no kfc", "burger king", "no starbucks"]],
  q12hja9x: [["monarchies", "countries with a king", "kings and queens", "royal families", "countries with royals", "monarchy", "kingdoms", "has a queen", "emperors", "crown"],
    ["dictatorships", "commonwealth", "former colonies", "republics"]],
  qu7g7n2: [["landlocked", "land locked countries", "no coastline", "no sea", "countries without sea", "no access to the ocean", "no coast", "not on the sea", "landlockd"],
    ["mountains", "deserts", "small countries", "north"]],
  q1twhawd: [["olympic hosts", "countries that hosted the olympics", "olympics host countries", "where the olympics were held", "summer olympics hosts", "olympic games hosts", "olimpic hosts"],
    ["olympic medals", "olympics", "world cup hosts", "most medals"]],
  qm8xxp9: [["world cup winners", "won the world cup", "world cup champions", "fifa winners", "football world champions", "countries that won the fifa world cup", "world cup winning countries"],
    ["world cup hosts", "football", "world cup", "2026 world cup host cities"]],
  q19dq51e: [["one neighbour", "countries with one neighbor", "only one neighbouring country", "border only one country", "single border", "1 neighbour", "countries bordering one other country", "one land border"],
    ["islands", "small countries", "landlocked", "neighbours"]],
  qvmv0uz: [["time zones", "number of time zones", "timezones", "how many time zones", "time zone count", "utc offsets"],
    ["population", "size", "hours of sunlight", "zones"]],
  q1rdvcj7: [["olympic medals", "medal count", "most olympic medals", "olympic gold medals", "summer olympic medal table", "medals won", "olympic success"],
    ["olympic hosts", "where the olympics were held", "sports", "olympics hosts"]],
  qlblf37: [["nuclear weapons", "nuclear powers", "countries with nukes", "atomic bombs", "nuclear", "atomic weapons", "nuclear armed countries"],
    ["nuclear energy plants", "military", "superpowers", "army"]],
  q1e428jq: [["G20", "G7", "the g20 countries", "g-20", "G 7 and G 20", "group of 20", "biggest economies", "richest countries", "largest economies"],
    ["NATO", "UN security council", "EU", "BRICS"]],
  qk0gn94: [["euro", "the euro", "eurozone", "countries that use the euro", "euro zone", "euros", "single currency", "european currency", "common currency"],
    ["european union", "europe", "EU members", "schengen"]],
  qcwezx4: [["neutral countries", "neutral in ww2", "ww2 neutrals", "stayed out of the war", "didn't fight in ww2", "neutrality", "countries that did not fight"],
    ["axis powers", "allies", "world war 2", "ww2 losers"]],
  q1hp1eug: [["schengen", "schengen area", "shengen", "border free europe", "no borders", "passport free travel", "free movement", "open borders", "no border checks", "without passport"],
    ["european union", "eurozone", "euro", "nato"]],
  q12zbjmn: [["seven wonders", "the 7 wonders", "wonders of the world", "new seven wonders", "7 wonders of the world", "wonderz"],
    ["unesco sites", "monuments", "tourist attractions", "famous places"]],
  qsg3hn3: [["seven summits", "highest mountains", "highest peak on each continent", "tallest mountains", "highest point of each continent", "7 summits", "mountains of each continent"],
    ["volcanoes", "mountains", "mountain ranges", "everest"]],
  q1xscvvl: [["2026 world cup host cities", "world cup 2026", "world cup host cities", "fifa 2026", "2026 host cities", "world cup stadiums", "cities hosting the world cup", "world cup in the usa"],
    ["world cup winners", "big cities", "american cities", "world cup"]],
  /* picked 23 Oct 2026 */
  qlf3ihy: [["the stans","countries ending in stan","-stan countries","names that end with istan","stan","countries ending with -stan","the stan countries"],
    ["central asia","muslim countries","former soviet union","deserts"]],
  q1n3z7bn: [["french speaking countries","francophone","where they speak french","french as an official language","french","countries that speak french","la francophonie","frensh speaking"],
    ["former french colonies","france","french empire","europe and africa"]],
  qzkaulm: [["borders russia","russia's neighbours","countries next to russia","neighbours of russia","the russian border","russia","countries that touch russia","rusia neighbours"],
    ["former soviet union","ussr","communist countries","nato"]],
  q1hicliv: [["population","most populated countries","over 100 million people","biggest populations","most people","populous countries","100 million inhabitants","populaton"],
    ["biggest countries","largest economies","g20","population density"]],
  qrdkgbq: [["arab league","arab countries","the arab world","arabic speaking countries","arab states","arab nations"],
    ["muslim countries","middle east","opec","deserts"]],
  q1nthcja: [["guinea","countries called guinea","guinea in the name","the guineas","guinee","countries with guinea"],
    ["west africa","former french colonies","islands","small countries"]],
  qhhlwtg: [["world cup finalists","played in a world cup final","reached the world cup final","world cup finals","finalists","countries in the final","world cup finalist"],
    ["world cup winners","world cup hosts","football","euro finals"]],
};
const bad = [];
for (const q of maps) {
  const c = CASES[q.id];
  if (!c) { bad.push(`${q.id} (${q.question}): no test answers yet — add some to scripts/check-maps.mjs`); continue; }
  for (const t of c[0]) if (!ok(t, q)) bad.push(`${q.question}: "${t}" should count`);
  for (const t of c[1]) if (ok(t, q)) bad.push(`${q.question}: "${t}" should not count`);
  if (!A.mapKeys?.[q.answer]?.length) bad.push(`${q.question}: no key ideas in data/accept.json mapKeys`);
}
const n = Object.values(CASES).reduce((s, c) => s + c[0].length + c[1].length, 0);
if (bad.length) { console.log(`check-maps: ${bad.length} wrong\n  ` + bad.join("\n  ")); process.exit(1); }
console.log(`check-maps: ${maps.length} maps, ${n} answers, all called right`);
