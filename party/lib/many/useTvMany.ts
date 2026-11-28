"use client";
import { MASCOT_COUNT, pickedOf, takenBy } from "@/components/Mascot";
import { nextScreenAt, tapOnThisScreen, type ScreenAt } from "../tapOn";
import { LIVE_LINES, actCount, usePubLine } from "../liveLines";
import { serverOffset } from "@/components/Clock";
/* MANY TEAMS: the TV runs the night (3 to 8 teams, always with a host). Its own state, saved under its own
   key (qmb.tv.<code>.many), so a two-team save is never read here or the other way round. It shares only the
   inbox (lib/tv/useInbox.ts), the bank and the dealer's decks with the two-team game; none of the two-team
   reducer (lib/tvGame.ts) runs while this one does. */
import { useCallback, useEffect, useRef, useState } from "react";
import { QMB, HOST_ONLY_THEMES, hostOnly, loadBank, type Bank, type Q } from "../engine";
import { sb } from "../supabase";
import { hostGoneNow, passArmband, phoneNote, sameHostGone } from "../handover";
import { cleanSettings, forgetUsed, getSettings, saveSettings, USED_KEY } from "../settings";
import { cleanList, mergeCustom } from "../custom";
import { withCustom } from "../engine";
import { saveLobbyDraft, useLobbyShare } from "../tv/lobbyShare";
import { cap1, TEAM_MAX, type Member, type Room } from "../room";
import { inboxMark, useInbox } from "../tv/useInbox";
import { usePresent } from "../tv/usePresent";
import { useNetProbe } from "../tv/netProbe";
import { DISH_LAST, poss, T_AWAY, T_GRACE_MS, T_LOBBY_AWAY } from "../game";
import { SEE_TYPE } from "../see";
import type { Action, G } from "../tv/rules";
import { playSound } from "../sound";
import { MANY_LEGS, MANY_MAX, qidOf, quizGames, quizSizes, MANY_ROUNDS, MANY_THEMES, MANY_MINIS, MANY_PLAYERS, allIn, answered, titleOf, buzzSee, captainAnswer, seeMiss, contestCall, decideContest, setScores, toggleMrOut, showMapHint, defaultName, dishShown, flip, foolAllIn, foolOpen, foolReveal, legWinners, lockStakes, miniOf, newNight, nightOrder, next, pause, qOf, reveal, skipComeback, skQm, stakesBet, startMini, swapQ, vote, type LatLon, type ManyKey, type StateM, type Timers } from "./logic";
import { buildMany, type PubMany } from "./view";
import { MAJ, mrBackOn } from "../minis/majority";
import { SK_THEMES_CHANGED } from "../stakes";
import { FOOL } from "../minis/fool";
import { useFreshLeftShare } from "../freshLeft";
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
/* Majority Rules' intro: every team's list as it stands (who's on the game screen, who the host took off), and someone
   taken off who comes back to the game screen is put back, as with 2 teams (25 Nov, the owner). true: it changed */
function mrSync(s: StateM, members: Member[], at: Record<string, number>, settled = true): boolean {
  const mk = miniOf(s)?.key === "majority", now = Date.now(), on = members.filter((m) => now - (at[m.user_id] ?? 0) < T_LOBBY_AWAY * 1000).map((m) => m.user_id).sort();
  /* during the game: who has gone from the room or come back to it (they count, or not, from the next question: see
     mrFreeze in logic.ts), and the fixed list for the host's Take off (who's on the game screen, who's off) */
  if (mk && (s.screen === "q" || s.screen === "reveal") && s.roster.length) {
    const names = new Set(members.map((m) => m.name)), away = s.roster.filter((r) => !names.has(r.name)).map((r) => r.name);
    const uid = new Map(members.map((m) => [m.name, m.user_id])), off = s.mrOff || [];
    const L = s.roster.map((r) => ({ name: r.name, team: r.team, here: on.includes(uid.get(r.name) ?? ""), ...(off.includes(r.name) ? { out: true } : {}) }));
    const changed = away.join() !== (s.mrAway || []).join() || JSON.stringify(L) !== JSON.stringify(s.mrList || null);
    s.mrAway = away; s.mrList = L; delete s.mrGone; delete s.mrHere; return changed;
  }
  if (!mk || s.screen !== "intro") { if (!s.mrList && !s.mrHere) return false; delete s.mrList; delete s.mrHere; delete s.mrGone; return false; }
  const hereNames = members.filter((m) => on.includes(m.user_id)).map((m) => m.name);
  /* someone taken off, then seen away (off the game screen, or out of the room), then seen on the game screen: back
     on the list, and the TV says so. Taken off while on the screen and never away: stays off. (Not while the TV is
     still hearing who's here, its first seconds: nobody is taken for away then.) */
  /* (lib/minis/majority.ts, the same as with 2 teams) */
  const { out, gone, back } = mrBackOn(s.mrOut || [], s.mrGone, hereNames, settled);
  if (back.length) { s.mrOut = out; s.toast = { id: ++s.toastN, text: MAJ.backOn(back) }; }
  s.mrGone = gone; s.mrHere = on;
  const off = s.mrOut || [], L = members.filter((m) => m.role !== "host" && m.team != null && (m.team as number) < s.teams.length)
    .map((m) => ({ name: m.name, team: m.team as number, here: on.includes(m.user_id), ...(off.includes(m.name) ? { out: true } : {}) }));
  const changed = back.length > 0 || JSON.stringify(L) !== JSON.stringify(s.mrList || null);
  s.mrList = L; return changed;
}
const timers = (): Timers => { const t = getSettings(); return { sudden: t.tQuestion, quiz: t.tQuestion, flag: t.tFlag, airport: t.tAirport, map: t.tMap, closest: t.tMini, pin: t.tPin, majority: t.tMajority, say: t.tSay, dish: t.tDishStep, dishLast: DISH_LAST, roulette: t.tRoulette,
  stakes: t.tStakesQ, stakesPick: t.tStakesPick, see: t.tSee, fool: t.tFoolWrite, foolPick: t.tFoolPick }; };
/* Fool Me Twice's spare facts, a normal one and a hard one in turn */
const foolSpares = (L: Q[]) => { const a = L.filter((q) => q?.level !== "hard"), b = L.filter((q) => q?.level === "hard"), out: Q[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out; };
/* Russian Roulette: the questions of a lap's drawn chambers count as played on this TV (a dark chamber's don't) */
function markRoulette(s: StateM) {
  const m = s.minis[s.mi], lap = m?.key === "roulette" && s.screen === "q" ? (m.qs[m.i] as { ch: { q: Q }[]; draw?: number[] }) : null;
  if (!lap?.draw) return;
  try { const u = new Set<string>(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); lap.draw.forEach((j) => { const id = lap.ch[j]?.q?.id; if (id) u.add(id); }); localStorage.setItem(USED_KEY, JSON.stringify([...u])); } catch { /* in memory only */ }
}
/* Secret Stakes: only the questions a team bet on count as played (a theme or level nobody picked isn't used up) */
function markStakes(s: StateM) {
  if (s.minis[s.mi]?.key !== "stakes" || s.screen !== "q") return;
  try { const u = new Set<string>(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); s.teams.forEach((_, t) => { const id = skQm(s, t)?.id; if (id) u.add(id); }); localStorage.setItem(USED_KEY, JSON.stringify([...u])); } catch { /* in memory only */ }
}

/* the question on screen counts as played on this TV, whichever way it came: the comeback's, sudden death's, one a
   Change question brought in, What Do You See?'s new picture (19 Nov review: only the games' own were marked at Start).
   (Russian Roulette and Secret Stakes mark their own, above: only what's drawn or bet on) */
function markAsked(s: StateM, id: string) {
  try { const u = new Set<string>(JSON.parse(localStorage.getItem(USED_KEY) || "[]")); if (u.has(id)) return; u.add(id); localStorage.setItem(USED_KEY, JSON.stringify([...u])); } catch { /* in memory only */ }
}

/* the game picks up again (the host's Resume, or the game's screen back after pausing itself): with every answer already
   in (some landed while paused), it moves on, as with 2 teams */
function resumed(s: StateM) {
  const now = Date.now();
  if (s.screen === "q") { if (foolAllIn(s)) foolOpen(s, now, timers()); else if (allIn(s)) reveal(s); }
  else if (s.screen === "pick" && miniOf(s)?.key === "fool" && foolAllIn(s)) foolReveal(s);
}
export function useTvMany(code: string, isTv: boolean, room: Room | null, members: Member[], phone = false) {
  const [banner, setBanner] = useState<null | "offline" | "cantSave" | "oldSave" | "noBank">(null);
  const st = useRef<StateM | null>(null);
  const [pub, setPub] = useState<PubMany | null>(null);
  /* each new screen straight to the phones too, on the room's live line (lib/liveLines.ts) */
  const sendLine = usePubLine(code, isTv);
  const ctx = useRef({ room, members }); ctx.current = { room, members };
  const bank = useRef<Bank | null>(null);
  const saveKey = "qmb.tv." + code + ".many";
  const phoneRef = useRef(phone); phoneRef.current = phone;
  const backedUp = useRef({ t: 0, screen: "" });
  const markedQ = useRef<string | null>(null);
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
  useFreshLeftShare(code, isTv, room?.status, (left) => { void lobbyWrite({ left }); });
  const soon = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishRef = useRef<() => void>(() => {});
  const heard = useRef<{ screen: string; won: boolean; hint?: boolean } | null>(null);   // the screen the TV last made its sound for
  const drafts = useRef<Record<number, { k: string; text: string; pin?: LatLon; seq: number; pick?: number; pred?: number | null }>>({});   // each captain's typed, unsent answer
  const marked = useRef<string | null>(null);    // the Russian Roulette spin (and its questions) marked played
  const markedSk = useRef<number | null>(null);  // ...and the Secret Stakes round's
  const retryT = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* no internet (the TV's writes failing, or sat on 8 s): the clocks wait, as with two teams; back, they move on by
     that much (19 Nov review: a question ran out while no phone could see it, against How to Play) */
  const offline = useRef(false), offlineAt = useRef(0), pendingSince = useRef(0);
  const goOffline = (since: number) => { if (!offline.current) { offline.current = true; offlineAt.current = since; } setBanner((b) => b ?? "offline"); };
  /* the screen up now, and the step it came up at: a Next, Start or Spin tapped on this very screen a step behind is
     still taken (26 Nov, as with 2 teams: in the 15 Nov game Spin took three taps); an earlier screen's, or a second
     tap once the first moved the game on, is still ignored */
  const scrAt = useRef<ScreenAt>({ screen: "", step: 0, mi: -1 });
  const publish = useCallback(() => {
    if (st.current) scrAt.current = nextScreenAt(scrAt.current, st.current);
    if (soon.current) { clearTimeout(soon.current); soon.current = null; }
    const s = st.current; if (!s) return;
    /* the TV's sounds on a new screen, as with 2 teams (22 Nov, the owner: the same sounds in every setup): a game's
       intro, the whoosh and the jingle; the drumroll as the answers come up; "correct" as Next leaves a question
       someone got; the fanfare at a game's result and at the end. (Not on the first screen after a refresh) */
    { const h = heard.current;
      if (h && h.screen !== s.screen) {
        if (s.screen === "intro") { playSound("whoosh"); playSound("jingle"); }
        else if (s.screen === "reveal") playSound("drumroll");
        else if (s.screen === "summary" || s.screen === "final") playSound("win");
        if (h.screen === "reveal" && h.won && (s.screen === "q" || s.screen === "pick")) playSound("correct");
      }
      /* (Guess the Map's hint: the soft chime, as with 2 teams: 24 Nov, the owner) */
      if (h && h.screen === "q" && s.screen === "q" && s.mapHint && !h.hint) playSound("soft");
      heard.current = { screen: s.screen, won: s.screen === "reveal" && legWinners(s).length > 0, hint: !!s.mapHint }; }
    /* the game's screen asleep: a clock that started meanwhile (the last bet in, a new question) waits for it, with all
       its time, as with two teams (14 Nov) */
    if (s.away && s.deadline && (s.screen === "q" || s.screen === "pick") && !s.paused && s.buzz == null) { s.left = Math.max(0.05, (s.deadline - Date.now()) / 1000); s.deadline = null; }
    imadMany(s);                                    // (Imad's line for this moment, if Settings has him on)
    /* (keyed on the spin and its questions: Change question keeps the spin, and its new questions are played too) */
    if (s.screen === "q" && s.spinAt) { const L = miniOf(s)?.key === "roulette" ? (qOf(s) as { ch?: { q?: Q }[]; draw?: number[] } | null) : null, mk = `${s.spinAt}|${(L?.draw || []).map((j) => L?.ch?.[j]?.q?.id).join()}`;
      if (mk !== marked.current) { marked.current = mk; markRoulette(s); } }
    if (s.screen === "q" && miniOf(s)?.key === "stakes" && s.qn !== markedSk.current) { markedSk.current = s.qn ?? null; markStakes(s); }
    { const k = miniOf(s)?.key, id = (qOf(s) as { id?: string } | null)?.id;
      if (s.screen === "q" && k && k !== "roulette" && k !== "stakes" && id && id !== markedQ.current) { markedQ.current = id; markAsked(s, id); } }
    mrSync(s, ctx.current.members, here.current.at, Date.now() - upSince.current > 8000);
    const { pub: p, secret } = buildMany(s, timers());
    p.ack = ack.current;
    const at = Math.max(Date.now(), lastAt.current + 1); lastAt.current = at; p.at = at; p.now = Date.now();
    p.clk = serverOffset() ?? undefined;
    setPub(p);
    sendLine(p, at);
    try { localStorage.setItem(saveKey, JSON.stringify({ build: BUILD_ID, shape: SHAPE, s })); setBanner((b) => (b === "cantSave" ? null : b)); } catch { setBanner("cantSave"); }
    /* a copy on the server, so another phone (no TV: every 4 s at most, 3 Nov) or another laptop ("The TV died?": every
       15 s, 19 Nov review: with a TV there was no copy, and the button gave an error) can carry on; on a new screen at once */
    if (!s.exit && (s.screen !== backedUp.current.screen || Date.now() - backedUp.current.t > (phoneRef.current ? 4000 : 15000))) {
      backedUp.current = { t: Date.now(), screen: s.screen };
      void sb().rpc("qmb_tv_backup", { r: code, s: { many: true, build: BUILD_ID, shape: SHAPE, s, ...inboxMark(code), savedAt: Date.now(), settings: getSettings() } }).then(() => {}, () => {});
    }
    const sec = JSON.stringify(secret), withSecret = sec !== lastSecret.current;
    const job = async () => {
      const room = ctx.current.room;
      const writes = [sb().from("rooms").update({ state: { ...(room?.state || {}), pub: p, pubAt: at, ...(LIVE_LINES ? { lines: actCount.summary() } : {}) } }).eq("code", code)
        .or(`state->>pubAt.is.null,state->>pubAt.lt.${at}`).select("code")];
      if (withSecret) writes.push(sb().from("secrets").update({ data: { ...secret, at } }).eq("room", code)
        .or(`data.is.null,data->>at.is.null,data->>at.lt.${at}`).select("room"));
      if (!pendingSince.current) pendingSince.current = Date.now();
      const res = await Promise.all(writes);
      const bad = res.find((r) => r.error);
      if (bad) { goOffline(Date.now()); throw bad.error; }
      pendingSince.current = 0;
      setBanner((b) => (b === "offline" ? null : b));
      if (offline.current) {
        offline.current = false;
        const d = Math.max(0, Date.now() - offlineAt.current), cur = st.current;
        if (cur && d) { if (cur.deadline) cur.deadline += d; if (cur.buzzAt) cur.buzzAt += d; }
        setTimeout(() => publishRef.current(), 0);
      }
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
      const done = job().catch((e) => { console.error("publish (many)", e); goOffline(Date.now()); if (!retryT.current) retryT.current = setTimeout(() => { retryT.current = null; publishRef.current(); }, 2000); });
      return Promise.race([done, new Promise<void>((r) => setTimeout(() => {
        /* a write the server sits on, not one that fails: nothing landed for 8 s, as good as offline */
        if (pendingSince.current && Date.now() - pendingSince.current > 8000) goOffline(pendingSince.current);
        r();
      }, 2000))]);
    });
  }, [code, saveKey, sendLine]);
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
        /* (a team that buzzed keeps the rest of its 10 seconds too, as with two teams: 14 Nov) */
        /* (paused by the screen going away, a reload among them: it resumes, as when the screen's back) */
        if (s.away) { if (s.awayPaused && s.paused) { pause(s, now); resumed(s); } else if (s.left && (s.screen === "q" || s.screen === "pick") && !s.paused && s.buzz == null) { s.deadline = now + s.left * 1000; s.left = 0; } delete s.awayPaused; if (s.buzz != null && s.buzzAt) s.buzzAt += Math.max(0, now - s.away); s.away = 0; }
        else if (raw.savedAt) { const gone = Math.max(0, now - Number(raw.savedAt)); if (s.deadline) s.deadline += gone; if (s.buzz != null && s.buzzAt) s.buzzAt += gone; }
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
        /* (the team's mascot, picked on the captain's phone with the same message as its name: 28 Nov) */
        if (a.payload.mascot != null) {
          const v = Number(a.payload.mascot); if (!Number.isInteger(v) || v < 0 || v >= MASCOT_COUNT) return;
          const cur = lobbyMine.current.teamMascots ?? room.state?.teamMascots;
          /* (a mascot another team has picked is theirs: 28 Nov, the owner) */
          if (takenBy(cur, from.team as number, k).has(v)) return;
          const ms = Array.from({ length: MANY_MAX }, (_, t) => pickedOf(cur, t)); ms[from.team as number] = v;
          await lobbyWrite({ teamMascots: ms });
          return;
        }
        const names = manyNames(room, MANY_MAX); names[from.team as number] = cap1(String(a.payload.name || "").trim().slice(0, TEAM_MAX)) || names[from.team as number];
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
           back, as one game (scored as one: the owner, 11 Nov); an odd round out joins the last pair, so 5 rounds
           are two games, the last one three rounds (17 Nov, the owner) */
        const rounds = picked.includes("quiz") ? Math.max(1, Math.min(MANY_ROUNDS, Math.floor(Number(cfg.rounds) || 1))) : 0;
        const games = quizGames(rounds);
        /* (Secret Stakes: always the night's last game, 11 Nov, the owner) */
        const keys = nightOrder(games, picked);
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
          /* What Do You See?: its levels, and the kinds of picture the host left on */
          seeLevels: lv(cfg.seeLevels, QMB.SEE_ORDER, QMB.SEE_ORDER), seeKinds: lv(cfg.seeKinds, QMB.SEE_KINDS, QMB.SEE_KINDS), seeLegs: MANY_LEGS.see,
          /* Russian Roulette: a barrel of 6 chambers, 8 with 7 or 8 teams; Sexy Time and Lebanon only if the host picked them */
          rouletteChambers: QMB.rouletteChambers(k), rouletteThemes: chosen,
          /* Secret Stakes: the broad themes and the host's picks, never the host's own trivia */
          stakesThemes: chosen,
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
          closest: all(g.mini), pin: all(g.pinGame), majority: all(g.majorityGame), say, dish: all(g.dishGame), see: all(g.seeGame), roulette: all(g.rouletteGame),
          stakes: [...(g.stakesGame?.rounds || []), ...(g.stakesGame?.spare || [])],
          /* Fool Me Twice: its six facts (four, then two hard), the spare ones after them a normal and a hard in turn, so
             "Change fact" on a hard one finds a hard one */
          fool: [...(g.foolGame?.qs || []), ...foolSpares(g.foolGame?.spare || [])] };
        /* the comeback (17 Nov, the owner; on unless the Setup switched it off): three easy questions, none of tonight's,
           and two spare for "Change question" */
        if (cfg.comeback !== false) { const taken = new Set<string>(); for (const list of Object.values(decks)) for (const q of list || []) if (q?.id) taken.add(q.id);
          for (const R of decks.stakes || []) for (const lv of (R?.qs || []) as G[]) for (const q of Object.values(lv || {}) as G[]) if (q?.id) taken.add(q.id);
          for (const lap of (decks.roulette || []) as G[]) for (const ch of (lap?.ch || []) as G[]) if (ch?.q?.id) taken.add(ch.q.id);
          decks.comeback = dealer.comebackDeck(taken, MANY_LEGS.comeback + 2) as Q[]; }
        const names = manyNames(room, k);
        const teams = names.map((name, t) => ({ name, captain: cap1(members.find((m) => (m.team as number) === t && m.role === "captain")?.name || "") }));
        /* each question-round game two rounds of two questions, the last one three rounds if the rounds are odd */
        st.current = newNight(teams, decks, keys, { quiz: quizSizes(rounds) });
        st.current.intro = true;
        /* the questions dealt count as played on this TV */
        try { for (const mm of st.current.minis) for (const q of mm.qs) if (q?.id) used.add(q.id); localStorage.setItem(USED_KEY, JSON.stringify([...used])); } catch { /* in memory only */ }
        await sb().from("rooms").update({ status: "playing", mode: "many" }).eq("code", code);
        publish(); return;
      }
      return;
    }
    const s = st.current; if (!s || !from) return;
    /* what a captain has typed but not sent, for the question on screen: kept, in case the clock runs out first (as with
       2 teams: 22 Nov, the owner). Quiet: no reply, no new screen */
    if (a.kind === "draft") {
      const t = from.team as number | null, seq = Number(a.payload.seq) || 0, cur = t != null ? drafts.current[t] : undefined;
      /* (Fool Me Twice: the pick chosen but not yet locked in, too, on the picks) */
      const pickK = s.screen === "pick" && miniOf(s)?.key === "fool" ? `${qidOf(s)}|pick` : null;
      if (from.role !== "captain" || t == null || (a.payload.k !== `${qidOf(s)}|q` && a.payload.k !== pickK) || (cur && cur.k === a.payload.k && cur.seq > seq)) return;
      drafts.current[t] = { k: String(a.payload.k), text: String(a.payload.text ?? "").trim().slice(0, 80), pin: a.payload.pin as LatLon | undefined, seq,
        ...(a.payload.k === pickK ? { pick: Number(a.payload.pick), pred: a.payload.pred == null ? null : Number(a.payload.pred) } : {}) };
      return;
    }
    /* a phone's note: it left the game screen during a question, it's back (and for how long, by its own clock), it
       tried to paste an answer (8 Nov: flagged as with two teams; the TV says so, the host's list keeps it) */
    if (a.kind === "count") {
      const n = a.payload as { away?: { qid?: string }; back?: { qid?: string; ms: number }; hello?: number; paste?: { qid?: string } };
      /* (lib/handover.ts, the same as with 2 teams: 27 Nov, the merge) */
      if (phoneNote(s, awayAt.current, a.user_id, from.name, n, Date.now(), (qid, ms, kind) => flagIt(s, from, qid, ms, kind))) publish();
      return;
    }
    /* the host runs it */
    if (a.kind === "judge" && from.role === "host") {
      const mv = (a.payload.move || {}) as G, t = String(mv.type || "");
      /* (Majority Rules: who's in the room right now, before a move can put a question up: 25 Nov) */
      mrSync(s, ctx.current.members, here.current.at, Date.now() - upSince.current > 8000);
      /* (a call changed, or a contest ruled on, carries no step: the reveal's step doesn't move for either) */
      const onThis = tapOnThisScreen(a.payload, t === "m/next" || t === "m/start", s, scrAt.current);
      if (t !== "m/flip" && t !== "m/contestOk" && t !== "m/setScores" && t !== "m/mrOut" && Number(a.payload.step) !== s.step && !onThis) { reply("-"); publish(); return; }
      let ok = false;
      if (t === "m/go") { ok = !!s.intro; delete s.intro; }
      else if (s.intro) ok = false;
      else if (t === "m/start") {
        /* (the host's "Take them off and start": everyone on a list who isn't on the game screen comes off first) */
        if (mv.drop && miniOf(s)?.key === "majority" && s.screen === "intro") for (const x of s.mrList || []) if (!x.here && !x.out) s.mrOut = [...(s.mrOut || []), x.name];
        const r = startMini(s, Date.now(), timers(), roster()); ok = r === true; if (typeof r === "string") { reply(r); publish(); return; } }
      /* (Fool Me Twice: Reveal now on the lies puts the answers up to pick from; on the picks, the reveal) */
      else if (t === "m/reveal" && miniOf(s)?.key === "fool") { ok = s.screen === "q" ? foolOpen(s, Date.now(), timers()) : foolReveal(s); }
      else if (t === "m/reveal" && s.screen === "q") ok = reveal(s);
      else if (t === "m/next") ok = next(s, Date.now(), timers());
      else if (t === "m/flip") ok = flip(s, Number(mv.t), typeof mv.v === "boolean" ? mv.v : undefined);
      else if (t === "m/contestOk") { ok = decideContest(s, !!mv.v); if (ok) imadContest(s); }
      else if (t === "m/hint") ok = showMapHint(s);
      else if (t === "m/setScores") ok = setScores(s, mv.scores);
      else if (t === "m/mrOut") ok = toggleMrOut(s, mv.name);
      else if (t === "m/pause") { ok = pause(s, Date.now()); if (ok && !s.paused) resumed(s); }
      else if (t === "m/cbSkip") ok = skipComeback(s);
      else if (t === "m/swap") { const r = swapQ(s, Date.now(), timers()); ok = r === true; if (typeof r === "string") { reply(r); publish(); return; } }
      else if (t === "m/exit") { s.exit = true; ok = true; try { localStorage.removeItem(saveKey); } catch { /* fine */ } void sb().from("rooms").update({ status: "done" }).eq("code", code).then(() => {}); }   // (a query only goes out once something waits on it: Exit left the room "playing", 27 Nov, the big test)
      else if (t === "m/again") {
        try { localStorage.removeItem(saveKey); } catch { /* fine */ }
        st.current = null; setPub(null);
        await sb().from("rooms").update({ status: "lobby", mode: null, state: { ...room.state, pub: null } }).eq("code", code);
        reply("+"); return;
      }
      reply(ok ? "+" : "-");
      publish(); return;
    }
    /* a captain contests a call on the reveal (8 Nov, the owner): the host decides */
    if (a.kind === "next" && from.role === "captain") {
      const mv = (a.payload.move || {}) as G;
      /* Secret Stakes: a captain's bet, for their own team */
      if (String(mv.type) === "m/bet") { const M = miniOf(s), R = M?.key === "stakes" ? (M.qs[M.i] as { themes?: string[] }) : null;
        /* (a bet tapped on themes that have just been changed: not on the new ones, 14 Nov) */
        if (mv.theme != null && R?.themes?.[Number(mv.k)] !== mv.theme) { reply(SK_THEMES_CHANGED); publish(); return; }
        const r = stakesBet(s, from.team as number, mv.k, mv.level, Date.now(), timers()); reply(r === true ? "+" : r); publish(); return; }
      if (String(mv.type) !== "m/contest") { reply("-"); return; }
      const r = contestCall(s, from.team as number, Number(mv.t));
      reply(r === true ? "+" : r); publish(); return;
    }
    /* What Do You See? (12 Nov, the owner): anyone on a team buzzes for it; the picture stops while they say it out
       loud and their captain types it */
    if (a.kind === "buzz") {
      const r = from.role !== "host" && from.team != null ? buzzSee(s, from.team as number, Date.now(), from.name) : "Only the teams buzz.";
      reply(r === true ? "+" : r);
      if (r === true) playSound("soft");
      publish(); return;
    }
    /* captains answer; in Majority Rules everyone does */
    if (a.kind === "answer") {
      const m = miniOf(s);
      /* an answer for an earlier question, landing late (a send the server sat on): it goes nowhere, and isn't counted
         as this question's (the 4 Nov audit, 1.10: it could even rank first). A phone still on the build before
         (its key was the bank's id) isn't checked, so a night that spans an update goes on. */
      if (typeof a.payload.k === "string" && /^\d+\.\d+\|q$/.test(a.payload.k) && a.payload.k !== `${qidOf(s)}|q`) { reply("Too late: that answer was for the last question."); publishSoon(); return; }
      /* (Fool Me Twice: a lie landing once the answers are up, or a pick for the fact before: not taken) */
      if (m?.key === "fool" && typeof a.payload.k === "string" && a.payload.k !== `${qidOf(s)}|${s.screen}`) { reply(s.screen === "pick" ? FOOL.lateUp : FOOL.lateLast); publishSoon(); return; }
      const r = m?.key === "majority" ? vote(s, from.name, a.payload.pick)
        : from.role === "captain" ? captainAnswer(s, from.team as number, a.payload as G, Number(a.id) || undefined) : "Your captain answers this one.";
      reply(r === true ? "+" : r);
      /* (What Do You See?: checked the moment it lands: the reveal, or that team out and the clock going on) */
      if (r === true && m?.key === "see") { if (s.screen === "q") playSound("wrong"); publish(); return; }
      /* everyone answers, the Cocktail or Dish too: the faster right, the more points (the owner, 31 Oct) */
      /* (Fool Me Twice: every lie in, the answers go up; every pick in, the reveal) */
      /* (paused: the answer is kept, and the reveal waits for Resume) */
      if (r === true && !s.paused && foolAllIn(s)) { if (s.screen === "q") foolOpen(s, Date.now(), timers()); else foolReveal(s); publish(); return; }
      if (r === true && !s.paused && allIn(s)) { reveal(s); publish(); return; }
      publishSoon(); return;
    }
  }, [code, publish, publishSoon, saveKey, lobbyWrite]);

  useInbox(code, isTv, handle);

  /* who's here (every phone on the room's live channel), and in the lobby a captain silent for T_LOBBY_AWAY shows as
     away on the TV, as with two teams (the owner, 2 Nov: 3-8 teams never showed it) */
  const here = useRef({ at: {} as Record<string, number> }), upSince = useRef(Date.now());   // (upSince: since when this screen has been hearing who's here)
  usePresent(code, isTv, here, members, phone);
  useEffect(() => {
    if (!isTv) return;
    const since = Date.now();                       // (a TV just switched to 3+ teams hasn't heard anyone yet)
    const t = setInterval(() => {
      const { room, members } = ctx.current, H = here.current, now = Date.now();
      if (!room || room.status !== "lobby") return;
      /* (anyone on a team, not only a captain: 28 Nov, the owner; the armband can still only be taken from a captain) */
      const away = members.filter((m) => m.team != null && now - (H.at[m.user_id] ?? since) >= T_LOBBY_AWAY * 1000).map((m) => m.user_id).sort();
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
      if (room?.status === "playing" && (s.screen === "q" || (s.screen === "pick" && miniOf(s)?.key === "fool")) && !capBusy.current) {
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
              if (!(await passArmband(code, cap.user_id, nx.user_id))) return;   // (lib/handover.ts, every setup)
              H.at[nx.user_id] = Date.now(); s.teams[tm].captain = nx.name;
              s.toast = { id: ++s.toastN, text: `${cap.name} seems to be away. ${nx.name} is ${poss(s.teams[tm].name)} captain now.` };
              publish();
            } finally { capBusy.current = false; }
          })();
          break;
        }
      }
      /* Majority Rules' intro: who's on the game screen, and someone taken off who's back is on the list again */
      if (mrSync(s, members, H.at, now - upSince.current > 8000)) changed = true;
      if (changed) publish();
      const h = members.find((m) => m.role === "host");
      if (h && hostFrom.current[h.user_id] == null) hostFrom.current[h.user_id] = now;   // (a new host: from when it was noticed)
      const playing = room?.status === "playing" && s.screen !== "final";
      const last = h ? Math.max(H.at[h.user_id] ?? 0, hostFrom.current[h.user_id]) : null;
      const v = hostGoneNow(h, last, playing, s.hostGone, now);   // (lib/handover.ts, every setup)
      if (sameHostGone(v, s.hostGone)) return;
      s.hostGone = v; publish();
    }, 2000);
    return () => clearInterval(t);
  }, [isTv, publish, code]);

  /* The game's screen goes to sleep or out of sight (the TV's laptop dozes, someone switches tab; a phone running the
     game, with no TV: a call, another app, the screen locking): the game pauses, so nobody's question runs out
     meanwhile and everyone sees why the clock stopped, and picks up where it was when the screen's back (as with 2
     teams: 27 Nov, the owner; till then only the clock waited). A copy goes to the server at once, so a phone that
     takes over knows. The host can resume it meanwhile. */
  useEffect(() => {
    if (!isTv) return;
    const vis = () => {
      const s = st.current, now = Date.now(); if (!s) return;
      if (document.visibilityState === "hidden" && !s.away) {
        s.away = now;
        if ((s.screen === "q" || s.screen === "pick") && s.deadline && !s.paused && pause(s, now)) s.awayPaused = true;
        backedUp.current = { t: 0, screen: "" };
        publish();
      } else if (document.visibilityState === "visible" && s.away) {
        if (s.awayPaused && s.paused) { pause(s, now); resumed(s); }
        /* (a question that came up meanwhile waited with its clock full: it starts now) */
        else if ((s.screen === "q" || s.screen === "pick") && !s.deadline && s.left && !s.paused && s.buzz == null) { s.deadline = now + s.left * 1000; s.left = 0; }
        delete s.awayPaused;
        if (s.buzz != null && s.buzzAt) s.buzzAt += now - s.away;      // (a team that buzzed: its 10 seconds waited too)
        s.away = 0;
        publish();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [isTv, publish]);

  /* no internet in a quiet question (nothing written, so no write to fail): the server asked for the time (lib/tv/netProbe.ts) */
  useNetProbe(isTv, { running: () => { const s = st.current; return !!s && (!!s.deadline || !!s.buzzAt); }, offline: () => offline.current,
    lost: (since) => goOffline(since), back: () => publishRef.current() });

  /* the clock: time up shows the reveal */
  const lastWhole = useRef<number | null>(null), alarmed = useRef<number | null>(null), graced = useRef<number | null>(null);
  /* time's up: "wait" through the second's grace (the clock says time up), then each captain's unsent draft goes in */
  const takeDrafts = (s: StateM): "wait" | "done" => {
    if (!s.deadline) return "done";
    if (Date.now() < s.deadline + T_GRACE_MS) { if (graced.current !== s.deadline) { graced.current = s.deadline; publish(); } return "wait"; }
    const m = miniOf(s), k = `${qidOf(s)}|q`;
    /* (no message: it just goes in, every game, every setup: 23 Nov, the owner) */
    if (m && m.key !== "majority" && m.key !== "see") Object.entries(drafts.current).forEach(([t, d]) => {
      if (d.k !== k || (!d.text && !d.pin)) return;
      captainAnswer(s, Number(t), m.key === "closest" ? { n: d.text } : m.key === "pin" ? { pin: d.pin } : { text: d.text });
    });
    drafts.current = {};
    return "done";
  };
  useEffect(() => {
    if (!isTv) return;
    const t = setInterval(() => {
      const s = st.current; if (!s) return;
      if (offline.current) return;                   // (no internet: nothing runs out; see publish)
      /* What Do You See?: a buzz gets 10 seconds to say it and type it; none by then, and the team is out */
      /* (what that captain typed but didn't send counts, as with 2 teams: 23 Nov, the owner) */
      if (s.screen === "q" && s.buzz != null && s.buzzAt && !s.away && Date.now() - s.buzzAt >= SEE_TYPE * 1000 + T_GRACE_MS) {
        const b = s.buzz, d = drafts.current[b]; drafts.current = {};
        if (d && d.k === `${qidOf(s)}|q` && d.text && captainAnswer(s, b, { text: d.text }) === true) { if (s.screen === "q") playSound("wrong"); publish(); return; }
        seeMiss(s, b, Date.now(), true); playSound("wrong"); publish(); return; }
      /* the last ten seconds tick; the bells ring at zero (as with 2 teams: 22 Nov, the owner) */
      { const now = Date.now(), whole = s.deadline && (s.screen === "q" || s.screen === "pick") ? Math.ceil((s.deadline - now) / 1000) : null;
        if (whole !== lastWhole.current) { if (whole != null && whole <= 10 && whole > 0) playSound("tick"); lastWhole.current = whole; }
        if (whole != null && now >= s.deadline! && alarmed.current !== s.deadline) { alarmed.current = s.deadline; playSound("alarm"); } }
      if ((s.screen !== "q" && s.screen !== "pick") || !s.deadline) return;
      /* (Secret Stakes' bets: time's up, the teams that didn't bet take the safe one, and the questions go up) */
      /* (Fool Me Twice: time's up on the lies, the answers go up, ours in place of a lie not written; on the picks, the reveal) */
      if (Date.now() >= s.deadline && s.screen === "q" && miniOf(s)?.key === "fool" && takeDrafts(s) === "wait") return;
      /* (the picks too: a second's grace, then a pick chosen but not locked in counts, with the team named if one is:
         25 Nov, the owner) */
      if (Date.now() >= s.deadline && s.screen === "pick" && miniOf(s)?.key === "fool") {
        if (Date.now() < s.deadline + T_GRACE_MS) { if (graced.current !== s.deadline) { graced.current = s.deadline; publish(); } return; }
        const k = `${qidOf(s)}|pick`;
        for (const [t, d] of Object.entries(drafts.current)) if (d.k === k && d.pick != null && s.fool?.picks[Number(t)] == null) captainAnswer(s, Number(t), { pick: d.pick, pred: d.pred, late: true });
        drafts.current = {};
      }
      if (Date.now() >= s.deadline && miniOf(s)?.key === "fool") { if (s.screen === "q") foolOpen(s, Date.now(), timers()); else foolReveal(s); publish(); return; }
      /* time's up on a question: a second's grace, then what a captain typed but didn't send counts, as with 2 teams
         (22 Nov, the owner) */
      if (Date.now() >= s.deadline && s.screen === "q" && takeDrafts(s) === "wait") return;
      if (Date.now() >= s.deadline) { if (s.screen === "pick") lockStakes(s, Date.now(), timers()); else reveal(s); publish(); return; }
      /* the Cocktail or Dish: the next ingredient */
      if (miniOf(s)?.key === "dish") { const n = dishShown(s, Date.now(), timers()); if (n !== s.shown) { s.shown = n; publish(); } }
    }, 250);
    return () => clearInterval(t);
  }, [isTv, publish]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* the TV's own stepper in the lobby: how many teams (players on a team that goes are left with no team) */
  const setTeamCount = useCallback(async (k: number) => {
    const room = ctx.current.room; if (!room || room.status !== "lobby") return;
    await setTeams(code, room.state || {}, ctx.current.members, k);
  }, [code]);

  return { pub, setTeamCount, banner };
}
