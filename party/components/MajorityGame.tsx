"use client";
/* Majority Rules' screens, one copy for every setup (25 Nov, the owner's answers 1 to 18): who plays before Start (the
   TV's lists, names in a line with commas so four teams of eight fit; a phone's list), the question up and its
   reveal on the TV, and every player's four buttons. Each setup hands in its teams, its counts and its clock.
   Up to four teams each team has its own count (who has answered; who picked each answer); from five, the room's. */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dot } from "./many/PartsMany";
import { MAJ } from "@/lib/minis/majority";
import { sendAction, newTap } from "@/lib/supabase";

export type MrTeam = { name: string; color: string };
export type MrEntry = { name: string; team: number; here?: boolean; out?: boolean };
const d = (s: number) => ({ ["--d" as string]: s + "s" }) as CSSProperties;
const bare = (n: string) => n.replace(/[⁨⁩]/g, "");

/* ---- before Start: who plays ---- */
/* the TV: how to join, the QR code and the room's code side by side (one copy for every setup, the 3-to-8 one: 25 Nov,
   the owner) */
export function MajorityJoin({ join, dense }: { join: { url: string; code: string }; dense?: boolean }) {
  return (
    <div className="flex items-center gap-5">
      <div className="rounded-[16px] p-2.5 bg-[#f4f6ff] shrink-0"><QRCodeSVG value={join.url} size={dense ? 112 : 132} bgColor="#f4f6ff" fgColor="#04050e" title="Scan to join this game" /></div>
      <div className="min-w-0">
        <div className="eyebrow text-18 whitespace-nowrap">Not in yet? Join with</div>
        <div className="display leading-none mt-1" style={{ fontSize: dense ? 60 : 72, color: "var(--color-gold)", letterSpacing: "0.08em" }}>{join.code}</div>
      </div>
    </div>);
}
/* the TV: each team's name and count (taken off doesn't count), then its names in a line: grey, not on the game
   screen; crossed out, taken off */
export function WhoPlaysTv({ teams, list }: { teams: MrTeam[]; list: MrEntry[] }) {
  const k = teams.length, fs = k <= 2 ? 22 : k <= 4 ? 19 : 16;
  return (
    <div className="card !py-3 !px-4 flex flex-col gap-2 text-left" role="list" aria-label="Who plays, team by team">
      <div className="eyebrow text-18">{MAJ.listHead}</div>
      {teams.map((t, i) => { const L = list.filter((x) => x.team === i), n = L.filter((x) => !x.out).length; return (
        <div key={i} role="listitem" className="leading-snug break-words" style={{ fontSize: fs }}>
          <span className="font-bold whitespace-nowrap inline-flex items-center gap-1.5 align-middle mr-1.5" style={{ color: t.color }}>
            {k > 2 && <Dot t={i} color={t.color} size={fs - 2} />}<bdi>{t.name}</bdi> · {n}</span>
          {L.length ? L.map((x, j) => (
            <span key={x.name} style={{ color: x.out || !x.here ? "var(--color-ink-3)" : undefined, textDecoration: x.out ? "line-through" : undefined }}>
              <bdi>{x.name}</bdi>{j < L.length - 1 ? ", " : ""}</span>))
            : <span className="text-[var(--color-ink-3)]">{MAJ.nobody}</span>}
        </div>); })}
      <div className="text-14 text-[var(--color-ink-3)]">{MAJ.key}</div>
    </div>);
}

/* a phone: its own team's list (the host: every team's, with Take off and Put back); with 2 teams and no host, a
   captain can ask to take an absent teammate off (ask) */
export function WhoPlaysPhone({ teams, list, me, host, busy, onToggle, ask, during }: {
  teams: MrTeam[]; list: MrEntry[]; me: { name: string; team: number | null }; host?: boolean; busy?: boolean;
  onToggle?: (name: string) => void; ask?: (x: MrEntry) => ((() => void) | null);
  during?: boolean;   // after Start: the fixed list; a change counts from the next question
}) {
  const mine = list.find((x) => bare(x.name) === me.name), k = teams.length;
  const show = host ? teams.map((_, i) => i) : me.team != null ? [me.team] : [];
  return (
    <div className="card flex flex-col gap-2 !p-3">
      <div className="eyebrow">{host || during ? MAJ.hostHead : MAJ.listHead}</div>
      {!host && !during && !(mine && !mine.out) && <p className="text-center font-bold text-16" role="status">{MAJ.notOn}</p>}
      <div className={"grid gap-3 " + (host && k === 2 ? "grid-cols-2" : "grid-cols-1")}>{show.map((t) => { const L = list.filter((x) => x.team === t); return (
        <div key={t} className="flex flex-col gap-1">
          <div className="eyebrow flex items-center gap-1.5" style={{ color: teams[t]?.color }}>{k > 2 && <Dot t={t} color={teams[t]?.color} size={14} />}<bdi>{teams[t]?.name}</bdi> · {L.filter((x) => !x.out).length}</div>
          {L.map((x) => { const a = ask?.(x); return (
            <div key={x.name} className="flex items-center gap-1.5 text-14 min-h-[32px]" style={{ opacity: x.out ? 0.45 : 1 }}>
              <span aria-hidden style={{ color: x.here ? "var(--color-ok)" : "var(--color-ink-3)" }}>{x.here ? "●" : "○"}</span>
              <span className="flex-1 min-w-0 truncate" style={{ textDecoration: x.out ? "line-through" : undefined }}><bdi>{x.name}</bdi></span>
              {host && onToggle && <button className="btn btn-sm !min-h-[32px] !px-2 !text-12 shrink-0" disabled={busy} aria-label={`${x.out ? "Put back" : "Take off"}: ${bare(x.name)}`} onClick={() => onToggle(x.name)}>{x.out ? "Put back" : "Take off"}</button>}
              {a && <button className="btn btn-sm !min-h-[32px] !px-2 !text-12 shrink-0" disabled={busy} aria-label={`Not here: ask to take ${bare(x.name)} off`} onClick={a}>Not here</button>}
            </div>); })}
          {!L.length && <div className="text-14 text-[var(--color-ink-3)]">{MAJ.nobody}</div>}
        </div>); })}</div>
      <p className="text-12 text-[var(--color-ink-3)] text-center">{during ? MAJ.duringNote : MAJ.phoneKey}</p>
    </div>);
}

/* the host's list during the game, folded away under the buttons (25 Nov, the owner: for the one who walked off with
   their phone); no host, a captain's own team's, with Not here */
export function WhoPlaysDuring(p: Parameters<typeof WhoPlaysPhone>[0]) {
  const [open, setOpen] = useState(false), off = p.list.filter((x) => x.out).length;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <button type="button" className="btn btn-sm btn-host btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide the list" : `Who plays${off ? ` (${off} off)` : ""}`}</button>
      {open && <div className="w-full"><WhoPlaysPhone {...p} during /></div>}
    </div>);
}

/* the host's Start (25 Nov, the owner): anyone on a list who isn't on the game screen, said first, with Start anyway
   or Take them off and start; with no host, a captain can't take the other team's players off, so Start anyway only */
export function MajorityStart({ list, busy, start, solo, dock = true }: {
  list: MrEntry[]; busy?: boolean; start: (drop: boolean) => void; solo?: boolean; dock?: boolean;
}) {
  const [ask, setAsk] = useState(false), away = list.filter((x) => !x.here && !x.out).map((x) => bare(x.name));
  if (!ask || !away.length) return <button className={"btn btn-gold btn-lg btn-block mt-auto" + (dock ? " dock" : "")} disabled={busy} onClick={() => (away.length ? setAsk(true) : start(false))}>{MAJ.start}</button>;
  return (
    <div className={"card flex flex-col gap-2 mt-auto" + (dock ? " dock" : "")} role="alert" style={{ borderColor: "var(--color-gold)" }}>
      <p className="text-15 font-bold">{MAJ.notHere(away)}</p>
      <div className={"grid gap-2 " + (solo ? "grid-cols-1" : "grid-cols-2")}>
        <button className="btn" disabled={busy} onClick={() => start(false)}>{MAJ.startAnyway}</button>
        {!solo && <button className="btn btn-gold" disabled={busy} onClick={() => start(true)}>{MAJ.dropStart}</button>}
      </div>
    </div>);
}

/* ---- the TV, a question up: the question, the four answers, the clock and who has answered ---- */
export function MajorityTv({ question, options, teams, answered, clock, sent }: {
  question?: string | null; options: string[]; teams: MrTeam[]; answered: [number, number][]; clock?: ReactNode; sent?: ReactNode;
}) {
  const k = teams.length, n = (question || "").length, many = k > 4;
  const v = answered.reduce((a, x) => a + x[0], 0), of = answered.reduce((a, x) => a + x[1], 0);
  return (<>
    <div className="font-bold max-w-[1400px]" style={{ fontSize: many ? (n > 90 ? 36 : 44) : n > 90 ? 40 : 50, lineHeight: 1.12 }}>{question}</div>
    <div className={"grid grid-cols-2 w-full max-w-[1400px] " + (many ? "gap-4" : "gap-5")}>{options.map((o) => <div key={o} className={"mr-tv-opt" + (many ? " rev" : "")}><span className="flex-1 min-w-0"><bdi>{o}</bdi></span></div>)}</div>
    <div className="flex items-center gap-12">
      {clock}
      {/* up to four teams, each team's count; from five, the room's, and each team's dot under it */}
      {many ? <span className="font-bold text-26 text-left" style={{ color: v >= of && of > 0 ? "var(--color-ok)" : "var(--color-ink-2)" }}>{MAJ.count(v, of)}<br />answered</span>
        : <div className="flex flex-col gap-1 text-left">{teams.map((t, i) => (
          <span key={i} className="font-bold whitespace-nowrap" style={{ color: t.color, fontSize: k > 2 ? 24 : 26 }}><bdi>{t.name}</bdi>: {MAJ.count(answered[i]?.[0] ?? 0, answered[i]?.[1] ?? 0)} answered</span>))}</div>}
    </div>
    {many && sent}
  </>);
}

/* ---- the TV's reveal: the wrong answers drop away, the right one lights up; who picked each (each team's up to
   four, the room's from five); the fact; a player right every time; how each team did on this one ---- */
export function MajorityRevealTv({ question, options, answer, notes, teams, byTeam, counts, right, of, fire }: {
  question?: string | null; options: string[]; answer: string; notes?: string | null; teams: MrTeam[];
  byTeam?: number[][]; counts?: number[]; right: number[]; of: number[]; fire?: { name: string; n: number }[];
}) {
  const k = teams.length, many = k > 4, n = (question || "").length;
  return (<>
    <div className="font-bold max-w-[1400px]" style={{ fontSize: many ? (n > 90 ? 36 : 44) : n > 90 ? 40 : 50, lineHeight: 1.12 }}>{question}</div>
    <div className={"grid grid-cols-2 w-full max-w-[1400px] " + (many ? "gap-4" : "gap-5")}>{options.map((o, i) => { const ok = answer === o;
      const j = options.filter((x, m) => m < i && x !== answer).length;
      const total = counts?.[i] ?? (byTeam?.[i] || []).reduce((a, x) => a + x, 0);
      return (
        <div key={o} className={"mr-tv-opt rev " + (ok ? "ok mr-win" : "dim mr-out")} style={d(ok ? 0.75 : 0.12 + j * 0.2)}>
          <span className="flex-1 min-w-0"><bdi>{o}</bdi></span>
          {many || !byTeam ? <span className="shrink-0 text-26 mr-counts flex items-baseline gap-2" aria-label={`${total} picked it`}><b>{total}</b><span className="text-18 text-[var(--color-ink-2)]">{total === 1 ? "pick" : "picks"}</span></span>
            : <span className={"flex shrink-0 mr-counts " + (k > 2 ? "gap-3 text-22" : "gap-5 text-26")} aria-label={teams.map((t, m) => `${bare(t.name)} ${byTeam[i]?.[m] ?? 0}`).join(", ")}>{teams.map((t, m) => (
              <span key={m} className="flex items-center gap-1.5"><span className="inline-block rounded-full shrink-0" style={{ background: t.color, width: k > 2 ? 14 : 16, height: k > 2 ? 14 : 16 }} aria-hidden /><b className="tabular-nums">{byTeam[i]?.[m] ?? 0}</b></span>))}</span>}
        </div>); })}</div>
    {notes && <div className="max-w-[1300px] leading-snug -mt-1" style={{ color: "var(--color-gold)", fontSize: many ? 24 : 26 }}>{notes}</div>}
    {fire && fire.length > 0 && <div className="text-26 font-bold enter">{fire.map((f) => <span key={f.name} className="mx-3"><span className="flame">🔥</span><bdi>{f.name}</bdi> · {f.n} in a row</span>)}</div>}
    {/* this question, team by team; the game so far is in the bar at the top */}
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 max-w-[1200px] mr-counts" style={{ fontSize: many ? 20 : k > 2 ? 24 : 26 }}>
      <span className="text-[var(--color-ink-2)]">This one:</span>
      {teams.map((t, i) => <span key={i} className="whitespace-nowrap"><b style={{ color: t.color }}><bdi>{t.name}</bdi></b> {right[i] ?? 0} of {of[i] ?? 0} right</span>)}
    </div>
  </>);
}

/* ---- every player's phone (captains too): four buttons, one tap, locked. After it, nothing says which: a neighbour
   can't read it off this screen. A tap the TV turns down says why and lets go of it. At the reveal, this phone's own
   line. Each phone has the answers in its own order ---- */
function phoneOrder(opts: string[], seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = opts.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const buzzHand = (p: number) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
export function MajorityPad({ code, me, qid, k, options, onList, why, up, answer, paused, disabled, ack, noTv }: {
  code: string; me: { user_id: string }; qid: string; k: string; options: string[]; onList: boolean;
  why?: "off" | "back" | null;   // not counted now: taken off (off), or back in the room, counted from the next question (back)
  up: "q" | "reveal" | null; answer?: string | null; paused?: boolean; disabled?: boolean;
  ack?: Record<string, Record<string, string>>; noTv?: boolean;
}) {
  const [mine, setMine] = useState<{ key: string; pick: string; tap: string } | null>(null);
  const [no, setNo] = useState<string | null>(null);
  /* this phone's pick, kept for the question, so a reload doesn't turn it into "You didn't answer" (the 4 Nov audit, 3.14) */
  const store = "qmb.mr." + code;
  useEffect(() => { try { const x = JSON.parse(sessionStorage.getItem(store) || "null"); if (x?.key === k && !mine) setMine({ ...x, tap: "" }); } catch { /* none */ } }, [k]);   // eslint-disable-line react-hooks/exhaustive-deps
  const order = useMemo(() => phoneOrder(options, `${me.user_id}|${qid}`), [options, me.user_id, qid]);
  const got = mine ? ack?.[me.user_id]?.[mine.tap] : undefined;
  useEffect(() => { if (mine && got && got !== "+" && up === "q") { setNo(got === "-" ? (noTv ? "That didn't go through. Tap again." : "The TV didn't take that. Tap again.") : got); setMine(null);
    try { sessionStorage.removeItem(store); } catch { /* none */ } } }, [got]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!no) return; const t = setTimeout(() => setNo(null), 5000); return () => clearTimeout(t); }, [no]);
  if (!onList) return up === "q" ? <p className="text-center text-15 text-[var(--color-ink-2)]">{why === "off" ? MAJ.offList : why === "back" ? MAJ.backNext : MAJ.watching}</p> : null;
  const picked = mine?.key === k ? mine.pick : null;
  if (up === "reveal") {
    const right = !!picked && picked === answer;
    return <p className="text-center font-bold text-18" role="status" style={{ color: right ? "var(--color-ok)" : "var(--color-no)" }}>{MAJ.mine(picked, right)}</p>;
  }
  if (up !== "q" || paused) return null;
  if (picked) return <p className="text-center font-bold text-16" role="status">Locked in. The answer comes up when the time&rsquo;s up.</p>;
  const tap = (pick: string) => {
    const t = newTap();
    setMine({ key: k, pick, tap: t }); setNo(null); buzzHand(15);
    try { sessionStorage.setItem(store, JSON.stringify({ key: k, pick })); } catch { /* in memory only */ }
    void sendAction(code, "answer", { pick, k, tap: t }).catch(() => setMine(null));
  };
  return (
    <div className="flex flex-col gap-2">
      {no && <p className="text-center text-14 font-bold" role="alert" style={{ color: "var(--color-gold)" }}>{no}</p>}
      <div className="grid gap-2.5" role="group" aria-label="The four answers">
        {order.map((o) => <button key={o} type="button" className="btn btn-lg btn-block mr-opt" disabled={disabled} onClick={() => tap(o)}><bdi>{o}</bdi></button>)}
      </div>
      <p className="text-center text-12 text-[var(--color-ink-3)]">One tap, and it&rsquo;s locked.</p>
    </div>);
}
