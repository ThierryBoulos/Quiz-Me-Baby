"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, HOST_ONLY_THEMES, acceptFor, forNoHost, hostOnly, mapHit, mapKeysFor, loadBank, withCustom, type Bank, type Q } from "./engine";
import { cleanList, getCustom, mergeCustom } from "./custom";
import { sb } from "./supabase";
import { playSound, type SoundName } from "./sound";
import { cleanSettings, forgetUsed, getSettings, saveSettings, usedCount, USED_KEY } from "./settings";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD || "dev";
/* The shape of the saved game. Bump it whenever a change means a game saved before it can't be
   carried on (new required state, renamed screens, a changed engine game object): a TV reloaded
   onto the new version then says so and offers Exit, instead of playing on with a broken game. */
const SAVE_SHAPE = 1;
import { cap1, notReadyWhy, readyToStart, starter, type Member, type Room } from "./room";
import { BEAT_MS, BEAT_SCREENS, DECIDED, FLY_MS, flyAt, iso, MAX_BID, MINI_TITLES, PARTY_LEGS, T_AWAY, T_GRACE_MS, T_LOBBY_AWAY, T_NEXT_FALLBACK, T_AGREE,
  type MiniKey, type Pub, type Secret, type Thin, type Two } from "./game";
import { CAPTAIN_MOVES, NEXT_MOVES, SD_CONTEST, DIFFS, cleanDiff, HOST_MOVES, PARTY_MINIS, PREFIX, SAME_SCREEN, T, TIES, WAITS_FOR_NEXT, asPin, dishTotal, inScreen, levels, miniOf, miniState,
  other, serverMs, SWAPS, swapWord, type Action, type G, type PKind, type W } from "./tv/rules";
import { callsOf, closestW, currentQ, leadOf, matchQ, mrTally, okWin, sayWin, turnOf } from "./tv/reads";
import { buildView, qk } from "./tv/view";
import { useInbox } from "./tv/useInbox";
import { usePresent } from "./tv/usePresent";
import { imadNarrate, imadSay } from "./tv/imad";
import { newState, type TvState } from "./tv/state";

/* sudden death or the tie-breaker: an answer and its call, noted; once the question is decided (a
   right one, or both out) it's the one whose calls can be contested on the next screen. (true: go on) */
/* the dealer over a bank, with what this TV has played (sudden death is typed and checked fast: never a
   question only a person can judge, host or not) */
function dealerFor(bank: Bank, used: () => Set<string>) {
  return QMB.createDealer({ bank: () => bank.bank, used, noRepeat: () => getSettings().noRepeat, suddenOk: (q: Q) => !hostOnly(q),
    ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish",
      pin: (q: G) => q.type === "pin" && Number.isFinite(q.lat) && Number.isFinite(q.lon) && !!q.photo,
      airport: (q: G) => q.type === "airport" && Array.isArray(q.board) && q.board.length > 0,
      majority: (q: G) => q.type === "majority" && Array.isArray(q.options) && q.options.length === 4 && q.options.includes(q.answer) } });
}

/* a browser that can play sound at all (the simulator can't: no timers for sounds there) */
const canPlay = () => typeof window !== "undefined" && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

function sdRecord(s: TvState, team: 0 | 1, ok: boolean) {
  s.sdCur = [...s.sdCur, { team, text: (s.typed[team] || []).join(" / "), ok }];
  if (ok || s.sdOut[other(team)]) { s.sdLog = { kind: s.screen === "battleTie" ? "battleTie" : "sudden", calls: s.sdCur }; s.contested = []; s.contest = null; }
  return true;
}

/* THE TV RUNS THE NIGHT. It holds the game, plays every move through the
   shared engine (exactly as Classic does), carries out what the engine says
   — screens, clocks, pop-ups — and publishes a view for the phones. It is the
   only device that writes the room, and it checks who sent each action.
   With no host, the TV is the host too: it checks answers, runs the clocks
   and moves the night along, and the captains referee each other. */
/* the clocks stood still for d ms (the TV was asleep, offline, or without its questions): every moment
   the game is waiting for moves on by that much */
function shiftClocks(s: TvState, d: number) {
  if (s.pending) s.pending = { ...s.pending, until: s.pending.until + d };
  if (s.lifeline?.deadline) s.lifeline = { ...s.lifeline, deadline: s.lifeline.deadline + d };
  if (s.autoAt) s.autoAt += d;
  if (s.waitSince) s.waitSince += d;
  if (s.buzzAt) s.buzzAt += d;
  if (s.agree) s.agree = { ...s.agree, until: s.agree.until + d };
  if (s.deadline) s.deadline += d;
}

export function useTvGame(code: string, isTv: boolean, room: Room | null, members: Member[]) {
  const ctx = useRef({ room, members });
  ctx.current = { room, members };
  const st = useRef<TvState>(newState());
  const [pub, setPub] = useState<Pub | null>(null);
  const isTvRef = useRef(isTv);
  isTvRef.current = isTv;
  const saveKey = "qmb.tv." + code + ".game", usedKey = USED_KEY;
  /* who answers first: fixed for the whole game when it starts (Settings → alternate) */
  const seat = () => ({ alternateFirst: !!st.current.g?.alternateFirst });

  /* questions already played on this TV (kept in memory too, for a browser that won't store anything) */
  const usedMem = useRef(new Set<string>());
  const used = useCallback((): Set<string> => {
    try { return new Set([...JSON.parse(localStorage.getItem(usedKey) || "[]"), ...usedMem.current]); } catch { return new Set(usedMem.current); }
  }, []);
  const env = useCallback(() => {
    const bank = st.current.bank!;
    return { deal: dealerFor(bank, used), settings: seat() };
  }, [used]);

  /* the lobby: game types nearly out of unplayed questions (the "bank is getting thin" note, on the TV
     and the host's Setup); worked out again whenever the settings or the played list change here */
  const [thin, setThin] = useState<Thin[]>([]);
  const status = room?.status;
  useEffect(() => {
    if (!isTv || status !== "lobby") return;
    let live = true;
    const check = () => { void loadBank(code).then((b) => { if (live) setThin(dealerFor(b, used).thinBank(PARTY_LEGS)); }).catch(() => { /* no note, then */ }); };
    check();
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === USED_KEY || e.key.startsWith("qmb.party.")) check(); };
    window.addEventListener("qmb:settings", check); window.addEventListener("qmb:custom", check); window.addEventListener("storage", onStorage);
    return () => { live = false; window.removeEventListener("qmb:settings", check); window.removeEventListener("qmb:custom", check); window.removeEventListener("storage", onStorage); };
  }, [isTv, status, code, used]);
  /* every question played on this TV counts as new again (its Settings page has the same button) */
  const resetPlayed = useCallback(() => { forgetUsed(); usedMem.current.clear(); window.dispatchEvent(new Event("qmb:settings")); }, []);

  /* what the state says: the question in play, whose turn, who won the leg on screen (lib/tv/reads.ts) */
  const current = useCallback((): G => currentQ(st.current), []);
  const leadTeam = (): 0 | 1 => leadOf(ctx.current.members);
  const turnTeam = (): 0 | 1 => turnOf(st.current);
  const closestWinner = (): W => closestW(st.current);
  const sayW = (): W => sayWin(st.current);
  const okW = (): W => okWin(st.current);

  /* ---- what the phones see (lib/tv/view.ts) ---- */
  const view = useCallback((): [Pub, Secret] | null => buildView(st.current, ctx.current.members), []);

  /* One write at a time, each built from the latest state when its turn comes. Each carries a
     stamp (state.pubAt, also pub.at), always later than the last, and the database only takes a
     write newer than what it holds: two writes that land out of order can't leave the phones a
     step behind (a host tap from a stale step is refused, which would freeze the game). So a write
     the server sits on doesn't hold up the next: after 2 s the next goes out beside it, and the held
     one, if it lands at all, is turned down (20 Oct: one update held 15 s kept five ingredients
     of a recipe back, and they all appeared at once). */
  const chain = useRef<{ p: Promise<void>; queued: boolean }>({ p: Promise.resolve(), queued: false });
  const lastSecret = useRef(""), lastSave = useRef(""), offline = useRef(false), lastAt = useRef(0), resent = useRef(0);
  const stamp = () => (lastAt.current = Math.max(Date.now(), lastAt.current + 1));
  /* a line across the TV when something's wrong that the room should know about */
  const [banner, setBanner] = useState<null | "offline" | "cantSave" | "oldSave" | "noBank">(null);
  const bankRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const offlineAt = useRef(0);                          // when the phones stopped hearing from this TV (the clocks wait)
  /* the lobby: why a Start didn't start (a captain left a second ago) */
  const [lobbyNote, setLobbyNote] = useState<string | null>(null);
  useEffect(() => { if (!lobbyNote) return; const t = setTimeout(() => setLobbyNote(null), 6000); return () => clearTimeout(t); }, [lobbyNote]);
  /* why a Start didn't start: on the TV, and written to the room, so the phone that tapped gets it as its reply
     instead of "The TV hasn't answered" (29 Oct) */
  const sayLobby = useCallback((text: string) => {
    setLobbyNote(text);
    const room = ctx.current.room; if (!room) return;
    void sb().from("rooms").update({ state: { ...lobbyState(room), note: { text, at: Date.now() } } }).eq("code", code).then(() => {}, () => {});
  }, [code]);
  const pubN = useRef(0);                             // publishes so far (a tap with none after it still gets a reply)
  /* The lobby's team names and who's away, as this TV last wrote them. Two writes a beat apart (both
     captains naming their teams in the same second) must each build on the other, not on a room the
     push hasn't brought back yet: on 20 Oct the second name overwrote the first. */
  const lobbyMine = useRef<{ teamNames?: [string, string]; away?: string[] }>({});
  /* (and the newest stamp: a lobby write made before the TV has read back its own Play again must not carry the old one, which the phones would take for an old room) */
  const lobbyState = (room: Room) => ({ ...room.state, ...lobbyMine.current, pubAt: Math.max(Number(room.state?.pubAt) || 0, lastAt.current) || undefined });
  const publish = useCallback(() => {
    pubN.current++;
    /* this TV shows the change at once; the phones get it with the next write */
    const now = view(); if (now) { now[0].at = Date.now(); setPub(now[0]); }
    const c = chain.current;
    if (c.queued) return c.p;              // a write that hasn't started yet will pick up this change too
    c.queued = true;
    /* The phones didn't get it (Wi-Fi dropped, the server hiccupped): say so on the TV and keep
       trying, so a reveal or a final screen with nothing after it still reaches everyone. */
    const failed = (e: unknown) => {
      console.error("publish failed", e);
      if (!offline.current) offlineAt.current = Date.now();
      offline.current = true; setBanner((b) => b ?? "offline");
      setTimeout(() => void publishRef.current(), 2000);
    };
    c.p = c.p.then(async () => {
      c.queued = false;
      const v = view(); if (!v) return;
      const at = stamp();
      v[0].at = at;
      setPub(v[0]);
      const s = st.current;
      /* the game, kept on this laptop so a refresh picks it up (only written when it changed);
         stamped with the app's version, so an update mid-night can't load a game it doesn't understand */
      try {
        if (s.exit) { localStorage.removeItem(saveKey); lastSave.current = ""; }
        else {
          const save = JSON.stringify({ build: BUILD_ID, shape: SAVE_SHAPE, g: s.g, nohost: s.nohost, step: s.step, screen: s.screen, deadline: s.deadline, left: s.left, timeUp: s.timeUp,
            total: s.total, lifeline: s.lifeline, typed: s.typed, guesses: s.guesses, pins: s.pins, mrList: s.mrList, mrOut: s.mrOut, mrAsk: s.mrAsk, agree: s.agree, votes: s.votes, ok: s.ok, sdBuzz: s.sdBuzz, sdOut: s.sdOut, pending: s.pending, autoAt: s.autoAt, paused: s.paused, custom: s.custom, waitSince: s.waitSince, flags: s.flags, flagN: s.flagN, tvAway: s.tvAway, awayPaused: s.awayPaused, bids: s.bids,
            app: s.app, buzzAt: s.buzzAt, late: s.late, lastAns: s.lastAns, decided: s.decided, contest: s.contest, contested: s.contested, legLog: s.legLog, drafts: s.drafts, sdCur: s.sdCur, sdQ: s.sdQ, sdLog: s.sdLog, offList: s.offList, qkeys: s.qkeys, scoreLog: s.scoreLog });
          if (save !== lastSave.current) { localStorage.setItem(saveKey, save); lastSave.current = save; }
        }
      } catch { setBanner("cantSave"); }
      const room = ctx.current.room;
      /* the answer and the screen go out together (the host's phone shows "Getting the answer…" until
         an answer for this very step lands), and the answer only when it changed: a +1, a pause,
         a ruling leave it as it was — one write, not two */
      const sec = JSON.stringify(v[1]), withSecret = sec !== lastSecret.current;
      const writes = [sb().from("rooms").update({ state: { ...(room?.state || {}), pub: v[0], pubAt: at } }).eq("code", code)
        .or(`state->>pubAt.is.null,state->>pubAt.lt.${at}`).select("code")];
      if (withSecret) writes.push(sb().from("secrets").update({ data: { ...v[1], at } }).eq("room", code)
        .or(`data.is.null,data->>at.is.null,data->>at.lt.${at}`).select("room"));
      const done = Promise.all(writes).then(async (res) => {
        const bad = res.find((r) => r.error);
        if (bad) throw bad.error;
        resent.current = 0;
        const latest = lastAt.current === at;
        if (withSecret && latest) lastSecret.current = sec;
        /* turned down while it's this TV's latest: the room holds a later stamp than this TV has (its
           clock went back, or it reloaded and its clock is behind the last one's): go on from there */
        if (latest && !res[0].data?.length) {
          const r = await sb().from("rooms").select("state").eq("code", code).maybeSingle();
          const theirs = Number((r.data?.state as { pubAt?: number } | undefined)?.pubAt) || 0;
          if (theirs >= at) { lastAt.current = Math.max(lastAt.current, theirs); setTimeout(() => void publishRef.current(), 0); }
        }
        /* back: the clocks stood still meanwhile (29 Oct: a 30 s drop with no host used to run a question out,
           though no phone could deliver its answer), so they move on by that much, and go out with the next write */
        if (offline.current) { offline.current = false; shiftClocks(st.current, Date.now() - offlineAt.current); setBanner((b) => (b === "offline" ? null : b)); setTimeout(() => void publishRef.current(), 0); }
      });
      let wait: ReturnType<typeof setTimeout> | undefined;
      const held = await Promise.race([done.then(() => false), new Promise<boolean>((r) => { wait = setTimeout(() => r(true), 2000); })]);
      clearTimeout(wait);
      if (held) {
        done.catch(failed);                          // (it can still fail later: then it's said, and tried again)
        /* nothing gone out since: the same screen goes again (23 Oct: a Majority Rules reveal at time-up, with
           nothing after it, left the phones on a clock 8 s past zero while the server sat on that one write);
           three times at most, till one lands, so a server that hangs on everything isn't sent a pile */
        if (lastAt.current === at && resent.current < 3) { resent.current++; setTimeout(() => void publishRef.current(), 0); }
      }
    }).catch(failed);
    return c.p;
  }, [code, saveKey, view]);
  const publishRef = useRef(publish);
  publishRef.current = publish;

  /* ---- Imad, the MC (lib/tv/imad.ts) ---- */
  const say = (moments: string[] | string, extra?: G) => imadSay(st.current, moments, extra);
  const narrate = () => imadNarrate(st.current);

  /* ---- carrying out what the engine says ---- */
  const applyFx = useCallback((fx: G[]) => {
    const s = st.current, now = Date.now();
    /* a move that brings up a reveal with a drumroll: its right/wrong chime waits for the drumroll's hit, and the
       point chime for the points landing on the score (lib/game.ts, BEAT_MS); a summary's points fly up too */
    const goes = (fx || []).map((f) => f.go).filter(Boolean) as string[];
    const beat = goes.some((g) => BEAT_SCREENS.includes(g)), sum = goes.find((g) => /Summary$|^auctionResult$/.test(g));
    const soundAt = (n: string) => (beat && (n === "correct" || n === "wrong") ? BEAT_MS : n === "point" && (beat || sum) ? flyAt(beat ? "answer" : sum!) + FLY_MS : 0);
    for (const f of fx || []) {
      if (f.timer === "stop") { s.deadline = null; s.left = 0; }
      /* (a clock paused in its unseen second after 0 keeps a sliver, so Resume brings it back and it closes:
         with nothing left it would be neither running nor paused, and the question would never end) */
      else if (f.timer === "pause" && s.deadline) { s.left = Math.max(0.05, (s.deadline - now) / 1000); s.deadline = null; }
      else if (f.timer === "resume" && s.left) { s.deadline = now + s.left * 1000; s.left = 0; }
      if (f.used) { usedMem.current.add(f.used.id); try { const u = used(); localStorage.setItem(usedKey, JSON.stringify([...u])); } catch { /* kept in memory */ } }
      if (f.lifeline) {
        const rd = s.g.rounds[s.g.r];
        s.lifeline = { key: f.lifeline, team: QMB.seatTeam(s.g, rd, s.g.seat, seat()), deadline: null, ...(f.lifeline === "friend" ? { left: T().tFriend, wait: true } : {}) };   // the friend's clock starts with the call (Start the call)
      }
      if (f.toast) s.toast = { id: ++s.toastN, text: f.toast };
      if (f.host) say(f.host, f.vars);
      if (f.sound && isTvRef.current) { const n = f.sound as SoundName, ms = soundAt(n); if (ms && canPlay()) setTimeout(() => playSound(n), ms); else playSound(n); }
      if (f.go && isTvRef.current) {
        if (f.go === "roundIntro" || /Intro$/.test(f.go) || (f.go === "sudden" && !s.g.sdReady)) { playSound("whoosh"); playSound("jingle"); }
        else if (f.go === "answer" || f.go === "dishReveal" || f.go === "auctionLeg") playSound("drumroll");
      }
      if (f.go) {
        const was = s.screen;
        s.screen = f.go; s.timeUp = false; s.left = 0; s.lifeline = null; s.deadline = null; s.pending = null; s.autoAt = null; s.paused = false; s.waitSince = now; s.contest = null; s.contested = [];
        /* a fresh question: nothing typed yet (a steal keeps the first team's answer to show at the reveal) */
        if (["ask", "roundIntro", "miniQ", "flagQ", "dishQ", "mapQ", "sudden", "sayQ", "pinQ", "airportQ", "majorityQ", "battleQ", "battleTie"].includes(f.go)) { s.typed = [null, null]; s.guesses = [null, null]; s.pins = [null, null]; s.votes = {}; s.ok = [null, null]; s.app = [null, null]; s.buzzAt = 0; s.late = null; s.drafts = [null, null]; }
        if (f.go === "dishQ") s.legLog = [];
        if (f.go === "sudden" || f.go === "battleTie") {
          const n = (f.go === "sudden" ? s.g.sd?.n : s.g.battle?.tb?.n) || 0;
          /* sudden death starting, or the first tie-breaker: no question decided yet; the next question
             (not the same one swapped): the last one's calls, however it ended (time up with none is none) */
          if ((f.go === "sudden" && !s.g.sdReady) || (f.go === "battleTie" && was !== "battleTie")) s.sdLog = null;
          else if (was === f.go && n !== s.sdQ) s.sdLog = { kind: f.go, calls: s.sdCur };
          s.sdBuzz = null; s.sdOut = [false, false]; s.sdCur = []; s.sdQ = n;
        }
        const g = s.g;
        const secs = f.go === "ask" ? T().tQuestion : f.go === "steal" ? T().tSteal : f.go === "miniQ" ? T().tMini : f.go === "flagQ" ? T().tFlag
          : f.go === "mapQ" ? T().tMap : f.go === "auctionRun" ? T().tAuction : f.go === "pinQ" ? T().tPin : f.go === "airportQ" ? T().tAirport : f.go === "majorityQ" ? T().tMajority
          : f.go === "dishQ" ? dishTotal(g.dishGame.qs[g.dishGame.i])
          : f.go === "sayQ" ? T().tSay : f.go === "battleQ" ? (s.nohost ? T().tBattleTyped : T().tBattleHost)
          : ((f.go === "sudden" && g.sdReady) || f.go === "battleTie") && s.nohost ? T().tSudden : 0;
        if (secs) { s.deadline = now + secs * 1000; s.total = secs; }
        if (f.go === "flagQ") applyFx([{ used: g.flagGame.qs[g.flagGame.i] }]);
        if (f.go === "dishQ") applyFx([{ used: g.dishGame.qs[g.dishGame.i] }]);
        if (f.go === "miniQ") applyFx([{ used: g.mini.qs[g.mini.i] }]);
        if (f.go === "mapQ") applyFx([{ used: g.mapGame.qs[g.mapGame.i] }]);
        if (f.go === "sayQ") applyFx([{ used: g.saySame.qs[g.saySame.i] }]);
        if (f.go === "pinQ") applyFx([{ used: g.pinGame.qs[g.pinGame.i] }]);
        if (f.go === "airportQ") applyFx([{ used: g.airportGame.qs[g.airportGame.i] }]);
        if (f.go === "majorityQ") applyFx([{ used: g.majorityGame.qs[g.majorityGame.i] }]);
      }
      if (f.finalize) { s.contest = null; s.screen = "final"; s.deadline = null; s.autoAt = null; s.pending = null; if (isTvRef.current) playSound("win"); }
    }
    /* the TV is asleep: a clock that started meanwhile (the steal, after an answer) waits with the rest */
    if (s.tvAway && s.deadline) { s.left = Math.max(0, (s.deadline - now) / 1000); s.deadline = null; s.paused = true; s.awayPaused = true; }
  }, [used]);

  const play = useCallback((move: G) => {
    const s = st.current;
    if (!s.g || !s.bank) return;
    /* the Battle: the answer goes up once the question is settled ("Answer: X") */
    const b = s.g.battle;
    if (b && move.type === "battle/mark") { const q = b.qs[b.cap]?.[b.i]; if (q) s.lastAns = { answer: q.answer, got: !!move.got }; }
    else if (b && move.type === "battle/tbWin" && b.tb?.q) s.lastAns = { answer: b.tb.q.answer, got: move.w !== "none" };
    else if (move.type === "battle/start" && s.screen === "battleIntro") s.lastAns = null;
    const was = s.screen;
    /* won with legs to spare: ask first (keep playing for fun, or stop here) — the Auction before its next leg */
    const ask = (key: MiniKey) => {
      const d = QMB.decidedEarly(s.g, key);
      if (!d) return false;
      s.decided = { key, winner: d.winner, spare: d.spare };
      s.screen = DECIDED; s.deadline = null; s.left = 0; s.total = 0; s.timeUp = false; s.paused = false; s.waitSince = Date.now(); s.toast = null;
      return true;
    };
    if (move.type === "auction/nextLeg" && ask("auction")) { narrate(); return; }
    applyFx(QMB.play(s.g, move, env()));
    if (/^(closest\/win|say\/verdict|flag\/verdict|map\/verdict|dish\/next|pin\/settle|airport\/verdict)$/.test(move.type)) {
      const k: MiniKey = move.type.startsWith("closest") ? "closest" : move.type.startsWith("say") ? "saysame" : move.type.startsWith("flag") ? "flag" : move.type.startsWith("map") ? "map"
        : move.type.startsWith("pin") ? "pin" : move.type.startsWith("airport") ? "airport" : "dish";
      if (ask(k)) { narrate(); return; }
    }
    /* level at the end: stop and ask before a tie-breaker (see TIES); the Battle too, unless the host just asked for another */
    const g = s.g, tie = Object.entries(TIES).find(([, x]) => x.q === s.screen);
    const level = (screen: string) => {      // the screen itself says "Level at N each"
      s.screen = screen; s.deadline = null; s.left = 0; s.total = 0; s.timeUp = false; s.paused = false; s.waitSince = Date.now(); s.toast = null;
    };
    if (tie && /^(closest\/win|say\/verdict|flag\/verdict|pin\/settle|airport\/verdict|majority\/settle)$/.test(move.type)) { const m = miniState(g, tie[1].key); if (m && m.i >= m.base) level(tie[0]); }
    if (s.screen === "battleTie" && (was === "battleQ" || (move.type === "battle/tbWin" && !move.byHost))) level("battleLevel");
    narrate();
    /* no host: the table's calls that a host would make, made at once */
    if (!s.nohost) return;
    if (/Summary$/.test(s.screen)) {
      const k = miniOf(s.screen), m = miniState(g, k);
      if (k && m?.verdict?.needsHost) play({ type: PREFIX[k] + "/award", w: "split" });
    }
  }, [applyFx, env]);

  /* the clock ran out, or every captain is in: show what they said */
  const reveal = useCallback(() => {
    const s = st.current, g = s.g;
    if (s.screen === "miniQ") s.screen = "closestReveal";
    else if (s.screen === "pinQ") s.screen = "pinReveal";
    else if (s.screen === "majorityQ") s.screen = "majorityReveal";
    else if (s.screen === "flagQ" || s.screen === "airportQ") {
      const flag = s.screen === "flagQ", q = flag ? g.flagGame.qs[g.flagGame.i] : g.airportGame.qs[g.airportGame.i];
      s.ok = [0, 1].map((t) => !!matchQ(s.typed[t], q)) as Two<boolean>;
      s.app = [...s.ok] as Two<boolean>;
      s.screen = flag ? "flagReveal" : "airportReveal";
    } else if (s.screen === "sayQ") {
      /* dodged = wrote a real answer to the prompt (one on its list, typos allowed), and it isn't the
         app's word. Anything else — nothing, gibberish, an answer the list doesn't have — counts as
         SAID IT (the other captain can still give a fair answer the list missed). */
      const q = g.saySame.qs[g.saySame.i];
      const real = (texts: string[] | null) => !!texts && texts.some((t) => (q.pool || []).some((w: string) => QMB.isMatch(t, w, acceptFor({ answer: w }))));
      s.offList = [0, 1].map((t) => !!s.typed[t] && !real(s.typed[t])) as Two<boolean>;
      s.ok = [0, 1].map((t) => !!s.typed[t] && !s.offList[t] && !matchQ(s.typed[t], q)) as Two<boolean>;
      s.app = [...s.ok] as Two<boolean>;
      s.screen = "sayReveal";
    } else if (s.screen === "mapQ") {
      /* the idea counts, not the exact words: the map's title and its short forms ("Landlocked",
         "Vikings") are accepted; what the app misses, the captains (or the host) can contest */
      const q = g.mapGame.qs[g.mapGame.i];
      const ok = (x: string[] | null) => !!x && x.some((t) => QMB.isMatch(t, q.answer, [...acceptFor(q), q.question]) || mapHit(t, mapKeysFor(q)));
      s.ok = [ok(s.typed[0]), ok(s.typed[1])];
      s.app = [...s.ok] as Two<boolean>;
      s.screen = "mapReveal";
    } else return;
    s.deadline = null; s.left = 0; s.paused = false;
    playSound("drumroll");
    s.autoAt = null;
  }, []);

  /* No host: the app's call on what a captain sent, at once. It can be contested afterwards, where
     the calls are shown (the answer card after the steal, the reveals, the Battle review). */
  const settle = useCallback((flip: boolean) => {
    const s = st.current, P = s.pending;
    if (!P) return;
    s.pending = null;
    const v = P.v || flip;
    if (P.kind === "ask") play({ type: "round/judge", v });
    else if (P.kind === "steal") {
      /* a steal with the very answer the first team gave (a typo apart): the point is theirs
         (not on a new question: then the first team's answer was to another one) */
      const res = s.g.rounds[s.g.r]?.res?.[s.g.seat];
      const first = s.typed[other(P.team)], same = v && !res?.fresh && !!first && (s.typed[P.team] || []).some((t) => first.some((f) => QMB.isMatch(t, f)));
      if (same) s.toast = { id: ++s.toastN, text: `Same answer as ${iso(s.g.teams[other(P.team)].name)}: the point is theirs.` };
      play({ type: "round/judgeSteal", v, back: same });
    }
    else if (P.kind === "dish") { s.legLog = [...s.legLog, { team: P.team, text: P.text, ok: v }]; play({ type: v ? "dish/right" : "dish/wrong" }); if (!v) s.typed[P.team] = null; }
    else if (P.kind === "battle") play({ type: "battle/mark", got: v, said: P.text, review: s.nohost });
    else if (P.kind === "sudden" || P.kind === "battleTie") {
      const tb = P.kind === "battleTie";
      sdRecord(s, P.team, v);
      if (v) play(tb ? { type: "battle/tbWin", w: P.team } : { type: "sudden/win", w: P.team });
      else {
        s.sdOut[P.team] = true; s.typed[P.team] = null; s.sdBuzz = null; s.buzzAt = 0;
        if (s.sdOut[0] && s.sdOut[1]) play(tb ? { type: "battle/tbWin", w: "none" } : { type: "sudden/win", w: "none" });
        else { s.toast = { id: ++s.toastN, text: "Wrong. The other captain can buzz." }; s.deadline = Date.now() + T().tSudden * 1000; }
      }
    }
  }, [play]);

  /* ---- contests: the app's call on an answer, looked at again ---- */
  /* the question on screen as the phones know it (pub.qid, and the screen): a draft for anything else is old */
  const draftKey = useCallback(() => { const s = st.current, q = currentQ(s); return q ? `${qk(s, q.id)}|${s.screen}` : ""; }, []);
  const capName = (t: 0 | 1) => ctx.current.members.find((m) => m.team === t && m.role === "captain")?.name || st.current.g?.teams[t]?.name || "";
  /* a tap held while a contest is open: who's deciding it (and, with no host, for how long yet) */
  const contestWait = useCallback(() => {
    const s = st.current, K = s.contest!, by = iso(s.g.teams[K.by].name);
    const cap = ctx.current.members.find((m) => m.team === other(K.by) && m.role === "captain")?.name || s.g.teams[other(K.by)].name;
    return s.nohost ? `Wait: ${iso(cap)} is deciding ${by}'s contest (${Math.max(1, Math.ceil((K.until - Date.now()) / 1000))} s).` : `Wait: the host is deciding ${by}'s contest.`;
  }, []);
  const verdictWord = (sc: string, ok: boolean) => (sc === "sayReveal" ? (ok ? "DODGED IT" : "SAID IT") : ok ? "RIGHT" : "WRONG");
  /* a call changed: the score moves with it (or, a RIGHT turned down with no steal played, a steal on a new question) */
  const applyCall = useCallback((id: string, v: boolean) => {
    const s = st.current, g = s.g, sc = s.screen;
    if (sc === "answer" && (id === "first" || id === "steal")) {
      const res = g.rounds[g.r]?.res?.[g.seat];
      if (!res) return;
      play({ type: "round/rule", line: id, v });
      if (id === "first" && !v && !res.steal && !res.fresh) { s.step++; play({ type: "round/freshSteal" }); }
    } else if ((sc === "flagReveal" || sc === "sayReveal" || sc === "mapReveal" || sc === "airportReveal") && /^t[01]$/.test(id)) {
      const t = Number(id[1]) as 0 | 1;
      s.ok[t] = v;
      s.toast = { id: ++s.toastN, text: `Call changed: ${iso(g.teams[t].name)} ${verdictWord(sc, v)}.` };
    } else if (sc === "dishReveal" && /^d\d+$/.test(id)) {
      const i = Number(id.slice(1)), L = s.legLog;
      if (!L[i]) return;
      s.legLog = L.map((e, k) => (k === i ? { ...e, ok: v } : e));
      const right = s.legLog.find((e) => e.ok), w = right ? right.team : "none";
      const was = g.dishGame.subs[g.dishGame.subs.length - 1]?.winner;
      /* the winning call turned down, and the other team never had its go: a new one for both */
      if (w === "none" && (was === 0 || was === 1) && !s.legLog.some((e) => e.team === other(was))) { s.step++; play({ type: "dish/replay" }); }
      else play({ type: "dish/rule", w });
    } else if (sc === "battleReview" && /^b[01]-\d+$/.test(id)) {
      const [cap, i] = id.slice(1).split("-").map(Number);
      play({ type: "battle/rule", cap, i, got: v });
      s.toast = { id: ++s.toastN, text: `Call changed: ${iso(g.teams[cap].name)}'s answer ${i + 1} is ${v ? "RIGHT" : "WRONG"}.` };
    } else if (/^s\d+$/.test(id) && s.sdLog?.calls[Number(id.slice(1))]) {
      /* sudden death / the tie-breaker: the first right answer (in the order they came) takes it; nobody right
         after all, another question */
      const i = Number(id.slice(1)), L = s.sdLog, tb = L.kind === "battleTie";
      const calls = L.calls.map((e, k) => (k === i ? { ...e, ok: v } : e)), right = calls.find((e) => e.ok), w = right ? right.team : "none";
      const was = tb ? (g.battle?.stage === "done" ? g.battle.winner : null) : g.winner;
      s.sdLog = w === "none" ? null : { ...L, calls };
      if (w === "none") s.sdCur = [];
      s.step++;
      play(tb ? { type: "battle/tbRule", w } : { type: "sudden/rule", w });
      s.toast = { id: ++s.toastN, text: !right ? "Call changed: nobody was right. Another question."
        : right.team === was ? `Call changed, but ${iso(g.teams[was].name)} were right first: it stands.`
        : `Call changed: ${iso(g.teams[right.team].name)} ${tb ? "take the tie-breaker" : "win the night"}.` };
    }
  }, [play]);

  /* agree: the call changes; not agreed (or no answer in time): the app's call stands */
  const closeContest = useCallback((agree: boolean, byHost: boolean, late = false) => {
    const s = st.current, C = s.contest;
    if (!C || !s.g) return;
    s.contest = null; s.contested = [...s.contested, C.id];
    if (C.hold != null) { s.deadline = Date.now() + C.hold; s.left = 0; }
    if (agree) applyCall(C.id, !C.ok);
    else s.toast = { id: ++s.toastN, text: late ? "No answer in time: the call stands." : byHost ? "The host keeps the call." : `${iso(capName(other(C.by)))} doesn't agree: the call stands.` };
  }, [applyCall]);

  const openContest = useCallback((id: string, by: 0 | 1) => {
    const s = st.current, c = callsOf(s).find((x) => x.id === id);
    if (!c) return;
    s.contest = { id, by, team: c.team, text: c.text, ok: c.ok, until: Date.now() + T().tContest * 1000 };
    /* sudden death / the tie-breaker going on meanwhile: its clock waits for the contest */
    if (SD_CONTEST.includes(s.screen) && s.deadline) { s.contest.hold = Math.max(0, s.deadline - Date.now()); s.left = s.contest.hold / 1000; s.deadline = null; }
    /* no pop-up over it: the TV and the phones show the contest itself until it's decided */
    s.toast = null;
  }, []);

  /* the night is over and somebody tapped Exit: every screen goes home, and
     this TV forgets the game (a reload must not bring it back) */
  const exitGame = () => {
    const s = st.current;
    s.exit = true; s.deadline = null; s.pending = null; s.autoAt = null;
    /* (a query only goes out once something waits on it) */
    void sb().from("rooms").update({ status: "done" }).eq("code", code).then(() => {});
  };

  /* Play again: the same room, the same teams and captains (and team names), back to the lobby's
     Setup. The questions already played stay played (never repeat). */
  const againGame = () => {
    const s = st.current, room = ctx.current.room;
    Object.assign(s, { g: null, screen: "", step: 1, pending: null, lifeline: null, autoAt: null, deadline: null, left: 0, timeUp: false, paused: false,
      typed: [null, null], guesses: [null, null], pins: [null, null], mrList: null, mrOut: [], mrAsk: null, agree: null, mrHere: [], votes: {}, ok: [null, null], app: [null, null], decided: null, contest: null, contested: [], legLog: [], sdCur: [], sdQ: 0, sdLog: null, flags: [], toast: null, scoreLog: [] });
    try { localStorage.removeItem(saveKey); } catch { /* */ }
    lastSave.current = "";
    setPub(null);
    const rest = { ...(room?.state || {}) }; delete rest.pub;
    /* (stamped, so a game update still on its way can't bring the old game back) */
    lobbyMine.current.away = [];
    void sb().from("rooms").update({ status: "lobby", mode: null, state: { ...rest, ...lobbyMine.current, pubAt: stamp() } }).eq("code", code).then(() => {});
  };

  /* ---- Majority Rules ---- */
  /* a name as a phone sends it back (the screens show names isolated, see iso) */
  const bare = (x: unknown) => String(x ?? "").replace(/[\u2068\u2069]/g, "").trim();
  /* the lists as they'd be fixed now: everyone on a team (captains too), but whoever was taken off */
  const mrRoster = () => ctx.current.members.filter((m) => (m.team === 0 || m.team === 1) && m.role !== "host" && !st.current.mrOut.includes(m.name))
    .map((m) => ({ name: m.name, uid: m.user_id, team: m.team as 0 | 1 }));
  /* an answer: one of the four, once, from someone on a list (a phone that rejoined keeps its seat: its name) */
  const mrAnswer = (from: Member, p: G): boolean | string => {
    const s = st.current, q = currentQ(s);
    if (!q || !s.mrList) return false;
    if (s.paused) return "The game is paused.";                            // (the last pick in would be the reveal)
    if (typeof p.k === "string" && p.k !== draftKey()) return false;     // the last question's, landing late
    const e = s.mrList.find((x) => x.uid === from.user_id) || s.mrList.find((x) => x.name.toLowerCase() === from.name.toLowerCase());
    if (!e) return "You joined after the start: watch this one.";
    if (e.uid !== from.user_id) e.uid = from.user_id;
    if (s.votes[e.name] != null) return true;                              // (a second tap: the first one stands)
    const pick = String(p.pick ?? "");
    if (!q.options.includes(pick)) return false;
    s.votes = { ...s.votes, [e.name]: pick };
    if (s.mrList.every((x) => s.votes[x.name] != null)) reveal();        // everyone's in: the reveal
    return true;
  };

  /* the moves a host makes — from the host's phone, or a captain's with no host */
  const hostMove = useCallback((move: G) => {
    const s = st.current, g = s.g;
    const t = move.type as string;
    /* the host moving on past an open contest: that's the host's call */
    if (s.contest && NEXT_MOVES.has(t) && !s.nohost) s.contest = null;
    if (t === "ui/contestOk") closeContest(!!move.v, true);
    else if (t === "ui/flip") { const c = callsOf(s).find((x) => x.id === move.id); if (c) applyCall(c.id, !c.ok); }
    else if ((t === "dish/right" || t === "dish/wrong") && g.dishGame.leg.buzz != null && !s.nohost) {
      const b = g.dishGame.leg.buzz as 0 | 1;
      s.legLog = [...s.legLog, { team: b, text: (s.typed[b] || []).join(" / "), ok: t === "dish/right" }];
      play(move);
      if (t === "dish/wrong") { s.typed[b] = null; s.buzzAt = 0; }
    }
    else if (t === "ui/closeLifeline") { s.lifeline = null; s.paused = false; applyFx([{ timer: "resume" }]); }
    /* the host sets the total scores by hand (something went wrong); everyone sees it said */
    else if (t === "ui/setScore") {
      const n = (x: unknown) => Math.max(0, Math.min(999, Math.floor(Number(x))));
      if (!Number.isFinite(Number(move.a)) || !Number.isFinite(Number(move.b))) return;
      g.teams[0].score = n(move.a); g.teams[1].score = n(move.b);
      s.toast = { id: ++s.toastN, text: `The host set the scores: ${iso(g.teams[0].name)} ${g.teams[0].score}, ${iso(g.teams[1].name)} ${g.teams[1].score}.` };
    }
    else if (t === "ui/timeUp") { s.deadline = null; s.left = 0; s.timeUp = true; }
    else if (t === "ui/pause") {
      /* while the TV is asleep its own pause holds the clock; a Pause or Resume tapped meanwhile waits for it */
      if (s.tvAway || s.lifeline || (!s.deadline && !s.paused)) return;
      /* the phone says which it meant (its button read Pause or Resume): a tap on a screen a beat behind can't do the opposite */
      if ((move.on === "pause" && !s.deadline) || (move.on === "resume" && s.deadline)) return;
      applyFx([{ timer: s.deadline ? "pause" : "resume" }]); s.paused = !s.deadline && s.left > 0;
    }
    else if (t === "ui/reveal") reveal();
    /* a ruling: v sets it (RIGHT/WRONG, DODGED IT/SAID IT); without v it flips */
    else if (t === "ui/flagOk" || t === "ui/mapOk" || t === "ui/sayOk" || t === "ui/airportOk") { const i = move.t === 1 ? 1 : 0; s.ok[i] = typeof move.v === "boolean" ? move.v : !s.ok[i]; }
    else if (t === "ui/exit") exitGame();
    else if (t === "ui/again") againGame();
    /* Majority Rules: the host takes someone off their team's list (or puts them back), before Start */
    else if (t === "ui/mrOut") {
      const n = bare(move.name), m = ctx.current.members.find((x) => x.name === n);
      if (!m || (m.team !== 0 && m.team !== 1)) return;
      const off = !s.mrOut.includes(n);
      s.mrOut = off ? [...s.mrOut, n] : s.mrOut.filter((x) => x !== n);
      s.toast = { id: ++s.toastN, text: off ? `${iso(n)} is off ${iso(g.teams[m.team].name)}'s list for this one.` : `${iso(n)} is back on ${iso(g.teams[m.team].name)}'s list.` };
    }
    /* ...and Start fixes the lists: everyone on a team, but whoever was taken off */
    else if (t === "majority/start") {
      const L = mrRoster();
      if (!L.some((e) => e.team === 0) || !L.some((e) => e.team === 1)) { s.toast = { id: ++s.toastN, text: "Both teams need someone on their list." }; return; }
      s.mrList = L; s.votes = {}; s.mrAsk = null;
      play({ type: "majority/start", n: [L.filter((e) => e.team === 0).length, L.filter((e) => e.team === 1).length] });
    }
    else if (t === "ui/startCall") {
      const L = s.lifeline;
      if (!L || L.key !== "friend" || !L.wait) return;
      s.lifeline = { ...L, wait: undefined, deadline: Date.now() + (L.left || T().tFriend) * 1000, left: undefined };
    }
    else if (t === "ui/pauseFriend") {
      const L = s.lifeline;
      if (!L || L.key !== "friend" || L.wait) return;
      if (L.deadline) s.lifeline = { ...L, deadline: null, left: Math.max(0, (L.deadline - Date.now()) / 1000) };
      else if (L.left) s.lifeline = { ...L, deadline: Date.now() + L.left * 1000, left: undefined };
    }
    else if ((t === "decided/more" || t === "decided/stop") && s.decided) {
      const key = s.decided.key;
      s.decided = null;
      play({ type: t === "decided/more" ? "mini/fun" : "mini/stop", key });
    }
    else if (t === "tie/more" || t === "tie/stop") {
      const more = t === "tie/more", sc = s.screen;
      if (sc === "dishTie") play({ type: more ? "dish/more" : "dish/stop" });
      else if (sc === "mapTie") play({ type: more ? "map/more" : "map/stop" });
      else if (sc === "battleLevel") {
        if (more) applyFx([{ go: "battleTie" }]);
        else {
          /* called there: half the Battle's points each */
          const b = g.battle, half = Math.floor((g.battlePts || g.miniPts) / 2);
          b.stage = "done"; b.done = true; b.winner = null; b.awarded = true; b.award = [half, half];
          g.teams[0].score += half; g.teams[1].score += half;
          b.note = `Tie: called there, ${half} point${half === 1 ? "" : "s"} each.`;
          applyFx([{ sound: "point" }, { go: "battleSummary" }]);
        }
      } else if (TIES[sc]) {
        const T = TIES[sc];
        if (more) applyFx([{ go: T.q }]);              // the tie-breaker the engine already lined up
        else {
          const m = miniState(g, T.key);
          m.qs.pop(); m.tieLegs = Math.max(0, (m.tieLegs || 1) - 1);
          m.done = true; m.verdict = { winner: null, needsHost: false, note: "" };
          play({ type: T.award, w: "split" });
          applyFx([{ go: T.summary }]);
        }
      }
      narrate();
    }
    else if (t === "ui/next") {
      if (s.screen === "closestReveal") play({ type: "closest/win", w: closestWinner(), gA: s.guesses[0], gB: s.guesses[1] });
      else if (s.screen === "flagReveal") play({ type: "flag/verdict", w: okW() });
      else if (s.screen === "mapReveal") play({ type: "map/verdict", w: okW() });
      else if (s.screen === "sayReveal") play({ type: "say/verdict", w: sayW() });
      else if (s.screen === "pinReveal") play({ type: "pin/settle", pins: [s.pins[0], s.pins[1]] });
      else if (s.screen === "airportReveal") play({ type: "airport/verdict", w: okW() });
      else if (s.screen === "majorityReveal") play({ type: "majority/settle", right: mrTally(s).right });
    }
    else if (t === "ui/sdRight" && s.sdBuzz != null && sdRecord(s, s.sdBuzz, true)) play(s.screen === "battleTie" ? { type: "battle/tbWin", w: s.sdBuzz } : { type: "sudden/win", w: s.sdBuzz });
    else if (t === "ui/sdWrong" && s.sdBuzz != null && sdRecord(s, s.sdBuzz, false)) {
      s.sdOut[s.sdBuzz] = true; s.typed[s.sdBuzz] = null; s.sdBuzz = null;
      if (s.sdOut[0] && s.sdOut[1]) play(s.screen === "battleTie" ? { type: "battle/tbWin", w: "none" } : { type: "sudden/win", w: "none" });
      else s.toast = { id: ++s.toastN, text: "Wrong. The other captain can have a go." };
    }
    else if (t === "dish/wrong") { const b = g.dishGame.leg.buzz; play(move); if (b != null) s.typed[b] = null; s.buzzAt = 0; }
    else if (t === "battle/tbWin") play({ ...move, byHost: true });
    else play(move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyFx, play, reveal, closeContest, applyCall]);

  /* ---- a captain's own moves: answers, buzzes, lifelines (no step bump:
     a captain typing doesn't change what the host is deciding) ---- */
  /* Returns true when taken, false to drop it quietly (a stale or doubled tap), or a short
     reason the TV puts up as a toast, so a refused tap is never a mystery. */
  const captainInput = useCallback((kind: string, team: 0 | 1, p: G): boolean | string => {
    const s = st.current, g = s.g, sc = s.screen;
    const nm = (t: 0 | 1) => iso(g.teams[t].name);
    /* An answer is never thrown away: one sent while the TV is asleep or the game is paused (typed
       before the pause landed) is taken and checked as usual; the clock stays stopped meanwhile.
       Anything else waits for the TV, and says so. */
    if (kind !== "answer" && s.tvAway) return "The TV's screen was asleep. Tap again.";
    if (kind !== "answer" && s.paused) return "The game is paused.";
    /* (Drop the Pin and Guess the Airport: both in would be the reveal, so not while the host has paused it, 23 Oct) */
    if (s.paused && (sc === "pinQ" || sc === "airportQ")) return "The game is paused.";
    const rd = g.rounds[g.r];
    if (kind === "lifeline") {
      if (p.key === "dbl" && sc === "roundIntro") { play({ type: "round/armDbl", i: team }); return true; }
      /* lifelines before the answer goes in, not after (nor once the clock has run out) */
      if ((p.key === "friend" || p.key === "dip") && sc === "ask" && s.deadline && Date.now() >= s.deadline) return "Time's up.";
      if ((p.key === "friend" || p.key === "dip") && sc === "ask" && !s.lifeline && !s.pending && turnTeam() === team && !s.typed[team]) {
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
      if (sc === "dishQ") {
        const L = g.dishGame.leg;
        if (L.out[team]) return `${nm(team)} is out of this one.`;
        /* (a second tap on Buzz: theirs is already in) */
        if (L.buzz != null) return L.buzz === team ? true : `${nm(L.buzz)} buzzed first.`;
        play({ type: "dish/buzz", w: team }); s.buzzAt = Date.now(); return true;
      }
      if ((sc === "sudden" && g.sdReady) || sc === "battleTie") {
        if (s.contest) return contestWait();
        if (s.sdOut[team]) return `${nm(team)} is out of this one.`;
        if (s.sdBuzz != null) return s.sdBuzz === team ? true : `${nm(s.sdBuzz)} buzzed first.`;
        s.sdBuzz = team; s.deadline = null; s.buzzAt = Date.now(); playSound("soft"); return true;
      }
      return false;
    }
    if (kind !== "answer") return false;
    /* an answer says which question it's for (the phone's k): one sent in the last second of a question,
       landing once the next is up, is the old one's and goes nowhere (20 Oct: "Days" counted for two) */
    if (typeof p.k === "string" && p.k !== draftKey()) return false;
    const texts = (Array.isArray(p.texts) ? p.texts : [p.text]).map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean);
    /* no host: the first answer sent is the one checked. The app's RIGHT stands at once (nobody can take
       it away); a WRONG waits a few seconds, in case the other captain wants to give it to them. */
    const check = (kindP: PKind, q: G) => {
      /* with a host, the answer waits for their call, and its clock stops where it was (it ran on, and
         the teams thought something was wrong: 20 Oct); their call starts the next one */
      if (!s.nohost) { applyFx([{ timer: "pause" }]); return; }
      /* the host away on a question only a person can judge (Know the Host): it waits for them */
      if (hostOnly(q)) { applyFx([{ timer: "pause" }]); s.toast = { id: ++s.toastN, text: "Only the host can rule on this one. It waits for them." }; return; }
      const v = !!matchQ(s.typed[team], q);
      applyFx([{ timer: "pause" }]);
      s.pending = { kind: kindP, team, text: (s.typed[team] || []).join(" / "), v, until: Date.now() };
      settle(false);
    };
    if (sc === "ask" || sc === "steal") {
      /* one answer: once it's sent it's locked, host or no host */
      if (!texts.length) return false;
      if (team !== turnTeam()) return `It's ${nm(turnTeam())}'s turn to answer.`;
      if (s.typed[team]) return `${nm(team)}'s answer is already in.`;
      if (s.pending) return "Wait for the call on the last answer.";
      if (s.lifeline) return "Wait for the lifeline to finish.";
      const dip = sc === "ask" && (rd.llUsed[team] || []).includes("dip");
      s.typed[team] = texts.slice(0, dip ? 2 : 1);
      check(sc, current());
      return true;
    }
    if (sc === "miniQ") {
      const n = QMB.parseNumber(String(p.n ?? ""), current()?.question);   // "1.5 million", "2k", "€25"...
      if (s.guesses[team] != null) return `${nm(team)}'s guess is already in.`;
      if (!Number.isFinite(n)) return "That isn't a number.";
      s.guesses[team] = n;
      if (s.guesses[0] != null && s.guesses[1] != null) reveal();
      return true;
    }
    if (sc === "battleQ") {
      if (!texts.length) return false;
      if (team !== g.battle.cap) return `It's ${nm(g.battle.cap)}'s turn in the Battle.`;
      if (s.pending) return "Wait for the call on the last answer.";
      s.typed[team] = texts.slice(0, 1);
      check("battle", current());
      return true;
    }
    if (sc === "pinQ") {
      /* Drop the Pin: one pin each, locked in; both in, and it's the reveal */
      const pin = asPin(p.pin);
      if (s.pins[team]) return `${nm(team)}'s pin is already in.`;
      if (!pin) return "That pin didn't come through. Drop it again.";
      s.pins[team] = pin;
      if (s.pins[0] && s.pins[1]) reveal();
      return true;
    }
    if (sc === "flagQ" || sc === "mapQ" || sc === "sayQ" || sc === "airportQ") {
      if (!texts.length) return false;
      if (s.typed[team]) return `${nm(team)}'s answer is already in.`;
      s.typed[team] = texts.slice(0, 1);
      if (s.typed[0] && s.typed[1]) reveal();
      return true;
    }
    if (sc === "dishQ" && g.dishGame.leg.buzz === team && texts.length && !s.pending) { s.typed[team] = texts.slice(0, 1); check("dish", current()); return true; }
    if ((sc === "sudden" || sc === "battleTie") && s.contest && texts.length) return contestWait();
    if ((sc === "sudden" || sc === "battleTie") && s.sdBuzz === team && texts.length && !s.pending) { s.typed[team] = texts.slice(0, 1); check(sc === "sudden" ? "sudden" : "battleTie", current()); return true; }
    /* an answer that can't go in here still says why (a phone a beat behind) */
    if (texts.length && ["dishQ", "sudden", "battleTie"].includes(sc)) return s.pending ? "Wait for the call on the last answer." : "Buzz first, then type it.";
    return false;
  }, [applyFx, current, play, reveal, settle, contestWait, draftKey]);

  /* time's up with nothing sent: what the captain had typed is their answer (and the TV says so) */
  const takeDraft = useCallback((team: 0 | 1): boolean => {
    const s = st.current, d = s.drafts[team];
    s.drafts[team] = null;
    if (!d || d.k !== draftKey()) return false;
    const mini = s.screen === "miniQ", pin = s.screen === "pinQ";
    if (pin ? !d.pin : mini ? !d.n : !d.texts.length) return false;
    if (captainInput("answer", team, pin ? { pin: d.pin } : mini ? { n: d.n } : { texts: d.texts }) !== true) return false;
    /* (not what it says: on a standard question the other team may be about to steal) */
    s.toast = { id: ++s.toastN, text: pin ? `Time's up: ${iso(s.g.teams[team].name)}'s pin counts where it is.` : `Time's up: what ${iso(s.g.teams[team].name)} typed counts as sent.` };
    return true;
  }, [captainInput, draftKey]);

  /* No host, a new question asked for: only while nobody has answered this one, nor had a go at it
     (null), else why not. (A lifeline open, or a buzz in the cocktail or dish, counts as a go.) */
  const answeredYet = useCallback((): string | null => {
    const s = st.current, g = s.g;
    if (s.contest) return `One at a time: ${iso(g.teams[s.contest.by].name)}'s contest is open.`;
    if (s.lifeline) return "Wait for the lifeline to finish.";
    if (s.pending || s.typed[0] || s.typed[1] || s.guesses[0] != null || s.guesses[1] != null || s.pins[0] || s.pins[1] || Object.keys(s.votes).length) return "Too late: someone has already answered this one.";
    if (s.screen === "dishQ") { const L = g.dishGame.leg; if (L.buzz != null || L.out[0] || L.out[1] || (L.calls || []).length || s.buzzAt) return "Too late: someone has already had a go at this one."; }
    return null;
  }, []);
  /* ...not changed after all (No, no answer, too late): the clock that stopped for it goes on */
  const swapBack = useCallback((A: NonNullable<TvState["agree"]>) => {
    const s = st.current;
    if (A.kind === "swap" && A.held && s.paused) { s.paused = false; applyFx([{ timer: "resume" }]); }
  }, [applyFx]);

  /* a captain's tap on a host-style button: who may, where, and when */
  const captainMove = useCallback((team: 0 | 1, move: G): boolean | string => {
    const s = st.current, g = s.g, sc = s.screen;
    const rule = CAPTAIN_MOVES[move.type];
    if (!rule || (rule.nohostOnly && !s.nohost) || !inScreen(rule.where, sc)) return false;
    const t = move.type as string;
    /* the lead captain moves the night on; if they haven't after a while, the other captain may */
    if (rule.who === "lead" && leadTeam() !== team && Date.now() - s.waitSince < T_NEXT_FALLBACK * 1000) {
      const lead = g.teams[leadTeam()];
      return `${iso(lead.captain || lead.name)} moves the game on. You can in ${Math.max(1, Math.ceil(T_NEXT_FALLBACK - (Date.now() - s.waitSince) / 1000))} s.`;
    }
    /* the night doesn't move on past a contest: the other captain answers it first (or its time runs out) */
    if (s.contest && NEXT_MOVES.has(t)) return contestWait();
    if (t === "ui/closeLifeline") { if (!s.lifeline || s.lifeline.team !== team) return false; }
    else if (t === "sudden/go") { if (g.sdReady) return false; }
    /* a contest: one at a time, each call once, and only a call something was typed for */
    else if (t === "ui/contest") {
      if (s.contest) return `One at a time: ${iso(g.teams[s.contest.by].name)}'s contest is open.`;
      const c = callsOf(s).find((x) => x.id === move.id);
      if (!c) return false;
      if (c.done) return c.text ? "That call has already been looked at." : "Nothing was typed there.";
      /* your own team's WRONG, or the other team's RIGHT: never your own RIGHT (it could only cost you)
         nor their WRONG (it could only help them) */
      if (c.team === team ? c.ok : !c.ok) return "Contest your own team's WRONG, or the other team's RIGHT.";
    }
    /* with no host, the other captain answers it (not the one who contested) */
    else if (t === "ui/contestOk") { if (!s.contest || team !== other(s.contest.by) || typeof move.v !== "boolean") return false; }
    else if (t === "ui/pauseFriend") { if (!s.lifeline || s.lifeline.key !== "friend" || leadTeam() !== team) return false; }
    /* Majority Rules, no host: a captain asks to take an absent teammate off the list; the other captain says yes or no */
    else if (t === "ui/mrOut") {
      const n = bare(move.name), m = ctx.current.members.find((x) => x.name === n);
      if (!m || m.team !== team || m.role === "host") return false;
      if (s.mrOut.includes(n)) { s.mrOut = s.mrOut.filter((x) => x !== n); return true; }   // back on the list: no need to ask
      if ((s.mrHere || []).includes(m.user_id)) return `${iso(n)} is here: everyone here plays.`;
      if (s.mrAsk) return `One at a time: ${iso(s.mrAsk.name)} first.`;
      s.mrAsk = { name: n, team, until: Date.now() + T().tContest * 1000 };
      return true;
    }
    else if (t === "ui/mrOutOk") {
      const A = s.mrAsk;
      if (!A || team === A.team || typeof move.v !== "boolean") return false;
      s.mrAsk = null;
      if (move.v) s.mrOut = [...s.mrOut, A.name];
      s.toast = { id: ++s.toastN, text: move.v ? `${iso(A.name)} is off ${iso(g.teams[A.team].name)}'s list for this one.` : `${iso(A.name)} stays on the list.` };
      return true;
    }
    /* no host: either captain asks to set the total scores; the other captain agrees, or nothing changes */
    else if (t === "ui/askScore") {
      const n = (x: unknown) => Math.max(0, Math.min(999, Math.floor(Number(x))));
      if (!Number.isFinite(Number(move.a)) || !Number.isFinite(Number(move.b))) return false;
      if (s.agree) return `One at a time: ${iso(g.teams[s.agree.team].name)}'s request is open.`;
      const a = n(move.a), b = n(move.b), from: [number, number] = [g.teams[0].score, g.teams[1].score];
      if (a === from[0] && b === from[1]) return "Those are the scores already.";
      /* (the TV and both captains' phones show it while it's open: no toast as well) */
      s.agree = { id: Date.now(), kind: "score", team, until: Date.now() + T_AGREE * 1000, a, b, from };
      return true;
    }
    /* ...or a new question, before anyone has answered it: the clock stops (and the question hides, as for a
       Pause) while the other captain decides */
    else if (t === "ui/askSwap") {
      if (s.agree) return `One at a time: ${iso(g.teams[s.agree.team].name)}'s request is open.`;
      if (s.tvAway) return "The TV's screen was asleep. Tap again.";
      const why = answeredYet();
      if (why) return why;
      if ((!s.deadline && !s.paused) || (s.deadline && Date.now() >= s.deadline)) return "Time's up.";
      const held = !!s.deadline;
      if (held) { applyFx([{ timer: "pause" }]); s.paused = true; }
      s.agree = { id: Date.now(), kind: "swap", team, until: Date.now() + T_AGREE * 1000, screen: sc, key: draftKey(), held, what: swapWord(sc, currentQ(s)) };
      return true;
    }
    /* (the clock stays stopped for the answer: no Resume meanwhile) */
    else if (t === "ui/pause" && s.agree?.kind === "swap") return `Waiting for ${iso(g.teams[other(s.agree.team)].name)}'s captain: a new ${s.agree.what}, or not.`;
    /* ...and the other captain's answer (to that request: id), not the one who asked */
    else if (t === "ui/agree") {
      const A = s.agree;
      if (!A || team === A.team || typeof move.v !== "boolean" || move.id !== A.id) return false;
      s.agree = null;
      const by = iso(g.teams[team].name);
      if (A.kind === "swap") {
        if (!move.v) { swapBack(A); s.toast = { id: ++s.toastN, text: `${by} said no: the ${A.what} stays.` }; return true; }
        if (s.screen !== A.screen || draftKey() !== A.key) return true;                 // moved on meanwhile: nothing to change
        /* an answer that landed while it was asked (typed just before the clock stopped): too late */
        if (answeredYet()) { swapBack(A); s.toast = { id: ++s.toastN, text: `Too late: someone answered meanwhile, so the ${A.what} stays.` }; return true; }
        s.toast = null;
        hostMove({ type: SWAPS[sc] });
        s.step++;
        /* nothing spare at these levels: the same one goes on (the engine's toast says so); else a new one, a fresh clock */
        if (draftKey() === A.key) swapBack(A);
        else s.toast = { id: ++s.toastN, text: `Both captains agreed. ${(s.toast as Pub["toast"])?.text || `A new ${A.what}.`}` };
        return true;
      }
      if (!move.v) s.toast = { id: ++s.toastN, text: `${by} said no: the scores stay as they were.` };
      /* points won since the request was made would be wiped out: nothing changes, ask again */
      else if (g.teams[0].score !== A.from[0] || g.teams[1].score !== A.from[1]) s.toast = { id: ++s.toastN, text: "The scores changed meanwhile, so they stay as they are. Ask again if they're still wrong." };
      else {
        g.teams[0].score = A.a; g.teams[1].score = A.b;
        s.toast = { id: ++s.toastN, text: `Both captains agreed: ${iso(g.teams[0].name)} ${A.a}, ${iso(g.teams[1].name)} ${A.b}.` };
      }
      return true;
    }
    else if (t === "majority/start" && (!mrRoster().some((e) => e.team === 0) || !mrRoster().some((e) => e.team === 1))) return "Both teams need someone on their list.";
    else if (t === "ui/startCall") { if (!s.lifeline?.wait || s.lifeline.team !== team) return false; }
    else if (t === "ui/exit") { /* either captain, with no host */ }
    else if (rule.who === "turn" && turnTeam() !== team) return false;
    else if (rule.who === "other" && turnTeam() === team) return false;

    if (t === "ui/contest") openContest(move.id, team);
    else if (t === "ui/contestOk") closeContest(!!move.v, false);
    else if (t === "auction/raise") {
      const n = Math.floor(Number(move.n));
      if (!(n > g.auction.bid)) return `Bid more than ${g.auction.bid}.`;
      if (n > MAX_BID) return `Bids go up to ${MAX_BID}.`;
      if (s.bids.leg !== g.auction.leg) s.bids = { leg: g.auction.leg, by: [null, null] };
      s.bids.by[team] = n;
      play({ type: t, n });
    }
    else hostMove(move);
    return true;
  }, [hostMove, play, openContest, closeContest, contestWait, answeredYet, swapBack, applyFx, draftKey]);

  /* a tap the TV won't take: say why on the TV (and the update ends the phone's "Sending…") */
  const refused = useRef<string | null>(null);        // why the tap being handled was turned down (for its receipt)
  const took = useRef(false);                          // ...or that it was taken
  const refuse = useCallback((why: string) => { const s = st.current; refused.current = why; s.toast = { id: ++s.toastN, text: why }; void publish(); }, [publish]);

  /* ---- the inbox ---- */
  const handle = useCallback(async (a: Action) => {
    const { room } = ctx.current, s = st.current;
    let { members } = ctx.current;
    /* a game restored without its questions yet (the download failed, being tried again): the tap is refused, not
       taken and dropped; the phone shows why */
    if (s.g && !s.bank && a.kind !== "suggest" && a.kind !== "count") { refused.current = "The TV is still loading the questions. Try again in a moment."; return; }
    if (!room) return;
    let from = members.find((m) => m.user_id === a.user_id);
    /* the line-up here can be a beat behind the phones (a captain who claimed a second ago, a
       player who just joined): before refusing or ignoring a tap for that, read it fresh
       (a team named the moment its captain took the armband was dropped: 20 Oct) */
    if ((!from && a.kind !== "count") || (a.kind === "setup" && !readyToStart(members)) || (a.kind === "team_name" && from?.role !== "captain")) {
      const { data } = await sb().from("members").select("*").eq("room", code);
      if (data) { members = data as Member[]; ctx.current.members = members; from = members.find((m) => m.user_id === a.user_id); }
    }
    /* anything a phone sends (its 15-second "I'm here" too, when its realtime link is down) proves it's here */
    /* Fresh by the server's clock, not this laptop's: a TV clock running fast must not decide that
       everyone is away. The gap between "now here" and "sent there" is the clock skew plus the delay;
       the smallest gap seen lately is the skew, so an action is fresh when it's within 30 s of that. */
    { const H = here.current, sent = serverMs(a.at);
      if (sent) { const lag = Date.now() - sent; H.lags = [...H.lags.slice(-29), lag]; if (lag - Math.min(...H.lags) < 30000) H.at[a.user_id] = Date.now(); } }
    if (a.kind === "count") { if (isTvRef.current) onNote(a.user_id, a.payload as Parameters<typeof onNote>[1]); return; }
    /* what a captain has typed but not sent, for the question on screen: kept, in case the clock runs out first */
    if (a.kind === "draft") {
      const t = from?.team;
      if (s.g && from?.role === "captain" && (t === 0 || t === 1) && a.payload.k === draftKey()) {
        /* (one the server held back, landing after a newer one from the same phone, is old news) */
        const seq = Number(a.payload.seq) || 0, cur = s.drafts[t];
        if (cur && cur.by === a.user_id && cur.k === a.payload.k && (cur.seq || 0) > seq) return;
        const texts = (Array.isArray(a.payload.texts) ? a.payload.texts : []).map((x: unknown) => String(x ?? "").trim().slice(0, 80)).filter(Boolean);
        s.drafts[t] = { k: String(a.payload.k), texts: texts.slice(0, 2), n: String(a.payload.n ?? "").trim().slice(0, 40), pin: asPin(a.payload.pin), by: a.user_id, seq };
      }
      return;
    }
    if (a.kind === "team_name" && from?.role === "captain" && from.team === a.payload.team && room.status === "lobby") {
      const base = lobbyState(room), names = [...(base.teamNames || ["Team A", "Team B"])] as [string, string];
      names[from.team as 0 | 1] = cap1(String(a.payload.name || "").trim().slice(0, 14)) || names[from.team as 0 | 1];
      lobbyMine.current.teamNames = names;
      await sb().from("rooms").update({ state: { ...base, teamNames: names } }).eq("code", code);
      return;
    }
    /* the lobby: my captain is away, so I take the armband */
    if (a.kind === "setup" && a.payload.takeCaptain && room.status === "lobby" && from && from.team != null && from.role === "player") {
      const cap = members.find((m) => m.team === from!.team && m.role === "captain");
      if (!cap) return;
      if (!((room.state.away as string[] | undefined) || []).includes(cap.user_id)) { setLobbyNote(`${cap.name} is still here.`); return; }
      const x = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", cap.user_id);
      if (!x.error) await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", a.user_id);
      return;
    }
    if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && !readyToStart(members)) {
      sayLobby(notReadyWhy(members) || "Not ready yet.");
      return;
    }
    if (a.kind === "setup" && a.payload.start && room.status === "lobby" && starter(members)?.user_id === a.user_id && readyToStart(members)) {
      const cfgIn = (a.payload.cfg || {}) as G;
      /* the house bank, this TV's own questions, and the starter's (cleaned: never trust a phone) */
      let base: Bank;
      try { base = await loadBank(code); }
      catch (e) { console.error("bank at Start", e); sayLobby("The TV couldn't load the questions. Check its internet, then tap Start again."); return; }
      if (!(cfgIn.standard !== false && Number(cfgIn.rounds) > 0) && !(Array.isArray(cfgIn.minis) && cfgIn.minis.length)) { sayLobby("Pick some rounds or a game first."); return; }
      s.custom = cleanList(cfgIn.custom, base.themes);
      /* the host's own questions are kept on this TV too, for next time (and shown in its Settings) */
      if (members.find((m) => m.user_id === a.user_id)?.role === "host") mergeCustom(s.custom, base.themes);
      /* with no host, nothing only a person can judge: not Know the Host, not even one written on this TV,
         and no made-up theme */
      const all = withCustom(base, s.custom);
      s.bank = members.some((m) => m.role === "host") ? all : forNoHost(all);
      const names = lobbyState(room).teamNames || ["Team A", "Team B"];
      const team = (t: 0 | 1) => ({ name: cap1(names[t]), captain: cap1(members.find((m) => m.team === t && m.role === "captain")?.name || ""),
        players: members.filter((m) => m.team === t).map((m) => m.name).join(", ") });
      const diff = cleanDiff(cfgIn.difficulty);
      const minis = (Array.isArray(cfgIn.minis) ? cfgIn.minis : []).filter((k: string) => PARTY_MINIS.includes(k));
      /* standard rounds can be off (a mini-games-only night), as in Classic */
      const standard = cfgIn.standard !== false;
      if (!standard && !minis.length) return;
      const rounds = Math.max(4, Math.min(12, Math.floor(Number(cfgIn.rounds) || 6)));
      /* the host's hand-picked questions and per-theme difficulty (only a host can send them: the picker shows answers) */
      const byHost = members.find((m) => m.user_id === a.user_id)?.role === "host";
      const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v) => typeof v === "string").slice(0, 20) : []) as string[];
      const pickIn = (byHost && cfgIn.picks && typeof cfgIn.picks === "object" ? cfgIn.picks : {}) as Record<string, unknown>;
      const picks = Object.fromEntries(Object.entries(pickIn).map(([t, v]) => [t, ids(v).slice(0, 2)]).filter(([, v]) => v.length === 2));
      const themeDiff = byHost && cfgIn.themeDiff && typeof cfgIn.themeDiff === "object"
        ? Object.fromEntries(Object.entries(cfgIn.themeDiff as Record<string, string>).filter(([, d]) => DIFFS.includes(d))) : {};
      const hand = (k: string) => (byHost ? ids(cfgIn[k]) : []);
      const hosted = members.some((m) => m.role === "host");
      const cfg = { rounds, themes: (Array.isArray(cfgIn.themes) ? cfgIn.themes as string[] : []).filter((t) => hosted || !HOST_ONLY_THEMES.includes(t)), difficulty: diff, standard,
        /* maps, flags and dishes each have their own levels, set with the mini-games (as in Classic) */
        minis, mapLevels: levels(cfgIn.mapLevels, QMB.MAP_ORDER, QMB.MAP_ORDER), flagLevels: levels(cfgIn.flagLevels, QMB.FLAG_LEVEL_KEYS, ["veasy", "easy", "medium", "hard"]),
        dishLevels: levels(cfgIn.dishLevels, QMB.DISH_LEVEL_KEYS, ["c-medium", "d-medium"]), teamA: team(0), teamB: team(1), picks, themeDiff,
        pinLevels: levels(cfgIn.pinLevels, QMB.PIN_ORDER, QMB.PIN_ORDER), airportLevels: levels(cfgIn.airportLevels, QMB.AIRPORT_ORDER, QMB.AIRPORT_ORDER),
        majorityLevels: levels(cfgIn.majorityLevels, QMB.MAJORITY_ORDER, QMB.MAJORITY_ORDER),
        pickClosest: hand("pickClosest"), pickAuction: hand("pickAuction"), pickSaySame: hand("pickSaySame"), pickMap: hand("pickMap"), pickFlag: hand("pickFlag"), pickDish: hand("pickDish"),
        pickPin: hand("pickPin"), pickAirport: hand("pickAirport"), pickMajority: hand("pickMajority") };
      const g = env().deal.buildGame(cfg);
      /* Party plays Don't Say the Same as Me best of 7 (its last two prompts, the four-answer
         one and the coin flip, stay last) and Guess the Cocktail or Dish best of 5. The engine
         deals Classic's lengths; the legs left over are dropped (Say) or kept back for swaps and
         tie-breakers (Dish). The host's own picks are the last to go. */
      const trim = (m: G, n: number | undefined, mine: string[], keep = 0) => {
        if (!m || !n || m.qs.length <= n) return [];
        const own = new Set(mine), tail: G[] = keep ? m.qs.splice(-keep) : [], cut: G[] = [];
        while (m.qs.length > n - tail.length) { const i = m.qs.map((q: G) => own.has(q.id)).lastIndexOf(false); cut.unshift(m.qs.splice(i >= 0 ? i : m.qs.length - 1, 1)[0]); }
        m.qs.push(...tail);
        m.base = m.qs.length;
        return cut;
      };
      trim(g.saySame, PARTY_LEGS.saysame, cfg.pickSaySame, 2);
      g.mini.spare = [...trim(g.mini, PARTY_LEGS.closest, cfg.pickClosest), ...(g.mini.spare || [])];
      if (g.dishGame) g.dishGame.spare = [...trim(g.dishGame, PARTY_LEGS.dish, cfg.pickDish), ...(g.dishGame.spare || [])];
      /* The engine always plays "hosted" here: with no host the TV is the host
         (it checks the answers), so steals and buzzers work as with one. */
      g.hostless = false;
      g.alternateFirst = getSettings().alternateFirst;
      s.nohost = !members.some((m) => m.role === "host");
      s.g = g; s.screen = ""; s.lifeline = null; s.pending = null; s.autoAt = null; s.step = 1; s.scoreLog = []; s.agree = null;
      g.rounds.forEach((r: G) => r.q.forEach((q: G) => applyFx([{ used: q }])));
      play({ type: "game/start" });
      await sb().from("rooms").update({ status: "playing", mode: s.nohost ? "nohost" : "host" }).eq("code", code);
      await publish();
      return;
    }
    /* the host changes the TV's settings from their phone (Setup, Advanced, Settings): saved here, on the TV,
       as if changed on its Settings page; the lobby share below sends them back to the host */
    if (a.kind === "setup" && (a.payload.settings || a.payload.forgetPlayed) && room.status === "lobby" && from?.role === "host") {
      if (a.payload.settings) saveSettings(cleanSettings(a.payload.settings));
      if (a.payload.forgetPlayed) resetPlayed();
      return;
    }
    if (!s.g || !from) return;
    /* Majority Rules: every player answers, captains too (the host doesn't play) */
    if (a.kind === "answer" && s.screen === "majorityQ") {
      const ok = mrAnswer(from, a.payload as G);
      if (ok === true) took.current = true;            // (the reply goes with the next update: see handleAndReply)
      else if (ok) refused.current = ok;
      return;
    }
    if (a.kind === "judge" && from.role === "host") {
      const move = (a.payload.move || {}) as G;
      const where = HOST_MOVES[move.type];
      if (!where || !inScreen(where, s.screen)) return;
      /* a tap made on an earlier screen (a double tap, a slow phone) is ignored */
      if (!SAME_SCREEN.has(move.type)) { if (a.payload.step !== s.step) return; s.step++; }
      hostMove(move); took.current = true;
      void publish();
      return;
    }
    if (from.role !== "captain" || (from.team !== 0 && from.team !== 1)) return;
    if (a.kind === "next") {
      const move = (a.payload.move || {}) as G, free = SAME_SCREEN.has(move.type);
      if (!free && a.payload.step !== s.step) return;
      const ok = captainMove(from.team, move);
      if (ok === true) { took.current = true; if (!free) s.step++; void publish(); }
      else if (ok) refuse(ok);
      return;
    }
    if (["answer", "buzz", "lifeline"].includes(a.kind)) {
      const ok = captainInput(a.kind, from.team, a.payload as G);
      if (ok === true) { took.current = true; void publish(); }
      else if (ok) refuse(ok);
    }
  }, [applyFx, captainInput, captainMove, code, draftKey, env, hostMove, play, publish, refuse, resetPlayed]);

  /* In the lobby, the TV's settings and its own questions go to the host's phone (the secrets row: the
     host's alone, as the answers are), so the host can pick the TV's questions and change its settings
     (Setup, Advanced). Sent again whenever either changes here; the game's first update replaces it.
     With them, what's nearly played out (the host's Setup shows the same note as the TV). */
  const thinRef = useRef(thin);
  thinRef.current = thin;
  useEffect(() => {
    if (!isTv || status !== "lobby") return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const share = () => { clearTimeout(t); t = setTimeout(() => {
      const at = stamp();
      lastSecret.current = "";                         // the game's first answer goes out whatever it is
      void sb().from("secrets").update({ data: { at, lobby: { settings: getSettings(), custom: getCustom(), played: usedCount(), thin: thinRef.current } } }).eq("room", code)
        .or(`data.is.null,data->>at.is.null,data->>at.lt.${at}`).then(({ error }) => { if (error) console.error("lobby share failed", error); });
    }, 250); };
    share();
    window.addEventListener("qmb:thin", share);
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("qmb.party.")) share(); };
    window.addEventListener("qmb:settings", share); window.addEventListener("qmb:custom", share); window.addEventListener("storage", onStorage);
    return () => { clearTimeout(t); window.removeEventListener("qmb:thin", share); window.removeEventListener("qmb:settings", share); window.removeEventListener("qmb:custom", share); window.removeEventListener("storage", onStorage); };
  }, [isTv, status, code]);

  /* a new thin list goes to the host too */
  useEffect(() => { if (isTv) window.dispatchEvent(new Event("qmb:thin")); }, [isTv, thin]);

  /* fetch the questions while everyone's still joining, not when Start is tapped */
  useEffect(() => { if (isTv) void loadBank(code).catch(() => { /* tried again at Start */ }); }, [isTv, code]);

  /* restore a game in progress after a refresh of the TV */
  useEffect(() => {
    if (!isTv) return;
    try {
      const saved = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (saved?.g && (saved.shape ?? 1) !== SAVE_SHAPE) { try { localStorage.removeItem(saveKey); } catch { /* */ } setBanner("oldSave"); }
      else if (saved?.g) {
        const before = { ...st.current };
        delete saved.build; delete saved.shape;
        Object.assign(st.current, saved);
        /* A reload (or a sleep) hides the page first, which pauses everyone; the
           new page must take that pause back, or the game stays frozen. */
        const s = st.current;
        if (s.tvAway) {
          const d = Date.now() - s.tvAway;
          const dl = s.deadline; s.deadline = null; shiftClocks(s, d); s.deadline = dl;   // (a running clock was parked in s.left)
          if (s.awayPaused && s.left && !s.pending) { s.deadline = Date.now() + s.left * 1000; s.left = 0; }
          if (s.awayPaused) s.paused = false;
          s.tvAway = 0; s.awayPaused = false;
        }
        /* The bank, then the view, to this TV and to every phone (they may still show "paused"). A download
           that fails (one bad request on party Wi-Fi) is tried again every few seconds, with a line on the TV
           meanwhile; the clocks stand still until it comes, and taps are turned down, not swallowed (29 Oct:
           they were acknowledged and dropped, and the night looked alive while nothing could move). */
        const since = Date.now();
        const fetchBank = () => void loadBank(code).then(async (b) => {
          /* filtered as at Start: with no host, no question only a person can judge */
          const all = withCustom(b, st.current.custom || []);
          shiftClocks(st.current, Date.now() - since);
          st.current.bank = st.current.nohost ? forNoHost(all) : all;
          setBanner((x) => (x === "noBank" ? null : x));
          /* a game saved by an older version of the app that this one can't read: say so, don't crash */
          try { setPub(view()?.[0] || null); }
          catch (e) { console.error("saved game unreadable", e); Object.assign(st.current, before); try { localStorage.removeItem(saveKey); } catch { /* */ } setBanner("oldSave"); return; }
          /* publish once the room is loaded: its state carries the team names too */
          for (let i = 0; i < 40 && !ctx.current.room; i++) await new Promise((r) => setTimeout(r, 250));
          if (ctx.current.room) void publish();
        }).catch((e) => { console.error("bank", e); setBanner((x) => x ?? "noBank"); bankRetry.current = setTimeout(fetchBank, 3000); });
        fetchBank();
      }
    } catch { /* nothing saved */ }
    return () => clearTimeout(bankRetry.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTv, saveKey]);

  /* the inbox: every tap from the phones, in the order the server received it (lib/tv/useInbox.ts) */
  /* every tap gets a reply: one the TV ignored (a double tap, the second captain's Next) still sends the
     view again, so that phone stops waiting instead of saying the TV hasn't answered */
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishSoon = useCallback(() => {
    if (soon.current) return;
    soon.current = setTimeout(() => { soon.current = null; void publish(); }, 1000);
  }, [publish]);
  const handleAndReply = useCallback(async (a: Action) => {
    const n = pubN.current;
    refused.current = null; took.current = false;
    await handle(a);
    const s = st.current, tap = typeof a.payload?.tap === "string" ? (a.payload.tap as string).slice(0, 12) : null;
    /* the receipt: this phone's tap is dealt with; if it wasn't taken the phone shows why and lets go of it */
    if (tap && s.g) {
      /* "+" taken, else why not ("-" when there's nothing to say: a double tap, a step behind) */
      const r = took.current ? "+" : refused.current || "-";
      const mine = Object.entries(s.ack[a.user_id] || {}).filter(([k]) => k !== tap).slice(-4);
      s.ack = { ...s.ack, [a.user_id]: Object.fromEntries([...mine, [tap, r]]) };
      /* Majority Rules: everyone answering at once, each answer an update to every phone (30 phones, 30 answers in
         two seconds: 180 messages a second, over the realtime limit: 24 Oct). While the question is up, the answers
         that come in within a second go out together; the last one in is the reveal, and goes at once. */
      if (a.kind === "answer" && s.screen === "majorityQ") publishSoon();
      else void publish();
    } else if (a.kind !== "count" && a.kind !== "suggest" && a.kind !== "draft" && s.g && pubN.current === n) void publish();
  }, [handle, publish, publishSoon]);
  useInbox(code, isTv, handleAndReply);

  /* Who's here: every phone on screen is present on the room's realtime channel (see
     usePresence), and anything it sends counts too. A captain gone for T_AWAY hands over
     to the first teammate still here, so a phone left in a pocket never stalls the
     night. Nobody is removed. */
  const here = useRef({ at: {} as Record<string, number>, since: Date.now(), busy: false, checked: 0, lags: [] as number[],
    away: {} as Record<string, { at: number; qid?: string; flag?: number }> });
  usePresent(code, isTv, here, members);
  /* Left the game screen during a question: flagged once they've been gone two
     seconds (a glance at a notification doesn't count), with how long when
     they come back. The TV says it; the host's phone keeps the list. */
  const flag = (k: string, qid: string | undefined, ms: number | null, kind: "away" | "paste" = "away") => {
    const s = st.current, g = s.g, m = ctx.current.members.find((x) => x.user_id === k);
    if (!g || !m || m.role === "host" || !getSettings().flagAway) return undefined;
    const mk = miniOf(s.screen), rd = g.rounds[g.r];
    const label = s.screen === "sudden" ? "Sudden death" : mk ? MINI_TITLES[mk] : rd ? `Round ${g.r + 1} · ${rd.theme}` : "A question";
    const f = { id: ++s.flagN, name: m.name, team: m.team, label, qid, ms, kind };
    s.flags = [...s.flags, f].slice(-60);
    playSound("wrong");                              // the red flag, bottom left, says who
    return f.id;
  };
  /* a phone's note: "I left the screen", "I'm back" (and for how long, by
     its own clock), or "hello" from a fresh page (a reload: back too) */
  const onNote = (k: string, n: { away?: { qid?: string }; back?: { qid?: string; ms: number }; hello?: number; paste?: { qid?: string } }) => {
    const H = here.current, s = st.current, now = Date.now();
    let changed = false;
    const setMs = (id: number, ms: number) => { s.flags = s.flags.map((f) => (f.id === id ? { ...f, ms } : f)); changed = true; };
    if (n.away && !H.away[k]) H.away[k] = { at: now, qid: n.away.qid };
    /* a paste into an answer box: flagged once per question */
    if (n.paste && !s.flags.some((f) => f.kind === "paste" && f.qid === n.paste!.qid && f.name === ctx.current.members.find((m) => m.user_id === k)?.name) && flag(k, n.paste.qid, null, "paste")) changed = true;
    if (n.hello && H.away[k]) { const a = H.away[k]; delete H.away[k]; if (a.flag && a.flag > 0) setMs(a.flag, now - a.at); }
    if (n.back) {
      const a = H.away[k]; delete H.away[k];
      const ms = Math.max(0, Number(n.back.ms) || 0);
      /* the phone's own clock decides: a glance under two seconds flagged while its "back" was on the way is taken back */
      if (a?.flag && a.flag > 0 && ms < 2000) { s.flags = s.flags.filter((f) => f.id !== a.flag); changed = true; }
      else if (a?.flag && a.flag > 0) setMs(a.flag, ms);
      else if (!a?.flag && ms >= 2000 && flag(k, n.back.qid, ms)) changed = true;
    }
    if (changed) void publish();
  };
  /* is the night waiting on this team's captain right now? (their question, their buzz, their ruling, their Next) */
  const waitsOn = (t: 0 | 1) => {
    const s = st.current, g = s.g, sc = s.screen;
    if (!g) return false;
    if (s.pending) return s.pending.team !== t;                                   // the other captain rules
    if (s.contest && s.nohost) return other(s.contest.by) === t;                  // the other captain decides a contest
    if (sc === "ask" || sc === "steal") return turnTeam() === t;
    if (["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ", "dishQ", "sudden", "battleTie"].includes(sc)) return true;
    if (sc === "battleQ") return g.battle?.cap === t;
    if (sc === "auctionBid") return g.auction?.turn === t;
    if (sc === "auctionRun") return s.nohost && g.auction?.by != null && g.auction.by !== t;   // the counter
    if (s.nohost && WAITS_FOR_NEXT.has(sc)) return leadTeam() === t;
    if (s.nohost && sc === "mapReveal") return s.ok[other(t)] == null;
    return false;
  };
  const handOver = useCallback(async () => {
    const H = here.current, s = st.current, { room, members } = ctx.current, now = Date.now();
    if (H.busy || !s.g || room?.status !== "playing") return;
    const fresh = (k: string) => now - (H.at[k] ?? 0) < 40000;
    /* The host's phone gone a minute (or the host left): the app checks the
       answers, as in a game with no host, until the host is back. */
    const hostM = members.find((m) => m.role === "host");
    const hostHere = !!hostM && now - (H.at[hostM.user_id] ?? H.since) < T_AWAY * 1000;
    if (s.nohost === hostHere && !s.pending) {
      s.nohost = !hostHere;
      s.toast = { id: ++s.toastN, text: s.nohost ? "The host is away, so the app checks the answers for now." : "The host is back." };
      if (s.nohost) {
        /* an answer already typed for the host to judge: the app checks it now */
        const sc = s.screen, g = s.g, q = current();
        const who: 0 | 1 | null = sc === "ask" || sc === "steal" || sc === "battleQ" ? turnTeam() : sc === "dishQ" ? g.dishGame.leg.buzz : sc === "sudden" || sc === "battleTie" ? s.sdBuzz : null;
        const kind = ({ ask: "ask", steal: "steal", battleQ: "battle", dishQ: "dish", sudden: "sudden", battleTie: "battleTie" } as Record<string, PKind>)[sc];
        if (kind && who != null && s.typed[who] && q && hostOnly(q)) {
          /* only a person can judge this one (Know the Host): it waits for the host */
          s.toast = { id: s.toastN, text: "The host is away. Only they can rule on this answer, so it waits for them." };
        } else if (kind && who != null && s.typed[who] && q) {
          applyFx([{ timer: "pause" }]);
          s.pending = { kind, team: who, text: (s.typed[who] || []).join(" / "), v: !!matchQ(s.typed[who], q), until: now };
          settle(false);                                 // the app's call, at once (it can be contested where the calls are shown)
        } else if (s.timeUp && (sc === "ask" || sc === "steal")) {
          /* the clock had run out, waiting for the host: with no host that's a wrong answer */
          s.timeUp = false; s.step++;
          play({ type: sc === "ask" ? "round/judge" : "round/judgeSteal", v: false });
        }
      }
      void publish();
    }
    for (const t of [0, 1] as const) {
      const cap = members.find((m) => m.team === t && m.role === "captain");
      if (!cap || now - (H.at[cap.user_id] ?? H.since) < T_AWAY * 1000) continue;
      /* only when the game is waiting on this captain: a phone asleep in a pocket between rounds keeps its armband */
      if (!waitsOn(t)) continue;
      const next = members.find((m) => m.team === t && m.role === "player" && fresh(m.user_id));   // first to join, still here
      if (!next) continue;
      H.busy = true;
      try {
        const a = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", cap.user_id);
        if (a.error) continue;
        const b = await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", next.user_id);
        if (b.error) { await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", cap.user_id); continue; }
        H.at[next.user_id] = now;
        s.g.teams[t].captain = next.name;
        s.toast = { id: ++s.toastN, text: `${iso(cap.name)} seems to be away. ${iso(next.name)} is ${iso(s.g.teams[t].name)}'s captain now.` };
        void publish();
      } finally { H.busy = false; }
      return;
    }
  }, [code, publish, current, play, applyFx, settle]);
  /* The lobby: a captain silent for T_LOBBY_AWAY (phone asleep, gone) shows as away on the TV, and any
     teammate can take the armband (the "setup" takeCaptain action). Kept in the room's state for the phones. */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const { room, members } = ctx.current, H = here.current, now = Date.now();
      if (!room || room.status !== "lobby") return;
      const away = members.filter((m) => m.role === "captain" && now - (H.at[m.user_id] ?? H.since) >= T_LOBBY_AWAY * 1000).map((m) => m.user_id).sort();
      const base = lobbyState(room), was = ((base.away as string[] | undefined) || []).join(",");
      if (away.join(",") !== was) { lobbyMine.current.away = away; void sb().from("rooms").update({ state: { ...base, away } }).eq("code", code).then(() => {}); }
    }, 3000);
    return () => clearInterval(t);
  }, [isTv, code]);
  /* the line-up changed (a new captain, a move): the phones' view changes with it */
  const lineup = ctx.current.members.map((m) => `${m.user_id}:${m.team}:${m.role}:${m.name}`).join("|");
  const lastLineup = useRef(lineup);
  useEffect(() => {
    if (!isTv || !st.current.g || lastLineup.current === lineup) return;
    lastLineup.current = lineup; void publish();
  }, [isTv, lineup, publish]);

  /* The TV's screen goes to sleep or out of sight (the laptop dozes, someone
     switches tab): everyone pauses, the question hides, and nothing times out.
     When it's back, every clock picks up exactly where it was. */
  useEffect(() => {
    if (!isTv) return;
    const vis = () => {
      const s = st.current, now = Date.now();
      if (!s.g) return;
      if (document.visibilityState === "hidden" && !s.tvAway) {
        s.tvAway = now;
        s.awayPaused = !!s.deadline && !s.paused && !s.lifeline;
        if (s.awayPaused) { applyFx([{ timer: "pause" }]); s.paused = true; }
        void publish();
      } else if (document.visibilityState === "visible" && s.tvAway) {
        const d = now - s.tvAway;
        s.tvAway = 0;
        { const dl = s.deadline; s.deadline = null; shiftClocks(s, d); s.deadline = dl; }   // (the clock itself was paused, in s.left)
        /* the clock picks up where it was, unless an answer that came in meanwhile is waiting for its call */
        if (s.awayPaused) { s.paused = false; s.awayPaused = false; if (!s.pending) applyFx([{ timer: "resume" }]); }
        void publish();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [isTv, applyFx, publish]);

  const lastWhole = useRef<number | null>(null);
  const alarmed = useRef(0);                           // the clock whose bell has rung
  /* The clocks. A standard question running out is only "time's up" when
     there's a host to judge; with no host it's a wrong answer. Closest, Flag
     and Map reveal; a dish leg ends; the Auction settles. The dish ingredients
     come up one every few seconds while its clock runs. With no host, an
     overrule window closes, and results screens move on by themselves. */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current, now = Date.now(), g = s.g;
      if (!g || s.tvAway || offline.current || !s.bank) return;   // asleep, cut off, or still loading the questions: nothing moves
      let changed = false;
      /* the last ten seconds tick; the bells ring at zero */
      const whole = s.deadline ? Math.ceil((s.deadline - now) / 1000) : null;
      if (whole !== lastWhole.current) { if (whole != null && whole <= 10 && whole > 0) playSound("tick"); lastWhole.current = whole; }
      if (s.deadline && now >= s.deadline && alarmed.current !== s.deadline) { alarmed.current = s.deadline; playSound("alarm"); }
      if (s.screen === "dishQ" && s.deadline) {
        const q = g.dishGame.qs[g.dishGame.i], L = g.dishGame.leg;
        const want = Math.min(q.ings.length, 1 + Math.floor((s.total - (s.deadline - now) / 1000) / T().tDishStep + 1e-6));
        if (want > L.shown) { L.shown = want; changed = true; }
      }
      if (s.pending && now >= s.pending.until) { s.step++; settle(false); changed = true; }
      /* no host: a contest nobody answers doesn't hold the night up; the app's call stands */
      if (s.contest && s.nohost && now >= s.contest.until) { closeContest(false, false, true); changed = true; }
      /* Guess the Cocktail or Dish: a buzz gets 10 seconds to type it (no clock on screen); then it's wrong */
      if (s.screen === "dishQ" && s.buzzAt && !s.pending) {
        const b = g.dishGame.leg.buzz;
        if (b == null || s.typed[b]) s.buzzAt = 0;
        else if (now - s.buzzAt >= T().tDishType * 1000 + T_GRACE_MS && takeDraft(b)) { s.buzzAt = 0; s.step++; changed = true; }
        else if (now - s.buzzAt >= T().tDishType * 1000 + T_GRACE_MS) {
          s.buzzAt = 0; s.step++; changed = true;
          hostMove({ type: "dish/wrong" });
          s.late = b;
          s.toast = { id: ++s.toastN, text: `Time's up. ${iso(g.teams[b].name)} is out of this one.` };
        }
      }
      /* sudden death and the Battle's tie-breaker: a buzz gets the same time to type it (25 Oct: with no host, one
         that never came held the night up for good; with a host too, so nobody stalls). Then what was typed
         counts (with a host, it goes to them), or nothing, which is wrong */
      if ((s.screen === "sudden" || s.screen === "battleTie") && s.buzzAt && !s.pending && !s.contest) {
        const b = s.sdBuzz;
        if (b == null || s.typed[b]) s.buzzAt = 0;
        else if (now - s.buzzAt >= T().tDishType * 1000 + T_GRACE_MS) {
          s.buzzAt = 0; s.step++; changed = true;
          if (!takeDraft(b)) {
            const theyCan = !s.sdOut[other(b)];           // (both out: the next question is up instead)
            if (s.nohost) { s.pending = { kind: s.screen === "sudden" ? "sudden" : "battleTie", team: b, text: "", v: false, until: now }; settle(false); }
            else hostMove({ type: "ui/sdWrong" });
            if (theyCan) s.toast = { id: ++s.toastN, text: `Time's up: ${iso(g.teams[b].name)} didn't answer. The other captain can buzz.` };
          }
        }
      }
      /* time's up (a moment after the clock shows 0, see T_GRACE_MS): first, what was typed but not sent goes in */
      if (s.deadline && now >= s.deadline + T_GRACE_MS) {
        const sc = s.screen, took = (t: 0 | 1) => { if (takeDraft(t)) { s.step++; changed = true; } };
        if (sc === "ask" || sc === "steal") { const t = turnTeam(); if (!s.typed[t] && !s.pending) took(t); }
        else if (["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ"].includes(sc)) for (const t of [0, 1] as const) { if (sc === "miniQ" ? s.guesses[t] == null : sc === "pinQ" ? !s.pins[t] : !s.typed[t]) took(t); }
        else if (sc === "battleQ" && s.nohost && !s.pending) took(g.battle.cap);
        else if (sc === "dishQ" && g.dishGame.leg.buzz != null && !s.typed[g.dishGame.leg.buzz] && !s.pending) took(g.dishGame.leg.buzz);
      }
      /* (an answer taken just now may have moved the night on already: a new screen, or a new clock) */
      if (s.deadline && now >= s.deadline + T_GRACE_MS) {
        s.deadline = null; s.step++; changed = true;
        if (s.screen === "ask" || s.screen === "steal") { say("timeup", { t: turnTeam() }); if (!s.nohost) narrate(); }
        if (["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ", "majorityQ"].includes(s.screen)) reveal();
        else if (s.screen === "battleQ" && s.nohost) { s.toast = { id: ++s.toastN, text: "Time's up." }; play({ type: "battle/mark", got: false }); }
        else if (s.screen === "battleTie" && s.nohost) play({ type: "battle/tbWin", w: "none" });
        else if (s.screen === "dishQ") play({ type: "dish/timeUp" });
        else if (s.screen === "auctionRun") play({ type: "auction/resolve" });
        else if (s.screen === "sudden" && s.nohost) play({ type: "sudden/win", w: "none" });
        else if (s.nohost && (s.screen === "ask" || s.screen === "steal")) {
          s.toast = { id: ++s.toastN, text: "Time's up." };
          play({ type: s.screen === "ask" ? "round/judge" : "round/judgeSteal", v: false });
        }
        else s.timeUp = true;
      }
      if (s.lifeline?.deadline && now >= s.lifeline.deadline) {
        if (s.nohost) { s.lifeline = null; applyFx([{ timer: "resume" }]); s.step++; }
        else s.lifeline = { ...s.lifeline, deadline: null };
        changed = true;
      }
      /* no host: a map answer the other captain never ruled on stands as right; then the lead captain taps Next */
      if (s.nohost && s.autoAt && now >= s.autoAt) {
        s.autoAt = null; changed = true;
        if (s.screen === "mapReveal") { s.ok = [s.ok[0] ?? true, s.ok[1] ?? true]; s.waitSince = now; }
      }
      if (now - here.current.checked > 2000) { here.current.checked = now; void handOver(); }
      /* Majority Rules' join screen: who's on the game screen (and someone taken off who turns up is back on);
         a captain's request nobody answered lapses (they stay on the list) */
      if (s.screen === "majorityIntro") {
        const on = ctx.current.members.filter((m) => now - (here.current.at[m.user_id] ?? 0) < T_LOBBY_AWAY * 1000).map((m) => m.user_id).sort();
        if (on.join() !== (s.mrHere || []).join()) {
          s.mrHere = on; changed = true;
          const back = ctx.current.members.filter((m) => on.includes(m.user_id)).map((m) => m.name);
          if (s.mrOut.some((n) => back.includes(n))) s.mrOut = s.mrOut.filter((n) => !back.includes(n));
          if (s.mrAsk && back.includes(s.mrAsk.name)) s.mrAsk = null;
        }
        if (s.mrAsk && now >= s.mrAsk.until) { s.toast = { id: ++s.toastN, text: `No answer: ${iso(s.mrAsk.name)} stays on the list.` }; s.mrAsk = null; changed = true; }
      }
      /* a captain's request the other captain never answered lapses (nothing changes); the host back: the host's to do;
         a new question asked for, and the screen has moved on since (an answer that came in ended it): nothing to change */
      if (s.agree) {
        const A = s.agree, moved = A.kind === "swap" && (s.screen !== A.screen || draftKey() !== A.key);
        if (moved || now >= A.until || !s.nohost) {
          s.agree = null; changed = true;
          if (!moved) swapBack(A);
          if (!moved && s.nohost) s.toast = { id: ++s.toastN, text: A.kind === "score" ? "No answer: the scores stay as they were." : `No answer: the ${A.what} stays.` };
        }
      }
      /* The Auction waits on a captain with no clock: one whose phone has been gone 20 s (and no
         teammate to take the armband) passes after 30 s, or, with nothing bid yet, the other team opens */
      if (s.screen === "auctionBid" && g.auction) {
        const A = g.auction, key = `${A.leg}|${A.turn}|${A.bid}`;
        if (s.bidTurn.key !== key) s.bidTurn = { key, at: now };
        else if (now - s.bidTurn.at > 30000) {
          const cap = ctx.current.members.find((m) => m.team === A.turn && m.role === "captain");
          if (!cap || now - (here.current.at[cap.user_id] ?? here.current.since) > 20000) {
            const t = A.turn as 0 | 1, name = iso(g.teams[t].name);
            s.step++; changed = true;
            if (A.bid > 0) { play({ type: "auction/pass" }); s.toast = { id: ++s.toastN, text: `${name}'s captain seems to be away, so ${name} pass.` }; }
            else { A.turn = other(t); s.bidTurn = { key: "", at: now }; s.toast = { id: ++s.toastN, text: `${name}'s captain seems to be away, so ${iso(g.teams[other(t)].name)} open the bidding.` }; }
          }
        }
      }
      /* away for two seconds during a question: flag it now (how long comes when they're back) */
      for (const [k, a] of Object.entries(here.current.away)) {
        if (!a.flag && now - a.at >= 3000) { a.flag = flag(k, a.qid, null) ?? -1; if (a.flag > 0) changed = true; }
      }
      if (changed) void publish();
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish, play, reveal, settle, hostMove, applyFx, handOver, closeContest, takeDraft, draftKey, swapBack]);

  /* Exit on the TV itself (it has a mouse): the same as the host's Exit */
  const exit = useCallback(() => { if (st.current.screen !== "final") return; exitGame(); void publish(); }, [publish]);  // eslint-disable-line react-hooks/exhaustive-deps
  const again = useCallback(() => { if (st.current.screen === "final") againGame(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return { pub, game: st.current.g as G, exit, again, banner, lobbyNote, thin, resetPlayed };
}
