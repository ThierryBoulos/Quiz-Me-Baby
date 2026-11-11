"use client";
/* MANY TEAMS: the TV runs the night (3 to 8 teams, always with a host). Its own state, saved under its own
   key (qmb.tv.<code>.many), so a two-team save is never read here or the other way round. It shares only the
   inbox (lib/tv/useInbox.ts), the bank and the dealer's decks with the two-team game; none of the two-team
   reducer (lib/tvGame.ts) runs while this one does. */
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, HOST_ONLY_THEMES, hostOnly, loadBank, type Bank, type Q } from "../engine";
import { sb } from "../supabase";
import { cleanSettings, forgetUsed, getSettings, saveSettings, USED_KEY } from "../settings";
import { cleanList, mergeCustom } from "../custom";
import { withCustom } from "../engine";
import { saveLobbyDraft, useLobbyShare } from "../tv/lobbyShare";
import { cap1, type Member, type Room } from "../room";
import { inboxMark, useInbox } from "../tv/useInbox";
import { usePresent } from "../tv/usePresent";
import { DISH_LAST, T_AWAY, T_LOBBY_AWAY } from "../game";
import type { Action, G } from "../tv/rules";
import { playSound } from "../sound";
import { MANY_LEGS, MANY_MAX, qidOf, MANY_ROUNDS, MANY_THEMES, MANY_MINIS, MANY_PLAYERS, allIn, answered, titleOf, captainAnswer, contestCall, decideContest, setScores, toggleMrOut, showMapHint, defaultName, dishShown, flip, lineup, miniOf, newNight, next, pause, reveal, startMini, swapQ, vote, type ManyKey, type StateM, type Timers } from "./logic";
import { buildMany, type PubMany } from "./view";
import { imadContest, imadMany } from "./imad";

/* a phone flagged (8 Nov, as with two teams): who, in which game, how long (null: still away); not the host's, and
   not with the house rule off. The TV says so; the host's list (no host: the captains') keeps it */
function flagIt(s: StateM, m: Member, qid: string | undefined, ms: number | null, kind: "away" | "paste" = "away"): number | undefined {
  if (m.role === "host" || !getSettings().flagAway) return undefined;
  const id = (s.flagN = (s.flagN || 0) + 1);
  s.flags = [...(s.flags || []), { id, name: m.name, team: m.team, label: titleOf(s.minis, s.mi) || "A question", qid, ms, kind }].slice(-60);
  s.toast = { id: ++s.toastN, text: kind === "paste" ? `${m.name} tried to paste an answer.` : `${m.name} left the game screen during the question.` };
  playSound("wrong");
  return id;
}
const setFlagMs = (s: StateM, id: number, ms: number) => { s.flags = (s.flags || []).map((f) => (f.id === id ? { ...f, ms } : f)); };

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

/* how many teams (2 to 8): the TV writes it, from its own stepper or the host's phone (the owner, 30 Oct: the host
   can add a team without going to the TV). Players on a team that goes are left with no team. state: the room's
   state as the TV holds it now */
export async function setTeams(code: string, state: Record<string, unknown>, members: Member[], k: number) {
  const v = Math.max(2, Math.min(MANY_MAX, Math.floor(k) || 2));
  await sb().from("rooms").update({ state: { ...state, teamCount: v } }).eq("code", code);
  const gone = members.filter((m) => m.team != null && (m.team as number) >= v);
  for (const m of gone) await sb().from("members").update({ team: null, role: m.role === "captain" ? "player" : m.role }).eq("room", code).eq("user_id", m.user_id);
}

/* each game's seconds, from the TV's house settings */
const timers = (): Timers => { const t = getSettings(); return { sudden: t.tQuestion, quiz: t.tQuestion, flag: t.tFlag, airport: t.tAirport, map: t.tMap, closest: t.tMini, pin: t.tPin, majority: t.tMajority, say: t.tSay, dish: t.tDishStep, dishLast: DISH_LAST, roulette: t.tRoulette }; };
/* Russian Roulette: the questions of a lap's drawn chambers count as played on this TV (a dark chamber's don't) */
function markRoulette(s: StateM) {
  const m = s.minis[s.mi], lap = m?.key === "roulette" && s.screen === "q" ? (m.qs[m.i] as { ch: { q: Q }[]; draw?: number[] }) : null;
  if (!lap?.draw) return;
  try { const u = new Set<string>(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); lap.draw.forEach((j) => { const id = lap.ch[j]?.q?.id; if (id) u.add(id); }); localStorage.setItem(USED_KEY, JSON.stringify([...u])); } catch { /* in memory only */ }
}

export function useTvMany(code: string, isTv: boolean, room: Room | null, members: Member[], phone = false) {
  const [banner, setBanner] = useState<null | "offline" | "cantSave" | "oldSave" | "noBank">(null);
  const st = useRef<StateM | null>(null);
  const [pub, setPub] = useState<PubMany | null>(null);
  const ctx = useRef({ room, members }); ctx.current = { room, members };
  const bank = useRef<Bank | null>(null);
  const saveKey = "qmb.tv." + code + ".many";
  const phoneRef = useRef(phone); phoneRef.current = phone;
  const backedUp = useRef({ t: 0, screen: "" });
  const lastAt = useRef(0);
  const ack = useRef<Record<string, Record<string, string>>>({});
  /* the lobby's own writes (team names, who's away, a note): each carries the others this TV wrote last, so two
     in the same moment never undo each other (this TV is the lobby's only writer) */
  const lobbyMine = useRef<Record<string, unknown>>({});
  const lobbyWrite = useCallback((patch: Record<string, unknown>) => {
    if (!("note" in patch)) lobbyMine.current = { ...lobbyMine.current, ...patch };
    return sb().from("rooms").update({ state: { ...(ctx.current.room?.state || {}), ...lobbyMine.current, ...patch } }).eq("code", code);
  }, [code]);

  /* publish: the view for every phone, the answer for the host; one write at a time, newest wins. The two-team
     game's safeguards (the 4 Nov audit, 4.1): each write only lands over an older one (a held write landing late
     can't roll the screen back), a write the server sits on doesn't hold up the next ones past 2 s, a write turned
     down because the room holds a later stamp (this phone's clock behind the last one's) goes again from there,
     and the answer is only written when it changed */
  const chain = useRef<Promise<void>>(Promise.resolve());
  const lastSecret = useRef("");
  /* in the lobby, the TV's settings, its own questions and the host's setup go to the host's phone, as with two teams */
  useLobbyShare(code, isTv, room?.status, { lastSecret, stamp: () => (lastAt.current = Math.max(Date.now(), lastAt.current + 1)) });
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishRef = useRef<() => void>(() => {});
  const marked = useRef<number | null>(null);    // the Russian Roulette spin whose questions are marked played
  const retryT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publish = useCallback(() => {
    if (soon.current) { clearTimeout(soon.current); soon.current = null; }
    const s = st.current; if (!s) return;
    imadMany(s);                                    // (Imad's line for this moment, if Settings has him on)
    if (s.screen === "q" && s.spinAt && s.spinAt !== marked.current) { marked.current = s.spinAt; markRoulette(s); }
    const { pub: p, secret } = buildMany(s);
    p.ack = ack.current;
    const at = Math.max(Date.now(), lastAt.current + 1); lastAt.current = at; p.at = at; p.now = Date.now();
    setPub(p);
    try { localStorage.setItem(saveKey, JSON.stringify({ build: BUILD_ID, shape: SHAPE, s })); setBanner((b) => (b === "cantSave" ? null : b)); } catch { setBanner("cantSave"); }
    /* a copy on the server, so another phone can carry on if this one goes quiet (no TV, 3 Nov): on a new screen
       at once, otherwise every 4 s at most. (Not with a TV: 3-8 teams always have a host, and a laptop doesn't doze.) */
    if (phoneRef.current && !s.exit && (s.screen !== backedUp.current.screen || Date.now() - backedUp.current.t > 4000)) {
      backedUp.current = { t: Date.now(), screen: s.screen };
      void sb().rpc("qmb_tv_backup", { r: code, s: { many: true, build: BUILD_ID, shape: SHAPE, s, ...inboxMark(code), savedAt: Date.now(), settings: getSettings() } }).then(() => {}, () => {});
    }
    const sec = JSON.stringify(secret), withSecret = sec !== lastSecret.current;
    const job = async () => {
      const room = ctx.current.room;
      const writes = [sb().from("rooms").update({ state: { ...(room?.state || {}), pub: p, pubAt: at } }).eq("code", code)
        .or(`state->>pubAt.is.null,state->>pubAt.lt.${at}`).select("code")];
      if (withSecret) writes.push(sb().from("secrets").update({ data: { ...secret, at } }).eq("room", code)
        .or(`data.is.null,data->>at.is.null,data->>at.lt.${at}`).select("room"));
      const res = await Promise.all(writes);
      const bad = res.find((r) => r.error);
      if (bad) { setBanner((b) => b ?? "offline"); throw bad.error; }
      setBanner((b) => (b === "offline" ? null : b));
      const latest = lastAt.current === at;
      if (withSecret && latest && res[1]?.data?.length) lastSecret.current = sec;   // (a write turned down is sent again with the next)
      if (latest && !res[0].data?.length) {
        const r = await sb().from("rooms").select("state").eq("code", code).maybeSingle();
        const theirs = Number((r.data?.state as { pubAt?: number } | undefined)?.pubAt) || 0;
        if (theirs >= at) { lastAt.current = Math.max(lastAt.current, theirs); setTimeout(() => publishRef.current(), 0); }
      }
    };
    chain.current = chain.current.then(() => {
      /* a failed write tries again in 2 s: one try waiting at a time, however many writes failed meanwhile (with no
         connection, every tap used to add a retry of its own; 5 Nov review) */
      const done = job().catch((e) => { console.error("publish (many)", e); if (!retryT.current) retryT.current = setTimeout(() => { retryT.current = null; publishRef.current(); }, 2000); });
      return Promise.race([done, new Promise<void>((r) => setTimeout(r, 2000))]);
    });
  }, [code, saveKey]);
  publishRef.current = publish;
  /* answers coming in (60 phones in Majority Rules): one update a second, not one each (the 4 Nov audit, 1.11) */
  const publishSoon = useCallback(() => {
    if (soon.current) return;
    soon.current = setTimeout(() => { soon.current = null; publishRef.current(); }, 1000);
  }, []);

  /* a safety net (live test, 1 Nov): a lobby write landing as the game begins (a team's new name, the "away" check)
     can replace the room's state without the screen in it, and every phone then waits on nothing. The TV knows what
     it last published: missing, or older than that, it publishes again */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const room = ctx.current.room, s = st.current;
      if (!s || !room || room.status !== "playing" || !lastAt.current || Date.now() - lastAt.current < 2500) return;
      const at = Number((room.state as { pubAt?: number } | null)?.pubAt) || 0;
      if (!(room.state as { pub?: unknown } | null)?.pub || at < lastAt.current) publish();
    }, 2000);
    return () => clearInterval(t);
  }, [isTv, publish]);

  /* a reload picks the night up where it was */
  useEffect(() => {
    if (!isTv) return;
    try {
      const raw = JSON.parse(localStorage.getItem(saveKey) || "null");
      if (raw && raw.shape === SHAPE && raw.s && raw.s.v === 2) {
        const s = raw.s as StateM, now = Date.now();
        /* the clock picks up where it was: after a sleep (or a reload, which hides the page first) from the time it
           had left; after taking the game over from another phone's copy (savedAt), less the time since that copy
           (the 4 Nov audit, 1.3: a question ran out while the game changed phones) */
        if (s.away) { if (s.left && s.screen === "q" && !s.paused) { s.deadline = now + s.left * 1000; s.left = 0; } s.away = 0; }
        else if (raw.savedAt && s.deadline) s.deadline += Math.max(0, now - Number(raw.savedAt));
        st.current = s; void loadBank(code).then((b) => { bank.current = b; }).catch(() => {}); publish();
      }
    } catch { /* nothing saved */ }
  }, [isTv, saveKey, code, publish]);

  const roster = () => ctx.current.members.filter((m) => m.role !== "host" && m.team != null && !(st.current?.mrOut || []).includes(m.name)).map((m) => ({ name: m.name, team: m.team as number }));

  /* who's away from the game screen right now (their note came, they're not back yet), and the flag it made */
  const awayAt = useRef<Record<string, { at: number; qid?: string; flag?: number }>>({});
  const handle = useCallback(async (a: Action) => {
    const { room, members } = ctx.current; if (!room) return;
    const from = members.find((m) => m.user_id === a.user_id);
    const tap = typeof a.payload?.tap === "string" ? (a.payload.tap as string).slice(0, 12) : null;
    const reply = (r: string) => { if (!tap) return; const mine = Object.entries(ack.current[a.user_id] || {}).slice(-4); ack.current = { ...ack.current, [a.user_id]: Object.fromEntries([...mine, [tap, r]]) }; };
    const k = teamCountOf(room);
    /* the lobby */
    if (room.status === "lobby") {
      if (a.kind === "setup" && a.payload.teams != null && from?.role === "host") { await setTeams(code, room.state || {}, members, Number(a.payload.teams)); return; }
      /* the host changes this TV's settings from their phone, or keeps their setup here (as with two teams) */
      if (a.kind === "setup" && (a.payload.settings || a.payload.forgetPlayed || a.payload.draft) && from?.role === "host") {
        if (a.payload.settings) saveSettings(cleanSettings(a.payload.settings));
        if (a.payload.forgetPlayed) { forgetUsed(); window.dispatchEvent(new Event("qmb:settings")); }
        if (a.payload.draft) saveLobbyDraft(code, a.payload.draft);
        return;
      }
      if (a.kind === "team_name" && from?.role === "captain" && (from.team as number) === Number(a.payload.team) && (from.team as number) < k) {
        const names = manyNames(room, MANY_MAX); names[from.team as number] = cap1(String(a.payload.name || "").trim().slice(0, 14)) || names[from.team as number];
        await lobbyWrite({ teamNames: names });
        return;
      }
      /* my captain is away, so I take the armband (the 4 Nov audit, 3.3: the button was there, and nothing happened) */
      if (a.kind === "setup" && a.payload.takeCaptain && from && from.team != null && from.role === "player") {
        const cap = members.find((m) => m.team === from.team && m.role === "captain");
        if (!cap) return;
        const away = ((lobbyMine.current.away ?? room.state?.away) as string[] | undefined) || [];
        if (!away.includes(cap.user_id)) { await lobbyWrite({ note: { text: `${cap.name} is still here.`, at: Date.now() } }); return; }
        const x = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", cap.user_id);
        if (!x.error) await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", a.user_id);
        return;
      }
      if (a.kind === "setup" && a.payload.start && from?.role === "host") {
        const why = manyNotReady(members, k);
        if (why) { await lobbyWrite({ note: { text: why, at: Date.now() } }); return; }
        const cfg = (a.payload.cfg || {}) as G;
        const picked = (Array.isArray(cfg.minis) ? cfg.minis : []).filter((x: string) => (MANY_MINIS as readonly string[]).includes(x)) as ManyKey[];
        /* the question rounds: how many (1 to 14), one theme each, two questions; they play two at a time, back to
           back, as one game (scored as one: the owner, 11 Nov), so 5 rounds are three games, the last one round */
        const rounds = picked.includes("quiz") ? Math.max(1, Math.min(MANY_ROUNDS, Math.floor(Number(cfg.rounds) || 1))) : 0;
        const games = Math.ceil(rounds / 2);
        const keys = lineup(games, picked.filter((x) => x !== "quiz"));
        if (!keys.length) { await lobbyWrite({ note: { text: "Pick at least one game.", at: Date.now() } }); return; }
        let b: Bank;
        try { b = await loadBank(code); } catch { await sb().from("rooms").update({ state: { ...room.state, note: { text: phoneRef.current ? "The game phone couldn't load the questions. Check its internet, then tap Start again." : "The TV couldn't load the questions. Check its internet, then tap Start again.", at: Date.now() } } }).eq("code", code); return; }
        /* with the host's own questions (written on their phone, or right there in the picker), kept on this TV too */
        const custom = cleanList(cfg.custom, b.themes);
        if (custom.length) { b = withCustom(b, custom); mergeCustom(custom, b.themes); }
        bank.current = b;
        /* the decks, dealt exactly as the two-team game deals them (fresh questions first) */
        let used = new Set<string>(); try { used = new Set(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); } catch { /* none */ }
        const dealer = QMB.createDealer({ bank: () => b.bank, never: () => b.never || [], used: () => used, noRepeat: () => getSettings().noRepeat, suddenOk: (q: Q) => !hostOnly(q),
          ok: { map: (q: G) => q.type === "map", flag: (q: G) => q.type === "flag", dish: (q: G) => q.type === "dish",
            pin: (q: G) => q.type === "pin" && Number.isFinite(q.lat) && Number.isFinite(q.lon) && !!q.photo,
            airport: (q: G) => q.type === "airport" && Array.isArray(q.board) && q.board.length > 0,
            majority: (q: G) => q.type === "majority" && Array.isArray(q.options) && q.options.length === 4 && q.options.includes(q.answer) } });
        const lv = (x: unknown, all: string[], dflt: string[]) => { const v = (Array.isArray(x) ? x : []).filter((y) => all.includes(y)); return v.length ? v : dflt; };
        /* the question rounds come from the two-team rounds' pairs: a pair is a theme's two questions, a round one pair,
           the host's themes in turn (one per round); none picked, any theme but the host's own */
        const every = [...new Set(b.bank.filter((q: G) => q.type === "standard" && q.theme && !HOST_ONLY_THEMES.includes(q.theme)).map((q: G) => q.theme as string))];
        const chosen = (Array.isArray(cfg.themes) ? cfg.themes : []).filter((t: string) => every.includes(t)).slice(0, MANY_THEMES);
        const themes = chosen.length ? chosen : every;
        const quizLevels = lv(cfg.quizLevels, ["easy", "medium", "hard", "expert"], ["easy", "medium", "hard"]);
        /* the host's hand-picked questions and difficulty per theme, as with two teams (the picker shows the answers,
           so only the host's are taken; two per theme, played by every team) */
        const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v) => typeof v === "string").slice(0, 20) : []) as string[];
        const picks = Object.fromEntries(Object.entries((cfg.picks && typeof cfg.picks === "object" ? cfg.picks : {}) as Record<string, unknown>)
          .map(([t, v]) => [t, ids(v).slice(0, 2)]).filter(([t, v]) => v.length === 2 && themes.includes(t as string)));
        const themeDiff = cfg.themeDiff && typeof cfg.themeDiff === "object"
          ? Object.fromEntries(Object.entries(cfg.themeDiff as Record<string, string>).filter(([t, d]) => themes.includes(t) && typeof d === "string" && /^(easy|medium|hard|expert|mixed)(\+(easy|medium|hard|expert))*$/.test(d))) : {};
        const hand = (k: string) => ids(cfg[k]);
        /* (six pairs more than the rounds take: some for "Change question", the rest held back for sudden death) */
        const g = dealer.buildGame({ standard: true, rounds: rounds + 6, themes, difficulty: quizLevels.join("+"),
          minis: keys.map((x) => (x === "say" ? "saysame" : x)), picks, themeDiff,
          mapLevels: lv(cfg.mapLevels, QMB.MAP_ORDER, QMB.MAP_ORDER), airportLevels: lv(cfg.airportLevels, QMB.AIRPORT_ORDER, QMB.AIRPORT_ORDER),
          dishLevels: lv(cfg.dishLevels, ["c-easy", "c-medium", "c-hard", "d-easy", "d-medium", "d-hard"], ["c-medium", "d-medium"]),
          flagLevels: lv(cfg.flagLevels, QMB.FLAG_LEVEL_KEYS, ["veasy", "easy", "medium", "hard"]), pinLevels: lv(cfg.pinLevels, QMB.PIN_ORDER, QMB.PIN_ORDER),
          majorityLevels: lv(cfg.majorityLevels, QMB.MAJORITY_ORDER, QMB.MAJORITY_ORDER),
          /* Russian Roulette: a barrel of 6 chambers, 8 with 7 or 8 teams; Sexy Time and Lebanon only if the host picked them */
          rouletteChambers: QMB.rouletteChambers(k), rouletteThemes: chosen,
          teamA: { name: "A", captain: "", players: "" }, teamB: { name: "B", captain: "", players: "" },
          pickClosest: hand("pickClosest"), pickAuction: [], pickSaySame: hand("pickSaySame"), pickMap: hand("pickMap"), pickFlag: hand("pickFlag"), pickDish: hand("pickDish"),
          pickPin: hand("pickPin"), pickAirport: hand("pickAirport"), pickMajority: hand("pickMajority") });
        /* Don't Say the Same: only the wide prompts (five answers or more), so eight teams have room to dodge */
        const say = (dealer.saySameDeck({ pickSaySame: hand("pickSaySame") }) as G[]).filter((q) => (q.pool || []).length >= 5).slice(0, MANY_LEGS.say + 4).map((q) => dealer.drawSaySame(q) as Q);
        const quiz = (g.rounds || []).flatMap((r: G) => r.q as Q[]);
        /* each game's deck, its spares after it (the two-team game deals fewer airports, maps and recipes, and every game
           keeps a few back): what a game doesn't play is there for the host's "Change question" (the 5 Nov review) */
        const all = (m: G): Q[] => [...(m?.qs || []), ...(m?.spare || [])];
        const qn = rounds * 2 + 4;
        const decks: Partial<Record<ManyKey, Q[]>> = { quiz: quiz.slice(0, qn), sudden: quiz.slice(qn), flag: all(g.flagGame), airport: all(g.airportGame), map: all(g.mapGame),
          closest: all(g.mini), pin: all(g.pinGame), majority: all(g.majorityGame), say, dish: all(g.dishGame), roulette: all(g.rouletteGame) };
        const names = manyNames(room, k);
        const teams = names.map((name, t) => ({ name, captain: cap1(members.find((m) => (m.team as number) === t && m.role === "captain")?.name || "") }));
        /* each question-round game two rounds of two questions, the last one round if the rounds are odd */
        st.current = newNight(teams, decks, keys, { quiz: Array.from({ length: games }, (_, j) => Math.min(MANY_LEGS.quiz, rounds * 2 - j * MANY_LEGS.quiz)) });
        st.current.intro = true;
        /* the questions dealt count as played on this TV */
        try { for (const mm of st.current.minis) for (const q of mm.qs) if (q?.id) used.add(q.id); localStorage.setItem(USED_KEY, JSON.stringify([...used])); } catch { /* in memory only */ }
        await sb().from("rooms").update({ status: "playing", mode: "many" }).eq("code", code);
        publish(); return;
      }
      return;
    }
    const s = st.current; if (!s || !from) return;
    /* a phone's note: it left the game screen during a question, it's back (and for how long, by its own clock), it
       tried to paste an answer (8 Nov: flagged as with two teams; the TV says so, the host's list keeps it) */
    if (a.kind === "count") {
      const n = a.payload as { away?: { qid?: string }; back?: { qid?: string; ms: number }; hello?: number; paste?: { qid?: string } };
      const A = awayAt.current, k = a.user_id, now = Date.now();
      if (n.away && !A[k]) A[k] = { at: now, qid: n.away.qid };
      if (n.paste && !(s.flags || []).some((f) => f.kind === "paste" && f.qid === n.paste!.qid && f.name === from.name) && flagIt(s, from, n.paste.qid, null, "paste")) publish();
      if (n.hello && A[k]) { const x = A[k]; delete A[k]; if (x.flag) { setFlagMs(s, x.flag, now - x.at); publish(); } }
      if (n.back) {
        const x = A[k]; delete A[k];
        const ms = Math.max(0, Number(n.back.ms) || 0);
        if (x?.flag && ms < 2000) { s.flags = (s.flags || []).filter((f) => f.id !== x.flag); publish(); }
        else if (x?.flag) { setFlagMs(s, x.flag, ms); publish(); }
        else if (ms >= 2000 && flagIt(s, from, n.back.qid, ms)) publish();
      }
      return;
    }
    /* the host runs it */
    if (a.kind === "judge" && from.role === "host") {
      const mv = (a.payload.move || {}) as G, t = String(mv.type || "");
      /* (a call changed, or a contest ruled on, carries no step: the reveal's step doesn't move for either) */
      if (t !== "m/flip" && t !== "m/contestOk" && t !== "m/setScores" && t !== "m/mrOut" && Number(a.payload.step) !== s.step) { reply("-"); publish(); return; }
      let ok = false;
      if (t === "m/go") { ok = !!s.intro; delete s.intro; }
      else if (s.intro) ok = false;
      else if (t === "m/start") ok = startMini(s, Date.now(), timers(), roster());
      else if (t === "m/reveal" && s.screen === "q") ok = reveal(s);
      else if (t === "m/next") ok = next(s, Date.now(), timers());
      else if (t === "m/flip") ok = flip(s, Number(mv.t));
      else if (t === "m/contestOk") { ok = decideContest(s, !!mv.v); if (ok) imadContest(s); }
      else if (t === "m/hint") ok = showMapHint(s);
      else if (t === "m/setScores") ok = setScores(s, mv.scores);
      else if (t === "m/mrOut") ok = toggleMrOut(s, mv.name);
      else if (t === "m/pause") ok = pause(s, Date.now());
      else if (t === "m/swap") { const r = swapQ(s, Date.now(), timers()); ok = r === true; if (typeof r === "string") { reply(r); publish(); return; } }
      else if (t === "m/exit") { s.exit = true; ok = true; try { localStorage.removeItem(saveKey); } catch { /* fine */ } void sb().from("rooms").update({ status: "done" }).eq("code", code); }
      else if (t === "m/again") {
        try { localStorage.removeItem(saveKey); } catch { /* fine */ }
        st.current = null; setPub(null);
        await sb().from("rooms").update({ status: "lobby", mode: null, state: { ...room.state, pub: null } }).eq("code", code);
        reply("+"); return;
      }
      reply(ok ? "+" : "-");
      if (ok && s.screen === "summary") playSound("win");
      publish(); return;
    }
    /* a captain contests a call on the reveal (8 Nov, the owner): the host decides */
    if (a.kind === "next" && from.role === "captain") {
      const mv = (a.payload.move || {}) as G;
      if (String(mv.type) !== "m/contest") { reply("-"); return; }
      const r = contestCall(s, from.team as number, Number(mv.t));
      reply(r === true ? "+" : r); publish(); return;
    }
    /* captains answer; in Majority Rules everyone does */
    if (a.kind === "answer") {
      const m = miniOf(s);
      /* an answer for an earlier question, landing late (a send the server sat on): it goes nowhere, and isn't counted
         as this question's (the 4 Nov audit, 1.10: it could even rank first). A phone still on the build before
         (its key was the bank's id) isn't checked, so a night that spans an update goes on. */
      if (typeof a.payload.k === "string" && /^\d+\.\d+\|q$/.test(a.payload.k) && a.payload.k !== `${qidOf(s)}|q`) { reply("Too late: that answer was for the last question."); publishSoon(); return; }
      const r = m?.key === "majority" ? vote(s, from.name, a.payload.pick)
        : from.role === "captain" ? captainAnswer(s, from.team as number, a.payload as G, Number(a.id) || undefined) : "Your captain answers this one.";
      reply(r === true ? "+" : r);
      /* everyone answers, the Cocktail or Dish too: the faster right, the more points (the owner, 31 Oct) */
      if (r === true && allIn(s)) { reveal(s); publish(); return; }
      publishSoon(); return;
    }
  }, [code, publish, publishSoon, saveKey, lobbyWrite]);

  useInbox(code, isTv, handle);

  /* who's here (every phone on the room's live channel), and in the lobby a captain silent for T_LOBBY_AWAY shows as
     away on the TV, as with two teams (the owner, 2 Nov: 3-8 teams never showed it) */
  const here = useRef({ at: {} as Record<string, number> });
  usePresent(code, isTv, here, members, phone);
  useEffect(() => {
    if (!isTv) return;
    const since = Date.now();                       // (a TV just switched to 3+ teams hasn't heard anyone yet)
    const t = setInterval(() => {
      const { room, members } = ctx.current, H = here.current, now = Date.now();
      if (!room || room.status !== "lobby") return;
      const away = members.filter((m) => m.role === "captain" && now - (H.at[m.user_id] ?? since) >= T_LOBBY_AWAY * 1000).map((m) => m.user_id).sort();
      const was = ((lobbyMine.current.away ?? room.state?.away) as string[] | undefined || []).join(",");
      if (away.join(",") !== was) void lobbyWrite({ away }).then(() => {}, () => { /* the next tick tries again */ });
    }, 3000);
    return () => clearInterval(t);
  }, [isTv, code, lobbyWrite]);

  /* The host gone quiet mid-game (8 Nov, the owner): only the host moves a 3-8 night on, so after 20 s every phone
     and the TV say the night is waiting for a host, and from 90 s since the host was last heard (the server's own
     wait, qmb_claim) anyone in the room can take over. A host who's back, or a new one, clears it */
  const hostFrom = useRef<Record<string, number>>({}), capBusy = useRef(false);
  useEffect(() => {
    if (!isTv) return;
    const since = Date.now();
    const t = setInterval(() => {
      const { room, members } = ctx.current, s = st.current, H = here.current, now = Date.now();
      if (!s) return;
      let changed = false;
      /* away from the game screen 2 s and not back yet: flagged now (how long comes with their "back") */
      for (const [k, x] of Object.entries(awayAt.current)) {
        if (x.flag || now - x.at < 2000) continue;
        const m = members.find((y) => y.user_id === k);
        if (!m) { delete awayAt.current[k]; continue; }
        const id = flagIt(s, m, x.qid, null); x.flag = id ?? -1; if (id) changed = true;
      }
      /* a captain gone a minute while their team still has to answer: the armband passes to a teammate who's still
         here (8 Nov: as with two teams) */
      if (room?.status === "playing" && s.screen === "q" && !capBusy.current) {
        const m = miniOf(s), done = answered(s);
        for (let tm = 0; tm < s.teams.length && m && m.key !== "majority"; tm++) {
          if ((m.only && !m.only.includes(tm)) || done[tm]) continue;
          const cap = members.find((x) => x.team === tm && x.role === "captain");
          if (!cap || now - Math.max(H.at[cap.user_id] ?? 0, since) < T_AWAY * 1000) continue;
          const nx = members.find((x) => x.team === tm && x.role === "player" && now - (H.at[x.user_id] ?? 0) < 40000);
          if (!nx) continue;
          capBusy.current = true;
          void (async () => {
            try {
              const r1 = await sb().from("members").update({ role: "player" }).eq("room", code).eq("user_id", cap.user_id); if (r1.error) return;
              const r2 = await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", nx.user_id);
              if (r2.error) { await sb().from("members").update({ role: "captain" }).eq("room", code).eq("user_id", cap.user_id); return; }
              H.at[nx.user_id] = Date.now(); s.teams[tm].captain = nx.name;
              s.toast = { id: ++s.toastN, text: `${cap.name} seems to be away. ${nx.name} is ${s.teams[tm].name}'s captain now.` };
              publish();
            } finally { capBusy.current = false; }
          })();
          break;
        }
      }
      if (changed) publish();
      const h = members.find((m) => m.role === "host");
      if (h && hostFrom.current[h.user_id] == null) hostFrom.current[h.user_id] = now;   // (a new host: from when it was noticed)
      const playing = room?.status === "playing" && s.screen !== "final";
      const last = h ? Math.max(H.at[h.user_id] ?? 0, hostFrom.current[h.user_id]) : null;
      const gone = playing && (!h || now - (last as number) >= 20000);
      const v = !gone ? null : h ? { name: h.name, since: last as number, openAt: (last as number) + 90000 }
        : { name: null, since: s.hostGone && s.hostGone.name == null ? s.hostGone.since : now, openAt: s.hostGone && s.hostGone.name == null ? s.hostGone.openAt : now };
      const was = s.hostGone;
      if ((!v && !was) || (v && was && v.name === was.name && v.since === was.since)) return;
      s.hostGone = v; publish();
    }, 2000);
    return () => clearInterval(t);
  }, [isTv, publish, code]);

  /* The game's screen goes to sleep or out of sight (a phone running the game, with no TV: a call, another app, the
     screen locking): the clock waits, so nobody's question runs out meanwhile, and picks up where it was when the
     screen's back (the 4 Nov audit, 1.3: 3-8 teams had no pause at all). A copy goes to the server at once, so a
     phone that takes over knows the clock was waiting. */
  useEffect(() => {
    if (!isTv) return;
    const vis = () => {
      const s = st.current, now = Date.now(); if (!s) return;
      if (document.visibilityState === "hidden" && !s.away) {
        s.away = now;
        if (s.screen === "q" && s.deadline) { s.left = Math.max(0, (s.deadline - now) / 1000); s.deadline = null; }
        backedUp.current = { t: 0, screen: "" };
        publish();
      } else if (document.visibilityState === "visible" && s.away) {
        if (s.screen === "q" && !s.deadline && s.left && !s.paused) { s.deadline = now + s.left * 1000; s.left = 0; }
        s.away = 0;
        publish();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [isTv, publish]);

  /* the clock: time up shows the reveal */
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current; if (!s || s.screen !== "q" || !s.deadline) return;
      if (Date.now() >= s.deadline) { reveal(s); publish(); return; }
      /* the Cocktail or Dish: the next ingredient */
      if (miniOf(s)?.key === "dish") { const n = dishShown(s, Date.now(), timers()); if (n !== s.shown) { s.shown = n; publish(); } }
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish]);

  /* the TV's own stepper in the lobby: how many teams (players on a team that goes are left with no team) */
  const setTeamCount = useCallback(async (k: number) => {
    const room = ctx.current.room; if (!room || room.status !== "lobby") return;
    await setTeams(code, room.state || {}, ctx.current.members, k);
  }, [code]);

  return { pub, setTeamCount, banner };
}
