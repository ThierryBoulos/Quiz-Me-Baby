/* The screen check (11 Nov, the owner: every screen fits). Plays a few nights in the simulator (2 teams with and
   without a host, 3, 5 and 8 teams), keeps every screen they reach, and opens each one in a browser as the game
   draws it: on the TV, and on phones (host, captain, player; with a TV in the room and with none). It lists what
   spills off the edge, what's cut off, sideways scroll and text on top of text, and keeps a picture of every screen.
     npm run screens                     everything (about an hour: try a part or a filter first)
     npm run screens -- tv               only part of it: tv (every TV screen and the lobby), phones, sizes
                                         (a few screens on common TVs, laptops and browser windows)
     npm run screens -- phones roulette  only the screens whose name matches "roulette"
   The report and the pictures: sim/.out/screens/ (never committed). Needs Playwright's Chromium.
   It builds the game once with QMB_SCREENS=1 (the only build with app/screens in it, kept in .next-screens, never
   deployed) and serves it on this machine. Nothing it opens can reach the internet: every request that isn't to
   this machine is refused, so no real room is ever touched. */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), party = join(here, "../.."), out = join(party, "sim/.out/screens");
const PARTS = ["tv", "phones", "sizes"];
const args = process.argv.slice(2), parts = args.filter((a) => PARTS.includes(a)), filter = args.find((a) => !PARTS.includes(a));
const want = (p) => !parts.length || parts.includes(p), match = (k) => !filter || new RegExp(filter, "i").test(k);
const PORT = Number(process.env.SCREENS_PORT) || 3199, BASE = `http://127.0.0.1:${PORT}`;

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.error("The screen check needs Playwright and its Chromium (as scripts/export-bank.js does)."); process.exit(2); }

/* 1. the nights: every screen they reach (sim/screens/dump.mjs, in a process of its own) */
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (spawnSync(process.execPath, [join(here, "dump.mjs")], { cwd: party, stdio: ["ignore", "ignore", "inherit"] }).status !== 0) { console.error("The nights didn't play."); process.exit(2); }
const pubs = JSON.parse(readFileSync(join(out, "pubs.json"), "utf8"));
/* each (screen, game) once: its last moment (".z"), or its only one */
const keys = Object.keys(pubs).filter((k) => k.endsWith(".z") || !pubs[k.slice(0, -2) + ".z"]);
console.log(`${Object.keys(pubs).length} moments kept from the nights; ${keys.length} screens to check`);

/* 2. the game, built once for the check (QMB_SCREENS=1: with app/screens, in .next-screens) and served on this machine.
   Next writes its build folder into tsconfig.json and next-env.d.ts; they're put back as they were at the end */
const keep = ["tsconfig.json", "next-env.d.ts"].map((f) => { try { return [f, readFileSync(join(party, f), "utf8")]; } catch { return [f, null]; } });
const env = { ...process.env, QMB_SCREENS: "1", NEXT_TELEMETRY_DISABLED: "1" }, next = join(party, "node_modules/.bin/next");
let server = null, stopped = false;
const stop = () => {
  if (stopped) return; stopped = true;
  if (server) try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone already */ }
  for (const [f, t] of keep) if (t !== null) writeFileSync(join(party, f), t); else rmSync(join(party, f), { force: true });
};
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });
spawnSync(process.execPath, [join(party, "scripts/hash-flags.mjs")], { cwd: party, stdio: "ignore" });
const made = spawnSync(next, ["build"], { cwd: party, env, encoding: "utf8", maxBuffer: 64 << 20 });
writeFileSync(join(out, "build.log"), (made.stdout || "") + (made.stderr || ""));
if (made.status !== 0) { console.error("The build failed:\n" + ((made.stdout || "") + (made.stderr || "")).slice(-3000)); process.exit(2); }
server = spawn(next, ["start", "-p", String(PORT), "-H", "127.0.0.1"], { cwd: party, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", (d) => { log += d; });
server.stderr.on("data", (d) => { log += d; });
for (let t = 0; ; t++) {
  try { if ((await fetch(BASE + "/screens/pubs")).ok) break; } catch { /* not up yet */ }
  if (t > 60 || server.exitCode !== null) { console.error("The server didn't start:\n" + log.slice(-2000)); process.exit(2); }
  await new Promise((r) => setTimeout(r, 1000));
}

/* 3. the checks, in the page (the ones tuned on this week's sweeps, 10-11 Nov) */
/* the TV: what spills off the 1280x720 stage, what's cut off inside it, text on top of other text */
const TV_MEASURE = () => {
  const st = document.querySelector(".tv-stage"); if (!st) return ["no stage"];
  const S = st.getBoundingClientRect(), k = S.width / 1280, bad = [];
  /* the night's intro covers the whole stage: what's behind it doesn't show */
  const scope = st.querySelector(".night-intro") || st;
  /* not part of the layout: lights, effects, celebrations, the bubble Imad speaks in, the plane that flies off the
     airport board, the split-flap letters' halves */
  const skip = (el) => el.closest(".tv-glow,.confetti,.confetti-late,.win-flash,.win-ring,.lead-banner,.imad-bubble,.tv-cover,[aria-hidden=\"true\"] svg,.mq-beam,.mq-world,.mq-dust,.mq-floor,.plane-ico,.lectern-spot")
    || (el.tagName === "svg" && el.closest("svg") !== el);
  const name = (el) => (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : el.tagName.toLowerCase()) + ' "' + (el.textContent || "").trim().slice(0, 40) + '"';
  for (const el of scope.querySelectorAll("*")) {
    if (el.closest("svg") && el.tagName !== "svg") continue;
    if (skip(el)) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const o = { l: (S.left - r.left) / k, r: (r.right - S.right) / k, t: (S.top - r.top) / k, b: (r.bottom - S.bottom) / k };
    const m = Math.max(o.l, o.r, o.t, o.b);
    if (m > 3) bad.push("OFF " + Math.round(m) + "px " + ["l", "r", "t", "b"].filter((x) => o[x] > 3).join("") + " " + name(el));
    /* (an ellipsis or a line clamp is meant: a long name ends in "…") */
    if (/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY) && el.children.length + (el.textContent || "").length > 0 && cs.textOverflow !== "ellipsis" && !(cs.webkitLineClamp > 0)
      && !/line-clamp|flap-|roll-win/.test(el.className || "") && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)
      && !el.matches(".tv-stage,.tv-wrap,.spot,.picker") && el.clientHeight > 0
      /* (the display font's letters stand a few pixels taller than their line: not a cut) */
      && !(el.matches(".display, .display *") && el.scrollWidth <= el.clientWidth + 3 && el.scrollHeight - el.clientHeight <= 10))
      bad.push("CLIP " + (el.scrollWidth - el.clientWidth) + "x" + (el.scrollHeight - el.clientHeight) + " " + name(el));
  }
  /* text on top of text: two bits of text (neither inside the other) whose boxes cross by a fair part; the two faces
     of a flip card take turns, so they don't count */
  const txt = [...scope.querySelectorAll("*")].filter((el) => !el.closest("svg") && !skip(el) && !el.closest(".face.back")
    && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
    .filter((el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05 && !el.closest(".tv-foot"); });
  /* (what shows of each: a name cut short with "…" counts only as far as it shows) */
  const cutBy = (el) => { for (let e = el.parentElement; e && e !== st; e = e.parentElement) if (/(hidden|clip)/.test(getComputedStyle(e).overflowX)) return e.getBoundingClientRect(); return null; };
  /* (the display font's letters sit in the middle of a taller box: only that part counts) */
  const ink = (el, a) => (el.closest(".display") ? { left: a.left, right: a.right, top: a.top + 0.18 * a.height, bottom: a.bottom - 0.08 * a.height } : a);
  const rs = txt.map((el) => { const a = ink(el, el.getBoundingClientRect()), c = cutBy(el);
    return c ? { left: Math.max(a.left, c.left), right: Math.min(a.right, c.right), top: Math.max(a.top, c.top), bottom: Math.min(a.bottom, c.bottom) } : a; });
  for (let i = 0; i < txt.length; i++) for (let j = i + 1; j < txt.length; j++) {
    if (txt[i].contains(txt[j]) || txt[j].contains(txt[i])) continue;
    const a = rs[i], c = rs[j], w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
    if (w <= 2 || h <= 2) continue;
    const small = Math.min((a.right - a.left) * (a.bottom - a.top), (c.right - c.left) * (c.bottom - c.top));
    if (w * h > 0.15 * small) bad.push("OVER " + Math.round(100 * w * h / small) + "% " + name(txt[i]) + " / " + name(txt[j]));
  }
  return [...new Set(bad)].slice(0, 12);
};
/* a phone: sideways scroll, past the screen's edge, cut off, text on top of text (the pinned bars aside) */
const PHONE_MEASURE = () => {
  const bad = [], W = innerWidth;
  if (document.documentElement.scrollWidth > W + 1) bad.push("SIDEWAYS " + (document.documentElement.scrollWidth - W) + "px");
  const name = (el) => (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : el.tagName.toLowerCase()) + ' "' + (el.textContent || "").trim().slice(0, 40) + '"';
  const cover = document.querySelector(".night-intro");
  const skip = (el) => el.closest(".confetti,.confetti-back,.win-flash,.win-ring,svg *,canvas,.face.back,.plane-ico,.lectern-spot") || (cover && !cover.contains(el)) || [...(function* () { for (let e = el; e; e = e.parentElement) yield e; })()].some((e) => getComputedStyle(e).position === "sticky");
  const scroller = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return e; } return null; };
  for (const el of document.querySelectorAll("main *")) {
    if (skip(el)) continue; const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0 || cs.position === "fixed") continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if ((r.right > W + 2 || r.left < -2) && !scroller(el)) bad.push("OFF " + Math.round(Math.max(r.right - W, -r.left)) + "px " + name(el));
    if (/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY) && (el.textContent || "").trim() && cs.textOverflow !== "ellipsis" && !(cs.webkitLineClamp > 0) && !/clamp|truncate|line-clamp|roll-win|flap-/.test(el.className || "")
      && el.clientHeight > 0 && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)) bad.push("CLIP " + (el.scrollWidth - el.clientWidth) + "x" + (el.scrollHeight - el.clientHeight) + " " + name(el));
  }
  const txt = [...document.querySelectorAll("main *")].filter((el) => !skip(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0))
    .filter((el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; });
  const ink = (el, a) => (el.closest(".display") ? { left: a.left, right: a.right, top: a.top + 0.18 * a.height, bottom: a.bottom - 0.08 * a.height } : a);
  /* each line of a bit of text on its own (a sentence that wraps isn't one big box), as far as it shows */
  /* (inside something that scrolls or cuts, either way: only what shows of it) */
  const clipBox = txt.map((el) => { let c = null;
    for (let e = el.parentElement; e; e = e.parentElement) { if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(e).overflowX + getComputedStyle(e).overflowY)) continue;
      const r = e.getBoundingClientRect(); c = c ? { left: Math.max(c.left, r.left), right: Math.min(c.right, r.right), top: Math.max(c.top, r.top), bottom: Math.min(c.bottom, r.bottom) } : r; }
    return c; });
  const cut = (a, c) => (c ? { left: Math.max(a.left, c.left), right: Math.min(a.right, c.right), top: Math.max(a.top, c.top), bottom: Math.min(a.bottom, c.bottom) } : a);
  const boxes = txt.map((el, i) => { const d = getComputedStyle(el).display, inl = d === "inline" || d === "contents";
    return (inl ? [...el.getClientRects()] : [el.getBoundingClientRect()]).map((r) => cut(ink(el, r), clipBox[i])).filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1); });
  for (let i = 0; i < txt.length; i++) for (let j = i + 1; j < txt.length; j++) {
    if (txt[i].contains(txt[j]) || txt[j].contains(txt[i])) continue;
    let worst = 0;
    for (const a of boxes[i]) for (const c of boxes[j]) {
      const ww = Math.min(a.right, c.right) - Math.max(a.left, c.left), hh = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ww <= 2 || hh <= 3) continue;
      worst = Math.max(worst, ww * hh / Math.min((a.right - a.left) * (a.bottom - a.top), (c.right - c.left) * (c.bottom - c.top)));
    }
    if (worst > 0.25) bad.push("OVER " + Math.round(100 * worst) + "% " + name(txt[i]) + " / " + name(txt[j]));
  }
  return [...new Set(bad)].slice(0, 10);
};
const waitFor = (k) => (/\.final/.test(k) ? 12000 : /Reveal|reveal|Result|Summary|summary|roundScore|Review|decided|\.intro/.test(k) ? 6000 : /^lobby/.test(k) ? 3500 : 2500);
const file = (s) => s.replace(/[^a-z0-9]+/gi, "_");

const browser = await chromium.launch();
const report = {}, errors = [];
/* only this machine: nothing reaches Supabase or anywhere else */
const offline = async (ctx) => ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
/* n at a time; a line every 25 screens (SCREENS_VERBOSE=1: every one, with its time) */
const pool = async (jobs, n, work) => {
  const q = jobs.slice(), loud = process.env.SCREENS_VERBOSE === "1";
  let done = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const j = q.shift(), t = Date.now();
    try { await work(j); } catch (e) { errors.push(j.id + ": " + String(e).slice(0, 160)); }
    done++; if (loud || done % 25 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length}` + (loud ? ` ${j.id} ${Date.now() - t}ms` : "")); } }));
};
const page = async (j, opt) => {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, ...opt }); await offline(ctx);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(j.id + ": " + String(e).slice(0, 200)));
  await p.goto(BASE + "/screens#" + encodeURIComponent(j.hash), { timeout: 180000 });
  return { ctx, p };
};

if (want("tv")) {
  const jobs = [...[2, 3, 5, 8].map((t) => `lobby:${t}`), ...keys.map((k) => `tv:${k}`)].filter(match).map((h) => ({ id: "tv " + h, hash: h, key: h.replace(/^tv:/, "") }));
  mkdirSync(join(out, "tv"), { recursive: true });
  await pool(jobs, 4, async (j) => {
    const { ctx, p } = await page(j, { viewport: { width: 1440, height: 900 } });
    await p.waitForTimeout(waitFor(j.key));
    report[j.id] = await p.evaluate(TV_MEASURE);
    await p.screenshot({ path: join(out, "tv", file(j.key) + ".png") }); await ctx.close();
  });
  console.log(`TV: ${jobs.length} screens checked`);
}

if (want("phones")) {
  /* (2 teams: the captain and a player with no host, the host with one; 3 and 8 teams: all three (5 is on the TV)) */
  const roles = (k) => (/^nh/.test(k) ? ["cap", "player"] : /^h\./.test(k) ? ["host"] : /^m[38]\./.test(k) ? ["host", "cap", "player"] : []);
  /* the narrowest (Galaxy S), the widest (iPhone Pro Max) and held sideways, the browser's bars showing: the iPhones
     between (393, 402) fit when both ends do. SCREENS_PHONES=all adds the iPhone at 393 */
  const PHONES = [["galaxy", 360, 780], ...(process.env.SCREENS_PHONES === "all" ? [["iphone", 393, 852]] : []), ["promax", 440, 956], ["sideways", 852, 340]];
  const jobs = [];
  for (const [dev, w, h] of PHONES) for (const k of keys.filter(match)) for (const r of roles(k)) for (const tvIn of ["ph", "pn"])
    jobs.push({ id: `${dev} ${tvIn === "ph" ? "tv" : "no-tv"} ${r} ${k}`, hash: `${tvIn}:${r}:${k}`, key: k, dev, w, h });
  for (const [dev] of PHONES) mkdirSync(join(out, dev), { recursive: true });
  await pool(jobs, 6, async (j) => {
    const { ctx, p } = await page(j, { viewport: { width: j.w, height: j.h }, hasTouch: true, isMobile: true });
    await p.waitForTimeout(Math.min(waitFor(j.key), 9000));
    report[j.id] = await p.evaluate(PHONE_MEASURE);
    await p.screenshot({ path: join(out, j.dev, file(j.hash) + ".png"), fullPage: true }); await ctx.close();
  });
  console.log(`Phones: ${jobs.length} screens checked (${PHONES.map((x) => x[0] + " " + x[1] + "x" + x[2]).join(", ")}; with a TV and with none)`);
}

if (want("sizes")) {
  /* the TV's stage on common screens: whole, in the middle, as big as it fits (the bands round it keep the background) */
  const SIZES = [["tv-1080", 1920, 1080], ["tv-4k", 3840, 2160], ["laptop-1366", 1366, 768], ["windows-chrome", 1536, 730], ["macbook-air-chrome", 1470, 830],
    ["macbook-pro-14-chrome", 1512, 860], ["16x10-full", 1440, 900], ["surface-3x2", 1504, 1003]];
  const few = ["lobby:8", "lobby:2", ...["nh.ask.z", "nh.rouletteQ.roulette.hold.lap1.a", "m8.q.majority.z", "m8.reveal.pin.z", "nh.final.a", "m8.final.sudden.a"].filter((k) => pubs[k]).map((k) => "tv:" + k)].filter(match);
  const jobs = SIZES.flatMap(([dev, w, h]) => few.map((s) => ({ id: `${dev} ${s}`, hash: s, key: s, dev, w, h })));
  mkdirSync(join(out, "sizes"), { recursive: true });
  await pool(jobs, 3, async (j) => {
    const { ctx, p } = await page(j, { viewport: { width: j.w, height: j.h } });
    await p.waitForTimeout(waitFor(j.key));
    report[j.id] = await p.evaluate(() => {
      const st = document.querySelector(".tv-stage")?.getBoundingClientRect(); if (!st) return ["no stage"];
      const W = innerWidth, H = innerHeight, fit = Math.min(W / 1280, H / 720), bad = [];
      if (st.left < -1 || st.top < -1 || st.right > W + 1 || st.bottom > H + 1) bad.push("OFF the screen: stage at " + [st.left, st.top, st.right, st.bottom].map(Math.round).join(","));
      if (Math.abs(st.left - (W - st.right)) > 2 || Math.abs(st.top - (H - st.bottom)) > 2) bad.push("NOT CENTRED");
      if (st.width < 1280 * fit - 2) bad.push("SMALL: " + Math.round(st.width) + " wide, could be " + Math.round(1280 * fit));
      return bad;
    });
    await p.screenshot({ path: join(out, "sizes", file(j.dev + "__" + j.key) + ".png") }); await ctx.close();
  });
  console.log(`Sizes: ${jobs.length} screens checked (${SIZES.map((x) => x[1] + "x" + x[2]).join(", ")})`);
}
await browser.close();
stop();

/* 4. the report */
const flagged = Object.entries(report).filter(([, v]) => v.length).sort(([a], [b]) => a.localeCompare(b));
const text = [`${Object.keys(report).length} screens checked, ${flagged.length} flagged, ${errors.length} errors.`, "",
  ...flagged.map(([k, v]) => k + "\n   " + v.join("\n   ")), ...(errors.length ? ["", "Errors:", ...errors] : [])].join("\n");
writeFileSync(join(out, "report.txt"), text + "\n");
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
writeFileSync(join(out, "server.log"), log);
console.log(text.split("\n").slice(0, 120).join("\n"));
console.log(`\nReport and pictures: ${out}`);
process.exit(flagged.length || errors.length ? 1 : 0);
