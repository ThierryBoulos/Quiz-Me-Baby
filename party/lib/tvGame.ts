"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, loadBank, type Bank } from "./engine";
import { sb } from "./supabase";
import { readyToStart, starter, type Member, type Room } from "./room";
import type { Pub, Secret } from "./game";

const T_QUESTION = 60, T_STEAL = 30, T_FRIEND = 30;
type Action = { id: number; room: string; user_id: string; kind: string; payload: Record<string, unknown>; at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;

/* Moves the host's phone may send, and the screen each one belongs to.
   Everything else the TV refuses. */
const HOST_MOVES: Record<string, string> = { "round/armDbl": "roundIntro", "round/begin": "roundIntro", "round/swap": "ask",
  "round/lifeline": "ask", "round/judge": "ask", "round/judgeSteal": "steal", "round/afterAnswer": "answer", "round/next": "roundScore",
  "sudden/go": "sudden", "sudden/show": "sudden", "sudden/swap": "sudden", "sudden/win": "sudden" };

/* THE TV RUNS THE NIGHT. It holds the game, plays every move through the
   shared engine (exactly as Classic does), carries out what the engine says
   — screens, clocks, pop-ups — and publishes a view for the phones. It is the
   only device that writes the room, and it checks who sent each action. */
export function useTvGame(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const ctx = useRef({ room, members });
  ctx.current = { room, members };
  const st = useRef({ g: null as G, screen: "", deadline: null as number | null, left: 0, timeUp: false,
    lifeline: null as Pub["lifeline"], toast: null as Pub["toast"], toastN: 0, step: 0, bank: null as Bank | null });
  const [pub, setPub] = useState<Pub | null>(null);
  const saveKey = "qmb.tv." + code + ".game", usedKey = "qmb.party.used";

  const used = useCallback((): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(usedKey) || "[]")); } catch { return new Set(); } }, []);
  const env = useCallback(() => {
    const bank = st.current.bank!;
    const deal = QMB.createDealer({ bank: () => bank.bank, used, noRepeat: () => true,
      ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish" } });
    return { deal, settings: { alternateFirst: false } };
  }, [used]);

  /* ---- what the phones see ---- */
  const view = useCallback((): [Pub, Secret] | null => {
    const s = st.current, g = s.g, room = ctx.current.room;
    if (!g) return null;
    const rd = g.rounds[g.r];
    const owner = rd ? QMB.seatTeam(g, rd, g.seat, {}) : 0;
    const p: Pub = {
      screen: s.screen, step: s.step, r: g.r, N: g.rounds.length, theme: rd?.theme, mode: g.hostless ? "nohost" : "host",
      teams: g.teams.map((t: G) => ({ name: t.name, score: t.score, ll: { ...t.ll } })),
      deadline: s.deadline, left: s.left, timeUp: s.timeUp, lifeline: s.lifeline, toast: s.toast, winner: g.winner ?? null,
    };
    let secret: Secret = {};
    if (rd) {
      p.first = QMB.seatTeam(g, rd, 0, {});
      p.dbl = [...rd.dbl] as [boolean, boolean];
      p.llUsed = [[...rd.llUsed[0]], [...rd.llUsed[1]]];
      const q = rd.q[g.seat];
      if (["ask", "steal", "answer"].includes(s.screen)) {
        p.question = q.question;
        p.turn = s.screen === "steal" ? (owner === 0 ? 1 : 0) : owner;
        secret = { answer: q.answer, notes: q.notes };
      }
      if (s.screen === "answer") {
        const res = rd.res[g.seat] || { correct: false, stolen: false };
        p.result = { answer: q.answer, notes: q.notes, correct: res.correct, stolen: res.stolen,
          by: res.correct ? owner : res.stolen ? (owner === 0 ? 1 : 0) : null, pts: QMB.pointValue(rd, owner) };
      }
      if (s.screen === "roundScore") p.roundPts = [...rd.pts] as [number, number];
      if (s.screen === "roundIntro") p.turn = p.first;
    }
    if (s.screen === "sudden" && g.sd) {
      p.question = g.sdReady ? g.sd.q.question : undefined;
      p.sudden = { ready: !!g.sdReady, shown: !!g.sd.shown, n: g.sd.n, answer: g.sd.shown ? g.sd.q.answer : undefined };
      secret = { answer: g.sd.q.answer, notes: g.sd.q.notes };
    }
    void room;
    return [p, secret];
  }, []);

  const publish = useCallback(async () => {
    const v = view(); if (!v) return;
    setPub(v[0]);
    const s = st.current;
    try { localStorage.setItem(saveKey, JSON.stringify({ g: s.g, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, timeUp: s.timeUp, lifeline: s.lifeline })); } catch { /* full */ }
    const room = ctx.current.room;
    await Promise.all([
      sb().from("rooms").update({ state: { ...(room?.state || {}), pub: v[0] } }).eq("code", code),
      sb().from("secrets").update({ data: v[1] }).eq("room", code),
    ]);
  }, [code, saveKey, view]);

  /* ---- carrying out what the engine says ---- */
  const applyFx = useCallback((fx: G[]) => {
    const s = st.current, now = Date.now();
    for (const f of fx || []) {
      if (f.timer === "stop") { s.deadline = null; s.left = 0; }
      else if (f.timer === "pause" && s.deadline) { s.left = Math.max(0, (s.deadline - now) / 1000); s.deadline = null; }
      else if (f.timer === "resume" && s.left) { s.deadline = now + s.left * 1000; s.left = 0; }
      if (f.used) { const u = used(); u.add(f.used.id); localStorage.setItem(usedKey, JSON.stringify([...u])); }
      if (f.lifeline) {
        const rd = s.g.rounds[s.g.r];
        s.lifeline = { key: f.lifeline, team: QMB.seatTeam(s.g, rd, s.g.seat, {}), deadline: f.lifeline === "friend" ? now + T_FRIEND * 1000 : null };
      }
      if (f.toast) s.toast = { id: ++s.toastN, text: f.toast };
      if (f.go) {
        s.screen = f.go; s.timeUp = false; s.left = 0; s.lifeline = null;
        s.deadline = f.go === "ask" ? now + T_QUESTION * 1000 : f.go === "steal" ? now + T_STEAL * 1000 : null;
      }
      if (f.finalize) { s.screen = "final"; s.deadline = null; }
    }
  }, [used]);

  const play = useCallback((move: G) => {
    const s = st.current;
    if (!s.g || !s.bank) return;
    applyFx(QMB.play(s.g, move, env()));
  }, [applyFx, env]);

  /* ---- the inbox: setup from the starter, moves from the host ---- */
  const handle = useCallback(async (a: Action) => {
    const { room, members } = ctx.current, s = st.current;
    if (!room) return;
    const from = members.find((m) => m.user_id === a.user_id);
    if (a.kind === "team_name" && from?.role === "captain" && from.team === a.payload.team && room.status === "lobby") {
      const names = [...(room.state.teamNames || ["Team A", "Team B"])] as [string, string];
      names[from.team as 0 | 1] = String(a.payload.name || "").slice(0, 18) || names[from.team as 0 | 1];
      await sb().from("rooms").update({ state: { ...room.state, teamNames: names } }).eq("code", code);
      return;
    }
    if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && readyToStart(members)) {
      s.bank = s.bank || await loadBank();
      const cfgIn = (a.payload.cfg || {}) as G;
      const names = room.state.teamNames || ["Team A", "Team B"];
      const team = (t: 0 | 1) => ({ name: names[t], captain: members.find((m) => m.team === t && m.role === "captain")?.name || "",
        players: members.filter((m) => m.team === t).map((m) => m.name).join(", ") });
      const cfg = { rounds: cfgIn.rounds || 6, themes: cfgIn.themes || [], difficulty: cfgIn.difficulty || "mixed", standard: true,
        minis: [], teamA: team(0), teamB: team(1), picks: {} };
      const g = env().deal.buildGame(cfg);
      g.hostless = !members.some((m) => m.role === "host");
      s.g = g; s.screen = ""; s.lifeline = null; s.step = 1;
      g.rounds.forEach((r: G) => r.q.forEach((q: G) => applyFx([{ used: q }])));
      play({ type: "game/start" });
      await sb().from("rooms").update({ status: "playing", mode: g.hostless ? "nohost" : "host" }).eq("code", code);
      await publish();
      return;
    }
    if (a.kind === "judge" && from?.role === "host" && s.g) {
      const move = (a.payload.move || {}) as G;
      /* a tap made on an earlier screen (a double tap, a slow phone) is ignored */
      if (a.payload.step !== s.step) return;
      if (move.type in HOST_MOVES && HOST_MOVES[move.type] !== s.screen) return;
      s.step++;
      if (move.type === "ui/closeLifeline") { s.lifeline = null; applyFx([{ timer: "resume" }]); }
      else if (move.type === "ui/timeUp") { s.deadline = null; s.left = 0; s.timeUp = true; }
      else if (move.type === "ui/pause") { applyFx([{ timer: s.deadline ? "pause" : "resume" }]); }
      else if (move.type in HOST_MOVES) play(move);
      await publish();
    }
  }, [applyFx, code, env, play, publish]);

  /* restore a game in progress after a refresh of the TV */
  useEffect(() => {
    if (!isTv) return;
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (saved?.g) { Object.assign(st.current, saved); void loadBank().then((b) => { st.current.bank = b; setPub(view()?.[0] || null); }); }
    } catch { /* nothing saved */ }
  }, [isTv, saveKey, view]);

  /* the inbox: everything since the last action handled on this TV */
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = Number(localStorage.getItem(key) || 0), busy = false;
    const drain = async () => {
      if (busy) return; busy = true;
      try {
        const { data } = await sb().from("actions").select("*").eq("room", code).gt("id", last).order("id");
        for (const a of (data || []) as Action[]) {
          try { await handle(a); } catch (e) { console.error("action refused", a, e); }
          last = a.id; localStorage.setItem(key, String(last));
        }
      } finally { busy = false; }
    };
    void drain();
    const ch = sb().channel("actions:" + code)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "actions", filter: "room=eq." + code }, () => void drain())
      .subscribe();
    const poll = setInterval(() => void drain(), 1500);
    return () => { clearInterval(poll); void sb().removeChannel(ch); };
  }, [code, isTv, handle]);

  /* the clocks: a question running out is "time's up" — the host still judges */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current;
      if (s.deadline && Date.now() >= s.deadline) { s.deadline = null; s.timeUp = true; void publish(); }
      if (s.lifeline?.deadline && Date.now() >= s.lifeline.deadline) { s.lifeline = { ...s.lifeline, deadline: null }; void publish(); }
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish]);

  return { pub, game: st.current.g as G };
}
