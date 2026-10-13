"use client";
/* The pieces every in-game screen shares — the TV and every phone — copied
   from Classic (index.html): the HUD tracker, the round intro with each
   team's lifelines, the "Question for TEAM A" head, the lifeline tiles and
   the mini-game intro with its rules. One look everywhere. */
import type { ReactNode } from "react";
import type { Pub } from "@/lib/game";

const ICON = {
  friend: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>,
  dip: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M9 5H4v5" /><path d="M15 19h5v-5" /><path d="M4 10a8 8 0 0 1 14-4" /><path d="M20 14a8 8 0 0 1-14 4" /></svg>,
  dbl: <svg className="ic" viewBox="0 0 24 24" aria-hidden><path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9Z" /></svg>,
};
const LL_NAME = { friend: "Call a Friend", dip: "Double Dip", dbl: "Double Points" } as const;
const side = (t: 0 | 1) => (t === 0 ? "a" : "b");

/* ---- the tracker: scores, where we are, and the night's progress ---- */
function hudLabel(pub: Pub): ReactNode {
  const m = pub.mini, sc = pub.screen;
  if (sc === "final") return <b>Final result</b>;
  if (sc === "sudden") return <b>Sudden death</b>;
  if (m) {
    const tail = /Summary$|Result$/.test(sc) ? "Final" : /Tie$/.test(sc) && m.key !== "battle" ? "Level"
      : m.key === "battle" && pub.battle ? (sc === "battleTie" ? `Tie-breaker ${pub.battle.tb ?? 1}` : `${pub.teams[pub.battle.cap].name} ${Math.min(pub.battle.i + 1, pub.battle.n)}/${pub.battle.n}`)
      : m.tie ? "Tie-breaker" : `Leg ${m.leg} of ${m.of}`;
    return <><b>{m.title}</b> &nbsp;·&nbsp; {tail}</>;
  }
  return <>Round <b>{Math.min(pub.r + 1, pub.N)}</b> of {pub.N} &nbsp;·&nbsp; <b>{pub.theme}</b></>;
}
export function Hud({ pub, size }: { pub: Pub; size: "tv" | "phone" }) {
  const T = pub.teams;
  return (
    <div className={"hud " + size} role="group" aria-label="Scores">
      <div className="hud-in">
        <div className="hud-team a"><span className="dot" /><div className="nm">{T[0].name}</div><div className="sc">{T[0].score}</div></div>
        <div className="hud-mid">
          <div className="hud-label">{hudLabel(pub)}</div>
          {pub.pips && pub.pips.length > 0 && <div className="pips" aria-hidden>{pub.pips.map((p, i) => <span key={i} className={`pip ${p.kind === "mini" ? "mini" : ""} ${p.state === "todo" ? "" : p.state}`} />)}</div>}
        </div>
        <div className="hud-team b"><div className="sc">{T[1].score}</div><div className="nm">{T[1].name}</div><span className="dot" /></div>
      </div>
    </div>);
}

/* ---- a team's remaining lifelines, as Classic's badges ---- */
function Inventory({ pub, t }: { pub: Pub; t: 0 | 1 }) {
  const ll = pub.teams[t].ll;
  return (
    <div className="ll-inv grid-cols-2">
      {(["friend", "dip"] as const).map((k) => <span key={k} className={"badge " + (ll[k] ? "line" : "no")}>{LL_NAME[k]}</span>)}
    </div>);
}

/* ---- the round intro: theme, who's first, and "double points, yes or no?" ----
   The Double Points tile is a button on that team's captain's phone; everyone
   else sees the same tile, lit or not, so the room knows what was armed. */
export function RoundIntro({ pub, canArm, onArm, size, busy }: { pub: Pub; canArm?: (t: 0 | 1) => boolean; onArm?: (t: 0 | 1) => void; size: "tv" | "phone"; busy?: boolean }) {
  const T = pub.teams, tv = size === "tv";
  const card = (t: 0 | 1) => {
    const armed = !!pub.dbl?.[t], can = T[t].ll.dbl, mine = !!canArm?.(t);
    const cls = "ll " + (armed ? "armed" : can ? "" : "usedup");
    const label = armed ? "Double points armed" : can ? (mine ? "Arm double points" : "Not armed") : "Double points already used";
    return (
      <div key={t} className={"team-card " + side(t)}>
        <div className="flex items-center justify-between gap-2">
          <span className="team-tag">{T[t].name}</span>
          {pub.captains?.[t] && <span className="badge line">Captain: {pub.captains[t]}</span>}
        </div>
        {mine && (can || armed)
          ? <button type="button" className={cls} disabled={busy} aria-pressed={armed} onClick={() => onArm?.(t)}>{ICON.dbl}<span className="nm">{armed ? "Armed: tap to undo" : label}</span></button>
          : <div className={cls} aria-label={label}>{ICON.dbl}<span className="nm">{label}</span></div>}
        <Inventory pub={pub} t={t} />
      </div>);
  };
  return (
    <div className={"flex flex-col items-center text-center " + (tv ? "gap-5" : "gap-4")}>
      <div className="flex flex-col items-center gap-2">
        <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>Round {pub.r + 1} of {pub.N}</div>
        <h1 className="display" style={{ fontSize: tv ? 104 : 46 }}>{pub.theme}</h1>
        <p className="text-[var(--color-ink-2)]" style={{ fontSize: tv ? 22 : 13 }}>{T[pub.first ?? 0].name} answers first</p>
      </div>
      <div className={"card flex flex-col gap-3 w-full " + (tv ? "" : "ri-sm !p-3")}>
        <div>
          <div className="eyebrow" style={{ fontSize: tv ? 15 : undefined }}>{tv ? "Captains: double points, yes or no?" : "Double points, yes or no?"}</div>
          <p className="text-[var(--color-ink-3)] mt-1.5" style={{ fontSize: tv ? 16 : 12 }}>{tv ? "Armed now, before the questions. A team that arms it may use only one other lifeline this round." : "Captains arm it now. Armed, a team gets one other lifeline this round."}</p>
        </div>
        <div className={tv ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-3"}>{card(0)}{card(1)}</div>
      </div>
    </div>);
}

/* ---- "QUESTION FOR TEAM A": the head of a question or a steal ---- */
export function AskHead({ pub, you, go, size }: { pub: Pub; you?: string; go?: boolean; size: "tv" | "phone" }) {
  const t = (pub.turn ?? 0) as 0 | 1, T = pub.teams, steal = pub.screen === "steal", tv = size === "tv";
  const armed = !steal && !!pub.dbl?.[t];
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div className="q-theme" style={steal ? { borderColor: "var(--color-gold)", color: "var(--color-gold)", fontSize: tv ? 15 : undefined } : { fontSize: tv ? 15 : undefined }}>
        {steal ? "Steal" : pub.theme}{armed && <> &nbsp;·&nbsp; <span style={{ color: "var(--color-gold)" }}>Double points</span></>}
      </div>
      <p className={"whofor " + side(t)} style={{ fontSize: tv ? 30 : 18 }}>{steal ? "Steal for" : "Question for"} <b>{T[t].name}</b></p>
      <p className="reader" style={{ fontSize: tv ? 15 : 11 }}>
        {steal ? "No lifelines on a steal" : pub.captains?.[t] ? `Answer from ${pub.captains[t]} only` : "Only the captain's answer counts"}
      </p>
      {you && <p className={"you-line mt-1 " + (go ? "go" : "")}>{you}</p>}
    </div>);
}

/* ---- the lifelines of the team answering: tiles everyone sees; the captain taps ---- */
export function LifelineStrip({ pub, t, onUse, busy, size }: { pub: Pub; t: 0 | 1; onUse?: (k: "friend" | "dip") => void; busy?: boolean; size: "tv" | "phone" }) {
  const team = pub.teams[t], used = pub.llUsed?.[t] || [], armed = !!pub.dbl?.[t];
  const blocked = armed && used.length >= 1;
  const tile = (k: "friend" | "dip") => {
    const inuse = used.includes(k), spent = !team.ll[k] && !inuse;
    const cls = "ll " + (inuse ? "inuse" : spent ? "spent" : blocked ? "off" : "");
    const can = !!onUse && !inuse && !spent && !blocked;
    return can
      ? <button key={k} type="button" className={cls} disabled={busy} onClick={() => onUse!(k)}>{ICON[k]}<span className="nm">{LL_NAME[k]}</span></button>
      : <div key={k} className={cls}>{ICON[k]}<span className="nm">{inuse ? `${LL_NAME[k]}: used now` : LL_NAME[k]}</span></div>;
  };
  return (
    <div className={"card flex flex-col " + (size === "tv" ? "gap-2.5" : "gap-2 !p-3")} style={size === "tv" ? { padding: 14 } : undefined}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="eyebrow">Lifelines · {team.name}</div>
        {armed && <span className="badge gold">Double points armed</span>}
      </div>
      <div className={"ll-grid " + (size === "phone" ? "sm" : "")}>
        {tile("friend")}{tile("dip")}
        <div className={"ll " + (armed ? "armed" : "off")}>{ICON.dbl}<span className="nm">{armed ? "Double armed" : "Round start only"}</span></div>
      </div>
      {onUse && blocked && <p className="text-[12px] text-[var(--color-ink-3)]">Double points armed: no more lifelines this round.</p>}
    </div>);
}

/* ---- the mini-game intro: title, the gold band, the numbered rules ---- */
function rules(pub: Pub): { text: string; warn?: boolean }[] {
  const m = pub.mini!, n = m.of, pts = m.pts, host = pub.mode === "host";
  switch (m.key) {
    case "closest": return [
      { text: "Both teams get the same number question at the same time." },
      { text: `${pub.tMini ?? 90} seconds for each captain to lock in one number on their phone.` },
      { text: "Closest number wins the leg. Tie = one point each." },
      { text: "No lifelines in this leg.", warn: true },
      { text: `After ${n} legs, whoever leads takes ${pts} points. Tied on legs? An extra tie-breaker question is pulled straight away.` }];
    case "auction": return [
      { text: `${n} categories. The open alternates, so nobody bids blind twice.` },
      { text: "One captain bids on their phone: how many they can name. The other raises, or passes." },
      { text: "Whoever holds the bid gets 30 seconds to name that many, out loud." },
      { text: `${host ? "The host counts" : "The other captain counts"}. Make it, you take the leg. Fall short and the other team takes it.` },
      { text: `No lifelines, no help from the room. Most legs takes ${pts} points.`, warn: true }];
    case "saysame": return [
      { text: "A prompt, 20 seconds. Both captains type an answer, hidden from each other. The app has a word hidden: matching each other is fine, only matching the app costs you." },
      { text: `Time's up: the word comes up. ${host ? "The host can overrule the app." : "Each captain can overrule the app on the other team."}` },
      { text: "Dodged it alone? You take the leg. Both dodged or both said it? Tie, a point each." },
      { text: `Most legs after ${n} takes ${pts} points. Level? Straight into a tie-breaker.` }];
    case "map": return [
      { text: "A map goes up: no title, just the colours. 60 seconds." },
      { text: "Both captains type what the map shows, at the same time." },
      { text: `${host ? "The host reveals it and rules." : "It's revealed, and each captain rules on the other team's answer."} The idea counts, not the exact words. Both right? A point each. Nobody? Nobody.` },
      { text: `Best of ${n} takes ${pts} points. Level at the end? ${host ? "The host decides: another map, or a point each." : "Another map if there's one left, otherwise a point each."}` }];
    case "flag": return [
      { text: "A flag goes up. 15 seconds." },
      { text: "Both captains type whose flag it is, at the same time. Country names come up as you type." },
      { text: `The app checks them${host ? ", and the host can overrule" : ", and each captain can overrule it on the other team"}. Both right? A point each. Nobody? Nobody.` },
      { text: `Best of ${n} takes ${pts} points. Level, even at nothing each, and another flag comes out until somebody gets one.` }];
    case "dish": return [
      { text: "The ingredients come up one at a time, a new one every 3 seconds. The giveaway comes last." },
      { text: "Know it? Captain, hit BUZZ: the first buzz answers." },
      { text: "One go per team. Wrong, and you're out of that one: the list keeps coming for the other team." },
      { text: `Best of ${n} takes ${pts} points. Level at the end? ${host ? "One more to settle it, or a point each: the host's call." : "One more to settle it if there's one left, otherwise a point each."}` }];
    case "battle": return [
      { text: "Captains only. The room says nothing, and that means nothing.", warn: true },
      { text: `${n} questions each, ${host ? "7 seconds a shot, out loud" : "15 seconds a shot, typed on the phone"}. ${pub.teams[0].name}'s captain goes first.` },
      { text: "Same spread for both: five easy, five medium, in the same order. Different questions." },
      { text: "No lifelines, no conferring, no second guesses." },
      { text: `Best score takes ${pts} points. Tie? One more question, first captain to buzz wins it.` }];
  }
}
export function MiniIntro({ pub, size }: { pub: Pub; size: "tv" | "phone" }) {
  const m = pub.mini, tv = size === "tv";
  if (!m) return null;
  const band = m.key === "battle" ? `${m.of} questions each` : `Best of ${m.of}`;
  return (
    <div className={"flex flex-col items-center text-center w-full " + (tv ? "gap-5" : "gap-4")}>
      <div className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 16 : undefined }}>{m.key === "battle" ? "The last word" : "Mini-game"}</div>
      <h1 className="display" style={{ fontSize: tv ? 88 : 44 }}>{m.title}</h1>
      <div className={"mini-band " + (tv ? "" : "sm")}>
        <span className="eyebrow" style={{ color: "var(--color-gold)", fontSize: tv ? 15 : 11 }}>{band}</span>
        <span className="sep text-[var(--color-ink-3)]">·</span>
        <span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>Winner takes {m.pts} points</span>
        {m.kinds && <><span className="sep text-[var(--color-ink-3)]">·</span><span className="eyebrow" style={{ fontSize: tv ? 15 : 11 }}>{m.kinds}</span></>}
      </div>
      <div className="card w-full">
        <ol className="rules" style={tv ? { fontSize: 20, gap: 12 } : undefined}>
          {rules(pub).map((r, i) => <li key={i} className={r.warn ? "warn" : undefined}>{r.text}</li>)}
        </ol>
      </div>
    </div>);
}
