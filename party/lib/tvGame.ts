"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, loadBank, type Bank } from "./engine";
import { sb } from "./supabase";
import { readyToStart, starter, type Member, type Room } from "./room";
import { DISH_LAST, DISH_STEP, MINI_TITLES, T_CLOSEST, T_FLAG, type MiniKey, type Pub, type Secret, type Two } from "./game";

const T_QUESTION = 60, T_STEAL = 30, T_FRIEND = 30;
type Action = { id: number; room: string; user_id: string; kind: string; payload: Record<string, unknown>; at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
type W = 0 | 1 | "tie" | "none";

/* Moves the host's phone may send, and the screen each one belongs to.
   Everything else the TV refuses. "ui/…" moves are the TV's own (clocks,
   reveals, overrules); the rest go straight to the shared engine. */
const HOST_MOVES: Record<string, string | string[]> = {
  "round/armDbl": "roundIntro", "round/begin": "roundIntro", "round/swap": "ask", "round/lifeline": "ask",
  "round/judge": "ask", "round/judgeSteal": "steal", "round/afterAnswer": "answer", "round/next": "roundScore",
  "sudden/go": "sudden", "sudden/show": "sudden", "sudden/swap": "sudden", "sudden/win": "sudden",
  "closest/start": "miniIntro", "closest/swap": "miniQ", "closest/award": "miniSummary", "closest/done": "miniSummary",
  "flag/start": "flagIntro", "flag/swap": "flagQ", "flag/award": "flagSummary", "flag/done": "flagSummary",
  "dish/start": "dishIntro", "dish/swap": "dishQ", "dish/right": "dishQ", "dish/wrong": "dishQ", "dish/next": "dishReveal",
  "dish/more": "dishTie", "dish/stop": "dishTie", "dish/award": "dishSummary", "dish/done": "dishSummary",
  "ui/closeLifeline": "*", "ui/timeUp": ["ask", "steal"], "ui/pause": ["ask", "steal", "miniQ", "flagQ", "dishQ"],
  "ui/reveal": ["miniQ", "flagQ"], "ui/flagOk": "flagReveal", "ui/next": ["closestReveal", "flagReveal"],
  "ui/sdRight": "sudden", "ui/sdWrong": "sudden",
};
const other = (t: 0 | 1) => (t === 0 ? 1 : 0) as 0 | 1;
const LEVELS: Record<string, { flag: string[]; dish: string[] }> = {
  easy: { flag: ["veasy", "easy"], dish: ["c-easy", "d-easy"] },
  medium: { flag: ["medium"], dish: ["c-medium", "d-medium"] },
  hard: { flag: ["hard", "expert"], dish: ["c-hard", "d-hard"] },
  mixed: { flag: ["easy", "medium", "hard"], dish: ["c-easy", "c-medium", "d-easy", "d-medium"] },
};
const dishKind = (q: G) => ((q?.level || "")[0] === "c" ? "Cocktail" : "Dish");
const dishTotal = (q: G) => (q.ings.length - 1) * DISH_STEP + DISH_LAST;

/* THE TV RUNS THE NIGHT. It holds the game, plays every move through the
   shared engine (exactly as Classic does), carries out what the engine says
   — screens, clocks, pop-ups — and publishes a view for the phones. It is the
   only device that writes the room, and it checks who sent each action. */
export function useTvGame(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const ctx = useRef({ room, members });
  ctx.current = { room, members };
  const st = useRef({
    g: null as G, screen: "", step: 0, deadline: null as number | null, left: 0, timeUp: false, total: 0,
    lifeline: null as Pub["lifeline"], toast: null as Pub["toast"], toastN: 0, bank: null as Bank | null,
    typed: [null, null] as Two<string[] | null>,       // what each captain sent for the question on screen
    guesses: [null, null] as Two<number | null>,       // Closest To Wins
    ok: [null, null] as Two<boolean | null>,           // Flag verdicts (the app's, the host can flip them)
    sdBuzz: null as 0 | 1 | null, sdOut: [false, false] as Two<boolean>,
  });
  const [pub, setPub] = useState<Pub | null>(null);
  const saveKey = "qmb.tv." + code + ".game", usedKey = "qmb.party.used";

  const used = useCallback((): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(usedKey) || "[]")); } catch { return new Set(); } }, []);
  const env = useCallback(() => {
    const bank = st.current.bank!;
    const deal = QMB.createDealer({ bank: () => bank.bank, used, noRepeat: () => true,
      ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish" } });
    return { deal, settings: { alternateFirst: false } };
  }, [used]);

  /* the question in play right now, whatever the game */
  const current = useCallback((): G => {
    const s = st.current, g = s.g;
    if (!g) return null;
    const sc = s.screen;
    if (["ask", "steal", "answer"].includes(sc)) return g.rounds[g.r]?.q[g.seat];
    if (sc === "sudden") return g.sdReady ? g.sd?.q : null;
    if (["miniQ", "closestReveal"].includes(sc)) return g.mini.qs[g.mini.i];
    if (["flagQ", "flagReveal"].includes(sc)) return g.flagGame.qs[g.flagGame.i];
    if (["dishQ", "dishCheck"].includes(sc)) return g.dishGame.qs[g.dishGame.i];
    if (sc === "dishReveal") { const subs = g.dishGame.subs; return subs[subs.length - 1]?.q; }
    return null;
  }, []);
  const match = (texts: string[] | null, q: G) => (texts && q ? texts.some((t) => QMB.isMatch(t, q.answer)) : null);

  /* ---- what the phones see ---- */
  const view = useCallback((): [Pub, Secret] | null => {
    const s = st.current, g = s.g;
    if (!g) return null;
    const rd = g.rounds[g.r];
    const owner = rd ? QMB.seatTeam(g, rd, g.seat, {}) : 0;
    const q = current();
    const p: Pub = {
      screen: s.screen, step: s.step, r: g.r, N: g.rounds.length, theme: rd?.theme, mode: g.hostless ? "nohost" : "host",
      teams: g.teams.map((t: G) => ({ name: t.name, score: t.score, ll: { ...t.ll } })),
      deadline: s.deadline, left: s.left, timeUp: s.timeUp, lifeline: s.lifeline, toast: s.toast, winner: g.winner ?? null,
      sent: [!!s.typed[0] || s.guesses[0] != null, !!s.typed[1] || s.guesses[1] != null],
    };
    const secret: Secret = { typed: s.typed, match: [match(s.typed[0], q), match(s.typed[1], q)], guesses: s.guesses };
    secret.step = s.step;
    if (q) { p.qid = q.id; secret.qid = q.id; secret.answer = q.answer; secret.notes = q.notes; }
    if (rd) {
      p.first = QMB.seatTeam(g, rd, 0, {});
      p.dbl = [...rd.dbl] as Two<boolean>;
      p.llUsed = [[...rd.llUsed[0]], [...rd.llUsed[1]]];
      if (["ask", "steal", "answer"].includes(s.screen)) {
        p.question = q.question;
        p.turn = s.screen === "steal" ? other(owner) : owner;
      }
      if (s.screen === "answer") {
        const res = rd.res[g.seat] || { correct: false, stolen: false };
        p.result = { answer: q.answer, notes: q.notes, correct: res.correct, stolen: res.stolen, typed: s.typed,
          by: res.correct ? owner : res.stolen ? other(owner) : null, pts: QMB.pointValue(rd, owner) };
      }
      if (s.screen === "roundScore") p.roundPts = [...rd.pts] as Two<number>;
      if (s.screen === "roundIntro") p.turn = p.first;
    }
    if (s.screen === "sudden" && g.sd) {
      p.question = g.sdReady ? g.sd.q.question : undefined;
      p.sudden = { ready: !!g.sdReady, shown: !!g.sd.shown, n: g.sd.n, answer: g.sd.shown ? g.sd.q.answer : undefined };
      p.buzz = s.sdBuzz; p.out = [...s.sdOut] as Two<boolean>;
      secret.qid = p.qid = g.sd.q.id; secret.answer = g.sd.q.answer; secret.notes = g.sd.q.notes;
    }
    /* the mini-games */
    const key: MiniKey | null = /^(mini|closest)/.test(s.screen) ? "closest" : /^flag/.test(s.screen) ? "flag" : /^dish/.test(s.screen) ? "dish" : null;
    if (key) {
      const m = key === "closest" ? g.mini : key === "flag" ? g.flagGame : g.dishGame;
      p.mini = { key, title: MINI_TITLES[key], leg: Math.min(m.i + 1, m.qs.length), of: m.base, wins: [...m.wins] as Two<number>, pts: g.miniPts, tie: m.i >= m.base };
      if (key === "dish") p.mini.kinds = m.levels.some((l: string) => l[0] === "c") && m.levels.some((l: string) => l[0] === "d") ? "Cocktails + dishes" : m.levels[0][0] === "c" ? "Cocktails" : "Dishes";
      if (/Summary$/.test(s.screen) && m.verdict) p.summary = { wins: [...m.wins] as Two<number>, winner: m.verdict.winner, needsHost: m.verdict.needsHost, note: m.verdict.note || "", award: m.award };
    }
    if (s.screen === "miniQ") p.question = q?.question;
    if (s.screen === "closestReveal" && q) {
      p.question = q.question;
      p.reveal = { answer: q.answer, guesses: s.guesses, w: closestWinner() };
    }
    if ((s.screen === "flagQ" || s.screen === "flagReveal") && q) p.flag = q.flag;
    if (s.screen === "flagReveal" && q) p.reveal = { answer: q.answer, typed: s.typed, ok: s.ok, w: flagW() };
    if ((s.screen === "dishQ" || s.screen === "dishReveal" || s.screen === "dishCheck") && q) {
      const L = g.dishGame.leg, shown = s.screen === "dishQ" ? L.shown : q.ings.length;
      p.dish = { kind: dishKind(q), ings: q.ings.slice(0, shown), n: q.ings.length };
      p.buzz = L.buzz; p.out = [...L.out] as Two<boolean>;
      if (s.screen === "dishReveal") { const sub = g.dishGame.subs[g.dishGame.subs.length - 1]; p.reveal = { answer: q.answer, typed: s.typed, w: sub?.winner ?? "none" }; }
    }
    return [p, secret];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  /* Closest: nearer wins; level, or nobody wrote anything, is a point each */
  const closestWinner = (): W => {
    const s = st.current, q = s.g.mini.qs[s.g.mini.i], [a, b] = s.guesses;
    if (a == null && b == null) return "tie";
    if (a == null) return 1;
    if (b == null) return 0;
    const ans = Number(q.answer), da = Math.abs(a - ans), db = Math.abs(b - ans);
    return da === db ? "tie" : da < db ? 0 : 1;
  };
  const flagW = (): W => { const [a, b] = st.current.ok; return a && b ? "tie" : a ? 0 : b ? 1 : "none"; };

  /* One write at a time, each built from the latest state when its turn
     comes. Two overlapping writes could otherwise land out of order and leave
     the phones a step behind the TV — and a host tap from a stale step is
     refused, which would freeze the game. */
  const chain = useRef<{ p: Promise<void>; queued: boolean }>({ p: Promise.resolve(), queued: false });
  const publish = useCallback(() => {
    const c = chain.current;
    if (c.queued) return c.p;              // a write that hasn't started yet will pick up this change too
    c.queued = true;
    c.p = c.p.then(async () => {
      c.queued = false;
      const v = view(); if (!v) return;
      setPub(v[0]);
      const s = st.current;
      try { localStorage.setItem(saveKey, JSON.stringify({ g: s.g, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, timeUp: s.timeUp, total: s.total,
        lifeline: s.lifeline, typed: s.typed, guesses: s.guesses, ok: s.ok, sdBuzz: s.sdBuzz, sdOut: s.sdOut })); } catch { /* full */ }
      const room = ctx.current.room;
      /* the answer first, so the host's phone never shows a new question with the old answer */
      await sb().from("secrets").update({ data: v[1] }).eq("room", code);
      await sb().from("rooms").update({ state: { ...(room?.state || {}), pub: v[0] } }).eq("code", code);
    }).catch((e) => console.error("publish failed", e));
    return c.p;
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
        s.screen = f.go; s.timeUp = false; s.left = 0; s.lifeline = null; s.deadline = null;
        /* a fresh question: nothing typed yet (a steal keeps the first team's answer to show at the reveal) */
        if (["ask", "roundIntro", "miniQ", "flagQ", "dishQ", "sudden"].includes(f.go)) { s.typed = [null, null]; s.guesses = [null, null]; s.ok = [null, null]; }
        if (f.go === "sudden") { s.sdBuzz = null; s.sdOut = [false, false]; }
        const secs = f.go === "ask" ? T_QUESTION : f.go === "steal" ? T_STEAL : f.go === "miniQ" ? T_CLOSEST : f.go === "flagQ" ? T_FLAG
          : f.go === "dishQ" ? dishTotal(s.g.dishGame.qs[s.g.dishGame.i]) : 0;
        if (secs) { s.deadline = now + secs * 1000; s.total = secs; }
        if (f.go === "flagQ") applyFx([{ used: s.g.flagGame.qs[s.g.flagGame.i] }]);
        if (f.go === "dishQ") applyFx([{ used: s.g.dishGame.qs[s.g.dishGame.i] }]);
        if (f.go === "miniQ") applyFx([{ used: s.g.mini.qs[s.g.mini.i] }]);
      }
      if (f.finalize) { s.screen = "final"; s.deadline = null; }
    }
  }, [used]);

  const play = useCallback((move: G) => {
    const s = st.current;
    if (!s.g || !s.bank) return;
    applyFx(QMB.play(s.g, move, env()));
  }, [applyFx, env]);

  /* the clock ran out, or every captain is in: show what they said */
  const reveal = useCallback(() => {
    const s = st.current, g = s.g;
    if (s.screen === "miniQ") { s.screen = "closestReveal"; s.deadline = null; s.left = 0; }
    else if (s.screen === "flagQ") {
      const q = g.flagGame.qs[g.flagGame.i];
      s.ok = [0, 1].map((t) => !!match(s.typed[t], q)) as Two<boolean>;
      s.screen = "flagReveal"; s.deadline = null; s.left = 0;
    }
  }, []);

  /* ---- the host's moves ---- */
  const hostMove = useCallback((move: G) => {
    const s = st.current, g = s.g;
    const t = move.type as string;
    if (t === "ui/closeLifeline") { s.lifeline = null; applyFx([{ timer: "resume" }]); }
    else if (t === "ui/timeUp") { s.deadline = null; s.left = 0; s.timeUp = true; }
    else if (t === "ui/pause") applyFx([{ timer: s.deadline ? "pause" : "resume" }]);
    else if (t === "ui/reveal") reveal();
    else if (t === "ui/flagOk") { const i = move.t === 1 ? 1 : 0; s.ok[i] = !s.ok[i]; }
    else if (t === "ui/next") {
      if (s.screen === "closestReveal") play({ type: "closest/win", w: closestWinner(), gA: s.guesses[0], gB: s.guesses[1] });
      else play({ type: "flag/verdict", w: flagW() });
    }
    else if (t === "ui/sdRight" && s.sdBuzz != null) play({ type: "sudden/win", w: s.sdBuzz });
    else if (t === "ui/sdWrong" && s.sdBuzz != null) {
      s.sdOut[s.sdBuzz] = true; s.typed[s.sdBuzz] = null; s.sdBuzz = null;
      if (s.sdOut[0] && s.sdOut[1]) play({ type: "sudden/win", w: "none" });
      else s.toast = { id: ++s.toastN, text: "Wrong — the other captain can have a go." };
    }
    else if (t === "dish/wrong") { const b = g.dishGame.leg.buzz; play(move); if (b != null) s.typed[b] = null; }
    else play(move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFx, play, reveal]);

  /* ---- a captain's moves: answers, buzzes, lifelines ---- */
  const captainMove = useCallback((kind: string, team: 0 | 1, p: G) => {
    const s = st.current, g = s.g, sc = s.screen;
    const rd = g.rounds[g.r];
    if (kind === "lifeline") {
      if (p.key === "dbl" && sc === "roundIntro") { play({ type: "round/armDbl", i: team }); return true; }
      if ((p.key === "friend" || p.key === "dip") && sc === "ask" && !s.lifeline && QMB.seatTeam(g, rd, g.seat, {}) === team) {
        const usedLl = rd.llUsed[team] || [];
        if (!g.teams[team].ll[p.key] || (rd.dbl[team] && usedLl.length >= 1)) return false;
        play({ type: "round/lifeline", key: p.key, i: team });
        /* Double Dip needs no pause card here: the captain's phone simply shows a second box */
        if (p.key === "dip") { s.lifeline = null; applyFx([{ timer: "resume" }]); }
        return true;
      }
      return false;
    }
    if (kind === "buzz") {
      if (sc === "dishQ") { const L = g.dishGame.leg; if (L.buzz != null || L.out[team]) return false; play({ type: "dish/buzz", w: team }); return true; }
      if (sc === "sudden" && g.sdReady && s.sdBuzz == null && !s.sdOut[team]) { s.sdBuzz = team; return true; }
      return false;
    }
    if (kind === "answer") {
      const texts = (Array.isArray(p.texts) ? p.texts : [p.text]).map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean);
      if (sc === "ask" || sc === "steal") {
        const owner = QMB.seatTeam(g, rd, g.seat, {}), turn = sc === "steal" ? other(owner) : owner;
        if (team !== turn || !texts.length) return false;
        const dip = sc === "ask" && (rd.llUsed[team] || []).includes("dip");
        s.typed[team] = texts.slice(0, dip ? 2 : 1); return true;
      }
      if (sc === "miniQ") {
        const n = Number(String(p.n ?? "").replace(/[\s,]/g, ""));
        if (!Number.isFinite(n) || s.guesses[team] != null) return false;
        s.guesses[team] = n;
        if (s.guesses[0] != null && s.guesses[1] != null) reveal();
        return true;
      }
      if (sc === "flagQ") {
        if (!texts.length || s.typed[team]) return false;
        s.typed[team] = texts.slice(0, 1);
        if (s.typed[0] && s.typed[1]) reveal();
        return true;
      }
      if (sc === "dishQ" && g.dishGame.leg.buzz === team && texts.length) { s.typed[team] = texts.slice(0, 1); return true; }
      if (sc === "sudden" && s.sdBuzz === team && texts.length) { s.typed[team] = texts.slice(0, 1); return true; }
    }
    return false;
  }, [applyFx, play, reveal]);

  /* ---- the inbox ---- */
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
      const diff = LEVELS[cfgIn.difficulty] ? cfgIn.difficulty : "mixed";
      const minis = (Array.isArray(cfgIn.minis) ? cfgIn.minis : []).filter((k: string) => ["closest", "flag", "dish"].includes(k));
      const cfg = { rounds: cfgIn.rounds || 6, themes: cfgIn.themes || [], difficulty: diff, standard: true,
        minis, flagLevels: LEVELS[diff].flag, dishLevels: LEVELS[diff].dish, teamA: team(0), teamB: team(1), picks: {} };
      const g = env().deal.buildGame(cfg);
      g.hostless = !members.some((m) => m.role === "host");
      s.g = g; s.screen = ""; s.lifeline = null; s.step = 1;
      g.rounds.forEach((r: G) => r.q.forEach((q: G) => applyFx([{ used: q }])));
      play({ type: "game/start" });
      await sb().from("rooms").update({ status: "playing", mode: g.hostless ? "nohost" : "host" }).eq("code", code);
      await publish();
      return;
    }
    if (!s.g || !from) return;
    if (a.kind === "judge" && from.role === "host") {
      const move = (a.payload.move || {}) as G;
      /* a tap made on an earlier screen (a double tap, a slow phone) is ignored */
      if (a.payload.step !== s.step) return;
      const where = HOST_MOVES[move.type];
      if (!where || (where !== "*" && !(Array.isArray(where) ? where : [where]).includes(s.screen))) return;
      s.step++;
      hostMove(move);
      await publish();
      return;
    }
    if (["answer", "buzz", "lifeline"].includes(a.kind) && from.role === "captain" && (from.team === 0 || from.team === 1)) {
      /* no step bump: a captain typing doesn't change what the host is deciding,
         and bumping would turn the host's next tap into a "stale" one */
      if (captainMove(a.kind, from.team, a.payload as G)) await publish();
    }
  }, [applyFx, captainMove, code, env, hostMove, play, publish]);

  /* restore a game in progress after a refresh of the TV */
  useEffect(() => {
    if (!isTv) return;
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (saved?.g) { Object.assign(st.current, saved); void loadBank().then((b) => { st.current.bank = b; setPub(view()?.[0] || null); }); }
    } catch { /* nothing saved */ }
  }, [isTv, saveKey, view]);

  /* the inbox: everything since the last action handled on this TV, in the
     order the server received it — that order decides who buzzed first */
  useEffect(() => {
    if (!isTv) return;
    const key = "qmb.tv." + code + ".last";
    let last = Number(localStorage.getItem(key) || 0), busy = false;
    const drain = async () => {
      if (busy) return; busy = true;
      try {
        const { data } = await sb().from("actions").select("*").eq("room", code).neq("kind", "suggest").gt("id", last).order("id");
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

  /* the clocks. A standard question running out is only "time's up" — the
     host still judges. Closest and Flag reveal; a dish leg ends. The dish
     ingredients come up one every few seconds while its clock runs. */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current, now = Date.now();
      if (!s.g) return;
      if (s.screen === "dishQ" && s.deadline) {
        const q = s.g.dishGame.qs[s.g.dishGame.i], L = s.g.dishGame.leg;
        const want = Math.min(q.ings.length, 1 + Math.floor((s.total - (s.deadline - now) / 1000) / DISH_STEP + 1e-6));
        if (want > L.shown) { L.shown = want; void publish(); }
      }
      if (s.deadline && now >= s.deadline) {
        s.deadline = null;
        if (s.screen === "miniQ" || s.screen === "flagQ") { s.step++; reveal(); }
        else if (s.screen === "dishQ") { s.step++; play({ type: "dish/timeUp" }); }
        else s.timeUp = true;
        void publish();
      }
      if (s.lifeline?.deadline && now >= s.lifeline.deadline) { s.lifeline = { ...s.lifeline, deadline: null }; void publish(); }
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish, play, reveal]);

  return { pub, game: st.current.g as G };
}
