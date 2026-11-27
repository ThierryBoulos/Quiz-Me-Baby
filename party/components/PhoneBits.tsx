"use client";
/* Small phone pieces every setup uses, one copy each (27 Nov, the merge): the status line, the BUZZ button, the box to
   suggest an answer to your captain, Drop the Pin's photo beside the clock, What Do You See?'s question by kind. */
import { useEffect, useState, type ReactNode } from "react";
import { Clock } from "./Clock";
import { PinPhoto } from "./GameParts";
import type { useNoPaste } from "./PhoneGame";
import { seeAsk, type SeeKind } from "@/lib/see";

/* a light vibration where the phone supports it (Android); silently nothing elsewhere */
export const buzzHand = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
/* a question's words can't be copied (nor held for the copy menu) */
export const noCopy = { onCopy: (e: React.ClipboardEvent) => e.preventDefault(), onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
/* a status or an outcome is plain text: boxes are for things you can tap */
export const Line = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <p className={"text-center text-15 text-[var(--color-ink-2)] " + className} role="status">{children}</p>;

/* the BUZZ button in the team's colour, and once tapped, BUZZED! in its place (buzz: what the tap sends) */
export function BuzzPad({ color, buzzed, disabled, buzz }: { color?: string; buzzed: boolean; disabled?: boolean; buzz: () => void }) {
  return buzzed
    ? <div className="display text-center rounded-[16px] grid place-items-center" role="status" style={{ minHeight: 100, fontSize: 40, background: color, color: "#04050e", opacity: 0.85 }}>BUZZED!</div>
    : <button className="btn btn-lg btn-block display" style={{ minHeight: 100, fontSize: 48, background: color, color: "#04050e", borderColor: "transparent" }} disabled={disabled}
        onClick={() => { buzzHand(40); buzz(); }}>BUZZ</button>;
}

/* a player's box to suggest an answer to their captain (the captain sees it; it isn't an answer). limit: the most it
   takes, said under it once reached (Fool Me Twice's lies); sent: the last one sent */
export function SuggestBox({ id, label, value, set, send, max, number, placeholder, np, limit, sent, noFill }: {
  id: string; label: ReactNode; value: string; set: (v: string) => void; send: () => void; max: number; number?: boolean; placeholder: string;
  np: ReturnType<typeof useNoPaste>; limit?: ReactNode; sent?: string | null; noFill?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-2">
      <label className="field-label !mb-0" htmlFor={id}>{label}</label>
      <div className="flex gap-2">
        <input id={id} {...np.props} className="input" autoComplete={noFill ? "off" : undefined} value={value} maxLength={max} inputMode={number ? "decimal" : "text"} placeholder={placeholder}
          onChange={(e) => set(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="btn" disabled={!value.trim()} onPointerDown={(e) => e.preventDefault()} onClick={() => send()}>Send</button>
      </div>
      {np.hint}
      {limit != null && value.length >= max && <div className="text-13 font-bold" style={{ color: "var(--color-gold)" }} role="status">{limit}</div>}
      {sent && <div className="text-13 text-[var(--color-ink-2)]">Sent: <b>{sent}</b></div>}
    </div>);
}

/* Drop the Pin, the landmark: on a captain's phone beside the clock, so the map gets the room; else on its own */
export function PinBeside({ pin, deadline, left, timeUp, small }: { pin: Parameters<typeof PinPhoto>[0]["pin"]; deadline: number | null | undefined; left?: number; timeUp?: boolean; small: boolean }) {
  return small
    ? <div className="flex items-center justify-center gap-4 pin-row"><PinPhoto pin={pin} h={112} small zoom /><span className="main-clock"><Clock deadline={deadline} left={left} timeUp={timeUp} size={64} /></span></div>
    : <PinPhoto pin={pin} h={230} small zoom />;
}

/* What Do You See?: the question by kind, over the picture (the owner, 12 Nov) */
export const SeeAsk = ({ kind }: { kind: SeeKind }) =>
  <div className="text-15 font-bold text-center leading-snug" style={{ color: "var(--color-gold)" }}>{seeAsk(kind)}</div>;

/* the host's (or, with no host, a captain's) Adjust the scores, every setup (27 Nov, the merge): each team's score with
   − and +, 0 to 999; save(v, close) sends it (and asks first, in the setup's words). about: the line under the title;
   note: a line after it (one request at a time); err: a send that failed; saveLabel: the gold button; locked: it can't
   be sent now */
export function ScoreSheet({ teams, about, note, err, saveLabel = "Save the scores", busy, locked, save }: {
  teams: { name: string; score: number; color: string }[]; about: ReactNode; note?: ReactNode; err?: string | null; saveLabel?: string; busy?: boolean; locked?: boolean;
  save: (v: number[], close: () => void) => void;
}) {
  const [open, setOpen] = useState(false), [v, setV] = useState<number[]>(teams.map((t) => t.score));
  const now = teams.map((t) => t.score).join();
  useEffect(() => { if (!open) setV(teams.map((t) => t.score)); }, [open, now]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return <button className="btn btn-sm btn-ghost self-center" onClick={() => setOpen(true)}>Adjust the scores</button>;
  const step = (t: number, d: number) => setV((x) => x.map((n, i) => (i === t ? Math.max(0, Math.min(999, n + d)) : n)));
  const changed = v.some((n, t) => n !== teams[t].score);
  return (
    <div className="card flex flex-col gap-3">
      <div className="eyebrow">Adjust the scores</div>
      <p className="text-13 text-[var(--color-ink-2)]">{about}</p>
      {note}
      {teams.map((t, i) => (
        <div key={i} className="flex items-center gap-3">
          <b className="flex-1 truncate" style={{ color: t.color }}><bdi>{t.name}</bdi></b>
          <button className="btn btn-sm" aria-label={`${t.name} minus one`} onClick={() => step(i, -1)}>−</button>
          <span className="display text-32 w-14 text-center">{v[i]}</span>
          <button className="btn btn-sm" aria-label={`${t.name} plus one`} onClick={() => step(i, 1)}>+</button>
        </div>))}
      {err && <p className="field-error text-center" role="alert">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-gold flex-1" disabled={busy || !changed || locked} onClick={() => save(v, () => setOpen(false))}>{saveLabel}</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>);
}
