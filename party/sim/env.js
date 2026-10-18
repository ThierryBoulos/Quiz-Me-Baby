/* The simulator's world, set up before the app's modules load: a virtual clock
   (Date, setTimeout, setInterval) that only moves when the simulator says so, a
   seeded Math.random, and the few browser bits the TV's code touches. */
const realImmediate = setImmediate;
const RealDate = Date;
let now = RealDate.UTC(2026, 9, 18, 19, 0, 0);
class FakeDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [now])); }
  static now() { return now; }
}
globalThis.Date = FakeDate;

let timers = [], nextT = 1;
const add = (fn, ms, every, args) => { const id = nextT++; timers.push({ id, at: now + Math.max(0, Number(ms) || 0), fn, every: every ? Math.max(1, Number(ms) || 1) : 0, args }); return id; };
globalThis.setTimeout = (fn, ms, ...args) => add(fn, ms, false, args);
globalThis.setInterval = (fn, ms, ...args) => add(fn, ms, true, args);
globalThis.clearTimeout = globalThis.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };

/* every promise settled (the fake database answers with promises) */
export const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((r) => realImmediate(r)); };
export const clock = () => now;
/* move the clock on, firing each timer at its time, settling promises between them */
export async function advance(ms) {
  const end = now + ms;
  for (;;) {
    const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!due) break;
    now = Math.max(now, due.at);
    if (due.every) due.at += due.every; else timers = timers.filter((t) => t !== due);
    try { due.fn(...(due.args || [])); } catch (e) { console.error("timer threw", e); }
    await flush();
  }
  now = end;
}
export function resetClock() { timers = []; }

/* the same night every time for a seed (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const seedRandom = (seed) => { Math.random = rng(seed); };

/* the browser, as far as the TV's code needs one */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), clear: () => store.clear(), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
};
globalThis.window = globalThis;
const docListeners = new Set();
globalThis.document = { visibilityState: "visible", hidden: false,
  addEventListener(t, f) { if (t === "visibilitychange") docListeners.add(f); }, removeEventListener(t, f) { docListeners.delete(f); } };
/* the TV's screen goes to sleep, or comes back */
export function setVisible(on) {
  document.visibilityState = on ? "visible" : "hidden"; document.hidden = !on;
  docListeners.forEach((f) => f());
}
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; globalThis.dispatchEvent = () => true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
