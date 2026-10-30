"use client";
/* MANY TEAMS: the TV runs the night (3 to 8 teams, always with a host). Its own state, saved under its own
   key (qmb.tv.<code>.many), so a two-team save is never read here or the other way round. It shares only the
   inbox (lib/tv/useInbox.ts), the bank and the dealer's decks with the two-team game; none of the two-team
   reducer (lib/tvGame.ts) runs while this one does. */
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, acceptFor, hostOnly, loadBank, type Bank, type Q } from "../engine";
import { sb } from "../supabase";
import { getSettings, USED_KEY } from "../settings";
import { cap1, type Member, type Room } from "../room";
import { useInbox } from "../tv/useInbox";
import type { Action, G } from "../tv/rules";
import { playSound } from "../sound";
import { MANY_MAX, MANY_MINIS, MANY_PLAYERS, allIn, captainAnswer, defaultName, flip, miniOf, newNight, next, reveal, startMini, vote, type ManyKey, type StateM, type Timers } from "./logic";
import { buildMany, type PubMany } from "./view";
import { imadMany } from "./imad";

const SHAPE = 1;
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD || "dev";
export const teamCountOf = (room: Room | null) => Math.max(2, Math.min(MANY_MAX, Math.floor(Number(room?.state?.teamCount) || 2)));
export const manyNames = (room: Room | null, k: number) => Array.from({ length: k }, (_, t) => cap1(((room?.state?.teamNames as string[] | undefined) || [])[t] || defaultName(t)));
/* ready: a host, and a captain on every team (and not over the cap) */
export function manyNotReady(members: Member[], k: number): string {
  if (!members.some((m) => m.role === "host")) return "A game with more than two teams needs a host.";
  const missing = Array.from({ length: k }, (_, t) => t).filter((t) => !members.some((m) => (m.team as number) === t && m.role === "captain"));
  if (missing.length) return missing.length === 1 ? `Team ${"ABCDEFGH"[missing[0]]} needs a captain.` : "Every team needs a captain first.";
  if (members.filter((m) => m.role !== "host").length > MANY_PLAYERS) return `${MANY_PLAYERS} players at most.`;
  return "";
}

export function useTvMany(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const st = useRef<StateM | null>(null);
  const [pub, setPub] = useState<PubMany | null>(null);
  const ctx = useRef({ room, members }); ctx.current = { room, members };
  const bank = useRef<Bank | null>(null);
  const saveKey = "qmb.tv." + code + ".many";
  const lastAt = useRef(0);
  const ack = useRef<Record<string, Record<string, string>>>({});
  const timers = (): Timers => { const t = getSettings(); return { flag: t.tFlag, closest: t.tMini, pin: t.tPin, majority: t.tMajority }; };

  /* publish: the view for every phone, the answer for the host; one write at a time, newest wins */
  const chain = useRef<Promise<void>>(Promise.resolve());
  const publish = useCallback(() => {
    const s = st.current; if (!s) return;
    const { pub: p, secret } = buildMany(s);
    p.ack = ack.current;
    const at = Math.max(Date.now(), lastAt.current + 1); lastAt.current = at; p.at = at;
    setPub(p);
    try { localStorage.setItem(saveKey, JSON.stringify({ build: BUILD_ID, shape: SHAPE, s })); } catch { /* in memory only */ }
    chain.current = chain.current.then(async () => {
      const room = ctx.current.room;
      const r = await sb().from("rooms").update({ state: { ...(room?.state || {}), pub: p, pubAt: at } }).eq("code", code);
      if (r.error) console.error("publish (many)", r.error);
      await sb().from("secrets").update({ data: { ...secret, at } }).eq("room", code);
    }).catch((e) => console.error("publish (many)", e));
  }, [code, saveKey]);

  /* a reload picks the night up where it was */
  useEffect(() => {
    if (!isTv) return;
    try {
      const raw = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (raw && raw.shape === SHAPE && raw.s && raw.s.v === 2) { st.current = raw.s; void loadBank(code).then((b) => { bank.current = b; }).catch(() => {}); publish(); }
    } catch { /* nothing saved */ }
  }, [isTv, saveKey, code, publish]);

  const roster = () => ctx.current.members.filter((m) => m.role !== "host" && m.team != null).map((m) => ({ name: m.name, team: m.team as number }));
  const accept = (q: Q) => acceptFor(q);

  const handle = useCallback(async (a: Action) => {
    const { room, members } = ctx.current; if (!room) return;
    const from = members.find((m) => m.user_id === a.user_id);
    const tap = typeof a.payload?.tap === "string" ? (a.payload.tap as string).slice(0, 12) : null;
    const reply = (r: string) => { if (!tap) return; const mine = Object.entries(ack.current[a.user_id] || {}).slice(-4); ack.current = { ...ack.current, [a.user_id]: Object.fromEntries([...mine, [tap, r]]) }; };
    const k = teamCountOf(room);
    /* the lobby */
    if (room.status === "lobby") {
      if (a.kind === "team_name" && from?.role === "captain" && (from.team as number) === Number(a.payload.team) && (from.team as number) < k) {
        const names = manyNames(room, MANY_MAX); names[from.team as number] = cap1(String(a.payload.name || "").trim().slice(0, 14)) || names[from.team as number];
        await sb().from("rooms").update({ state: { ...room.state, teamNames: names } }).eq("code", code);
        return;
      }
      if (a.kind === "setup" && a.payload.start && from?.role === "host") {
        const why = manyNotReady(members, k);
        if (why) { await sb().from("rooms").update({ state: { ...room.state, note: { text: why, at: Date.now() } } }).eq("code", code); return; }
        const cfg = (a.payload.cfg || {}) as G;
        const keys = (Array.isArray(cfg.minis) ? cfg.minis : []).filter((x: string) => (MANY_MINIS as readonly string[]).includes(x)) as ManyKey[];
        if (!keys.length) { await sb().from("rooms").update({ state: { ...room.state, note: { text: "Pick at least one game.", at: Date.now() } } }).eq("code", code); return; }
        let b: Bank;
        try { b = await loadBank(code); } catch { await sb().from("rooms").update({ state: { ...room.state, note: { text: "The TV couldn't load the questions. Check its internet, then tap Start again.", at: Date.now() } } }).eq("code", code); return; }
        bank.current = b;
        /* the decks, dealt exactly as the two-team game deals them (fresh questions first) */
        let used = new Set<string>(); try { used = new Set(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); } catch { /* none */ }
        const dealer = QMB.createDealer({ bank: () => b.bank, used: () => used, noRepeat: () => getSettings().noRepeat, suddenOk: (q: Q) => !hostOnly(q),
          ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish",
            pin: (q: G) => q.type === "pin" && Number.isFinite(q.lat) && Number.isFinite(q.lon) && !!q.photo,
            airport: (q: G) => q.type === "airport" && Array.isArray(q.board) && q.board.length > 0,
            majority: (q: G) => q.type === "majority" && Array.isArray(q.options) && q.options.length === 4 && q.options.includes(q.answer) } });
        const lv = (x: unknown, all: string[], dflt: string[]) => { const v = (Array.isArray(x) ? x : []).filter((y) => all.includes(y)); return v.length ? v : dflt; };
        const g = dealer.buildGame({ standard: false, rounds: 0, themes: [], difficulty: "mixed", minis: keys, picks: {}, themeDiff: {},
          mapLevels: QMB.MAP_ORDER, dishLevels: ["c-medium", "d-medium"], airportLevels: QMB.AIRPORT_ORDER,
          flagLevels: lv(cfg.flagLevels, QMB.FLAG_LEVEL_KEYS, ["veasy", "easy", "medium", "hard"]), pinLevels: lv(cfg.pinLevels, QMB.PIN_ORDER, QMB.PIN_ORDER),
          majorityLevels: lv(cfg.majorityLevels, QMB.MAJORITY_ORDER, QMB.MAJORITY_ORDER),
          teamA: { name: "A", captain: "", players: "" }, teamB: { name: "B", captain: "", players: "" },
          pickClosest: [], pickAuction: [], pickSaySame: [], pickMap: [], pickFlag: [], pickDish: [], pickPin: [], pickAirport: [], pickMajority: [] });
        const decks: Partial<Record<ManyKey, Q[]>> = { flag: g.flagGame?.qs, closest: g.mini?.qs, pin: g.pinGame?.qs, majority: g.majorityGame?.qs };
        const names = manyNames(room, k);
        const teams = names.map((name, t) => ({ name, captain: cap1(members.find((m) => (m.team as number) === t && m.role === "captain")?.name || "") }));
        st.current = newNight(teams, decks, keys);
        imadMany(st.current, getSettings().imad);
        /* the questions dealt count as played on this TV */
        try { for (const mm of st.current.minis) for (const q of mm.qs) if (q?.id) used.add(q.id); localStorage.setItem(USED_KEY, JSON.stringify([...used])); } catch { /* in memory only */ }
        await sb().from("rooms").update({ status: "playing", mode: "many" }).eq("code", code);
        publish(); return;
      }
      return;
    }
    const s = st.current; if (!s || !from) return;
    /* the host runs it */
    if (a.kind === "judge" && from.role === "host") {
      const mv = (a.payload.move || {}) as G, t = String(mv.type || "");
      if (t !== "m/flip" && Number(a.payload.step) !== s.step) { reply("-"); publish(); return; }
      let ok = false;
      if (t === "m/start") ok = startMini(s, Date.now(), timers(), roster());
      else if (t === "m/reveal" && s.screen === "q") ok = reveal(s, accept);
      else if (t === "m/next") ok = next(s, Date.now(), timers());
      else if (t === "m/flip") ok = flip(s, Number(mv.t));
      else if (t === "m/exit") { s.exit = true; ok = true; try { localStorage.removeItem(saveKey); } catch { /* fine */ } void sb().from("rooms").update({ status: "done" }).eq("code", code); }
      else if (t === "m/again") {
        try { localStorage.removeItem(saveKey); } catch { /* fine */ }
        st.current = null; setPub(null);
        await sb().from("rooms").update({ status: "lobby", mode: null, state: { ...room.state, pub: null } }).eq("code", code);
        reply("+"); return;
      }
      reply(ok ? "+" : "-");
      if (ok && s.screen === "summary") playSound("win");
      if (ok) imadMany(s, getSettings().imad);
      publish(); return;
    }
    /* captains answer; in Majority Rules everyone does */
    if (a.kind === "answer") {
      const m = miniOf(s);
      const r = m?.key === "majority" ? vote(s, from.name, a.payload.pick)
        : from.role === "captain" ? captainAnswer(s, from.team as number, a.payload as G) : "Your captain answers this one.";
      reply(r === true ? "+" : r);
      if (r === true && allIn(s) && reveal(s, accept)) imadMany(s, getSettings().imad);
      publish(); return;
    }
  }, [code, publish, saveKey]);

  useInbox(code, isTv, handle);

  /* the clock: time up shows the reveal */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current; if (!s || s.screen !== "q" || !s.deadline) return;
      if (Date.now() >= s.deadline) { if (reveal(s, (q) => acceptFor(q))) imadMany(s, getSettings().imad); publish(); }
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish]);

  /* the TV's own stepper in the lobby: how many teams (players on a team that goes are left with no team) */
  const setTeamCount = useCallback(async (k: number) => {
    const room = ctx.current.room; if (!room || room.status !== "lobby") return;
    const v = Math.max(2, Math.min(MANY_MAX, k));
    await sb().from("rooms").update({ state: { ...room.state, teamCount: v } }).eq("code", code);
    const gone = ctx.current.members.filter((m) => m.team != null && (m.team as number) >= v);
    for (const m of gone) await sb().from("members").update({ team: null, role: m.role === "captain" ? "player" : m.role }).eq("room", code).eq("user_id", m.user_id);
  }, [code]);

  return { pub, setTeamCount };
}
