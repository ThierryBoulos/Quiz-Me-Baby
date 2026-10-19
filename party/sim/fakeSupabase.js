/* The simulator's Supabase: the four tables in memory, the realtime feed of new
   actions, and presence. Only what lib/tvGame.ts (and what it imports) uses. */
export const db = { rooms: [], members: [], secrets: [], actions: [], nextId: 1, writes: 0, stalls: 0 };
/* a messy network: pushes sent twice, or late (so out of order), a TV whose writes fail for a while,
   and a server that now and then sits on a read for 5 to 28 s (Supabase's free plan, GRF2) */
export const net = { dup: 0, delay: 0, stall: 0, rnd: Math.random, failWrites: false };
const listeners = new Set();              // the harness re-renders when rooms or members change
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const changed = (table) => listeners.forEach((f) => f(table));
const channels = new Set();

export function reset() {
  db.rooms = []; db.members = []; db.secrets = []; db.actions = []; db.nextId = 1; db.writes = 0; db.stalls = 0;
  net.dup = 0; net.delay = 0; net.stall = 0; net.failWrites = false;
  channels.clear(); listeners.clear();
}

/* a query: filters collected, run when awaited, as supabase-js does */
function query(table) {
  const f = [];
  let op = { kind: "select" }, order = null;
  const q = {
    select() { return q; },
    eq(c, v) { f.push((r) => r[c] === v); return q; },
    neq(c, v) { f.push((r) => r[c] !== v); return q; },
    gt(c, v) { f.push((r) => (c === "at" ? Date.parse(r.at) > Date.parse(v) : r[c] > Number(v))); return q; },
    /* only the form the inbox uses: "id.gt.N,at.gt.ISO" */
    or(expr) {
      const parts = expr.split(",").map((p) => { const [c, , ...v] = p.split("."); return [c, v.join(".")]; });
      f.push((r) => parts.some(([c, v]) => (c === "at" ? Date.parse(r.at) > Date.parse(v) : r[c] > Number(v))));
      return q;
    },
    order(c) { order = c; return q; },
    abortSignal() { return q; },
    update(v) { op = { kind: "update", v }; return q; },
    insert(v) { op = { kind: "insert", v }; return q; },
    then(res, rej) {
      const hold = op.kind === "select" && net.stall && net.rnd() < net.stall ? 5000 + Math.floor(net.rnd() * 23000) : 0;
      if (hold) db.stalls++;
      return (hold ? new Promise((r) => setTimeout(r, hold)) : Promise.resolve()).then(run).then(res, rej);
    },
  };
  const run = () => {
    const rows = db[table];
    if (op.kind === "insert") { insert(table, op.v); return { data: null, error: null }; }
    const hit = rows.filter((r) => f.every((x) => x(r)));
    if (op.kind === "update") {
      if (net.failWrites && (table === "rooms" || table === "secrets")) return { data: null, error: { message: "Failed to fetch" } };
      db.writes++;
      hit.forEach((r) => Object.assign(r, structuredClone(op.v)));
      if (hit.length) changed(table);
      return { data: null, error: null };
    }
    const out = structuredClone(hit);
    if (order) out.sort((a, b) => a[order] - b[order]);
    return { data: out, error: null };
  };
  return q;
}

export function insert(table, v) {
  const row = structuredClone(v);
  if (table === "actions") {
    row.id = db.nextId++; row.at = new Date(Date.now()).toISOString();
    db.actions.push(row);
    /* the realtime push, a moment later (as from the server) */
    for (const ch of channels) for (const l of ch.pg) if (l.filter === "room=eq." + row.room) {
      const push = () => l.cb({ new: structuredClone(row) });
      const later = (f) => (net.delay ? setTimeout(f, Math.floor(net.rnd() * net.delay)) : Promise.resolve().then(f));
      later(push);
      if (net.dup && net.rnd() < net.dup) later(push);           // the same push twice
    }
  } else { db[table].push(row); changed(table); }
  return row;
}

function channel(name) {
  const ch = {
    name, pg: [], present: {},
    on(type, filter, cb) { if (type === "postgres_changes") ch.pg.push({ filter: filter.filter, cb }); return ch; },
    subscribe(cb) { channels.add(ch); Promise.resolve().then(() => cb?.("SUBSCRIBED")); return ch; },
    presenceState() { return name.startsWith("here:") ? Object.fromEntries(presence.map((k) => [k, [{ on: 1 }]])) : {}; },
    track() { return Promise.resolve("ok"); }, untrack() { return Promise.resolve("ok"); },
  };
  return ch;
}
/* who's present on the room's channel: the harness sets it (the bots' phones) */
export let presence = [];
export const setPresence = (ids) => { presence = ids; };

const client = {
  from: (t) => query(t),
  channel,
  removeChannel(ch) { channels.delete(ch); return Promise.resolve("ok"); },
  auth: { getSession: () => Promise.resolve({ data: { session: { access_token: "tv-token", user: { id: "tv" } } } }) },
  rpc: () => Promise.resolve({ data: null, error: null }),
};
export const sb = () => client;
export const note = () => {};
export const ensureSession = () => Promise.resolve("tv");
export const rpc = () => Promise.resolve(null);
export const sendAction = () => Promise.resolve();
/* (the app waits for the session before joining; here it's there from the start) */
export const joinLive = (make) => { const ch = make(); return () => { client.removeChannel(ch); }; };
