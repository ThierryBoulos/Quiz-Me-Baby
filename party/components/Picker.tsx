"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { QMB, type Bank, type Q } from "@/lib/engine";
import { PARTY_LEGS } from "@/lib/game";
import { AddQuestion } from "./AddQuestion";

/* HAND-PICKED QUESTIONS — Classic's picker (index.html, pickerHTML), for the
   host's phone only: it shows the answers. Two per theme, one for each team;
   a theme left alone gets a matched pair from the app. Mini-games take their
   questions in the order ticked, up to their length; anything short is dealt
   as usual. A theme can run at its own difficulty. */
export type Picks = {
  picks: Record<string, string[]>; themeDiff: Record<string, string>;
  pickClosest: string[]; pickAuction: string[]; pickSaySame: string[]; pickMap: string[]; pickFlag: string[]; pickDish: string[]; pickPin: string[]; pickAirport: string[]; pickMajority: string[];
};
export const NO_PICKS: Picks = { picks: {}, themeDiff: {}, pickClosest: [], pickAuction: [], pickSaySame: [], pickMap: [], pickFlag: [], pickDish: [], pickPin: [], pickAirport: [], pickMajority: [] };
type MiniStore = "pickClosest" | "pickAuction" | "pickSaySame" | "pickMap" | "pickFlag" | "pickDish" | "pickPin" | "pickAirport" | "pickMajority";
const MINI: Record<string, { store: MiniStore; type: string; cap: number; label: string }> = {
  closest: { store: "pickClosest", type: "closest", cap: PARTY_LEGS.closest ?? QMB.LEGS.closest, label: "Closest To Wins" },
  auction: { store: "pickAuction", type: "auction", cap: QMB.LEGS.auction, label: "The Auction" },
  saysame: { store: "pickSaySame", type: "saysame", cap: PARTY_LEGS.saysame ?? QMB.LEGS.saysame, label: "Don't Say the Same as Me" },
  map: { store: "pickMap", type: "map", cap: QMB.LEGS.map, label: "Guess the Map" },
  flag: { store: "pickFlag", type: "flag", cap: QMB.LEGS.flag, label: "Guess the Flag" },
  dish: { store: "pickDish", type: "dish", cap: PARTY_LEGS.dish ?? QMB.LEGS.dish, label: "Guess the Cocktail or Dish" },
  pin: { store: "pickPin", type: "pin", cap: QMB.LEGS.pin, label: "Drop the Pin" },
  airport: { store: "pickAirport", type: "airport", cap: QMB.LEGS.airport, label: "Guess the Airport" },
  majority: { store: "pickMajority", type: "majority", cap: QMB.LEGS.majority, label: "Majority Rules" },
};
const DIFFS = [["", "Tonight's"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"], ["mixed", "Mixed"]] as const;
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : "");
/* a night's difficulty in words: "Mixed", "Expert", "Easy, Medium and Hard" */
const diffWords = (d: string) => {
  if (d === "mixed") return "Mixed";
  const l: string[] = QMB.diffsOf(d).map(cap);
  return l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l[l.length - 1] : l[0] || "";
};

/* how many themes have their pair, and how many mini-game picks there are */
export function pickSummary(p: Picks, themes: string[], minis: string[]) {
  const set = themes.filter((t) => (p.picks[t] || []).length === 2).length;
  const mini = minis.reduce((n, k) => n + (MINI[k] ? p[MINI[k].store].length : 0), 0);
  const own = themes.filter((t) => p.themeDiff[t]).length;
  const bits = [];
  if (set) bits.push(`${set} of ${themes.length} themes hand-picked`);
  if (mini) bits.push(`${mini} mini-game question${mini === 1 ? "" : "s"} picked`);
  if (own) bits.push(`${own} theme${own === 1 ? "" : "s"} at their own difficulty`);
  return bits.length ? bits.join(" · ") : "Pick tonight's questions yourself, or set a difficulty per theme.";
}

/* the picture games only offer the levels switched on in Setup (a question with no level, one of yours, always shows) */
export type PickLevels = Partial<Record<"map" | "flag" | "dish" | "pin" | "airport" | "majority", string[]>>;
export const inLevels = (q: Q, levels: PickLevels) => {
  const on = levels[q.type as keyof PickLevels];
  return !on || !q.level || on.includes(String(q.level));
};
const LEVEL_NAMES: Record<string, string> = { veasy: "Very easy", easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };
const levelName = (l: string) => (/^c-/.test(l) ? "Cocktail " : /^d-/.test(l) ? "Dish " : "") + (LEVEL_NAMES[l.replace(/^[cd]-/, "")] || l).toLowerCase();

/* The picker, one theme or one mini-game at a time (11 Nov, the owner: "Everything" meant scrolling a long way down
   and all the way back up). The chips stay pinned along the top, small, in one row that swipes sideways: a tap jumps
   to that theme or game. A bar pinned along the bottom steps Back and Next (the owner picked both). Each jump starts
   the new list at its top. "+ Add" opens the Add a question form right here, so a new question or theme shows in the
   picker at once. The same picker for two teams and for 3-8 (many: every team plays the two picked; the mini-games'
   lengths are the 3-8 night's, caps). */
type Sec = { kind: "theme" | "mini"; key: string; label: string; extra?: boolean };
export function Picker({ bank, themes, minis, difficulty, levels = {}, value, onChange, onClose, many = false, caps = {}, onUseTheme }: {
  bank: Bank; themes: string[]; minis: string[]; difficulty: string; levels?: PickLevels; value: Picks; onChange: (p: Picks) => void; onClose: () => void;
  many?: boolean; caps?: Partial<Record<string, number>>; onUseTheme?: (t: string) => string | null;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const deal = useMemo(() => QMB.createDealer({ bank: () => bank.bank, used: () => new Set(), noRepeat: () => false,
    ok: { map: (q: Q) => q.type === "map", flag: (q: Q) => q.type === "flag", dish: (q: Q) => q.type === "dish" } }), [bank]);
  const minisOn = minis.filter((k) => MINI[k]);
  const capOf = (k: string) => caps[k] ?? MINI[k].cap;
  const diffFor = (t: string) => value.themeDiff[t] || difficulty;
  const pool = (t: string) => bank.bank.filter((q) => q.type === "standard" && q.theme === t && deal.matchDiff(q, diffFor(t)));
  /* the host's own themes not on tonight's list are here too (one just added among them), to see and swap in */
  const own = useMemo(() => [...new Set(bank.bank.filter((q) => q.type === "standard" && q.theme && !(bank.themes || []).includes(q.theme)).map((q) => q.theme as string))]
    .filter((t) => !themes.includes(t)), [bank, themes]);
  const secs: Sec[] = [...themes.map((t) => ({ kind: "theme" as const, key: t, label: t })), ...own.map((t) => ({ kind: "theme" as const, key: t, label: t, extra: true })),
    ...minisOn.map((k) => ({ kind: "mini" as const, key: k, label: MINI[k].label }))];
  const [at, setAt] = useState(0);
  const i = Math.min(at, Math.max(0, secs.length - 1)), sec = secs[i];
  const body = useRef<HTMLDivElement>(null), chips = useRef<HTMLDivElement>(null);
  /* a new section starts at its top, and its chip comes into view */
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    const c = chips.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    c?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [i]);
  const go = (n: number) => { setNote(null); setAt(Math.max(0, Math.min(secs.length - 1, n))); };

  const tick = (t: string, id: string) => {
    setNote(null);
    const arr = value.picks[t] || [];
    let next: string[];
    if (arr.includes(id)) next = arr.filter((x) => x !== id);
    else if (arr.length >= 2) { setNote(many ? "Two per theme. Untick one first." : "Two per theme, one question for each team. Untick one first."); return; }
    else next = [...arr, id];
    const picks = { ...value.picks }; if (next.length) picks[t] = next; else delete picks[t];
    onChange({ ...value, picks });
  };
  const tickMini = (k: string, id: string) => {
    setNote(null);
    const m = MINI[k], arr = value[m.store], cp = capOf(k);
    if (arr.includes(id)) { onChange({ ...value, [m.store]: arr.filter((x) => x !== id) }); return; }
    if (arr.length >= cp) { setNote(`${cp} is the whole ${m.label}. Untick one first.`); return; }
    onChange({ ...value, [m.store]: [...arr, id] });
  };
  const setThemeDiff = (t: string, d: string) => {
    const themeDiff = { ...value.themeDiff }; if (d) themeDiff[t] = d; else delete themeDiff[t];
    /* a pair picked at the old difficulty may no longer fit: clear it */
    const picks = { ...value.picks }; delete picks[t];
    onChange({ ...value, themeDiff, picks });
  };
  const done = themes.filter((t) => (value.picks[t] || []).length === 2).length;
  const count = (s: Sec) => s.kind === "theme" ? `${(value.picks[s.key] || []).length}/2` : `${value[MINI[s.key].store].length}/${capOf(s.key)}`;
  /* a row (a plain function, not a component: a component made here would be a new one each time, and every row
     would be rebuilt on each tick, which is what made the long lists stick) */
  const row = (key: string, on: boolean, disabled: boolean, onTap: () => void, q: string, sub: string) => (
    <button key={key} type="button" aria-pressed={on} disabled={disabled} onClick={onTap}
      className="pk-row flex items-start gap-3 text-left w-full min-h-[48px] py-2.5 px-3 rounded-[14px] transition-colors disabled:opacity-40"
      style={{ background: on ? "rgba(245,197,24,.12)" : "rgba(255,255,255,.035)", border: `1px solid ${on ? "rgba(245,197,24,.55)" : "transparent"}` }}>
      <span className="mt-0.5 grid place-items-center shrink-0 w-[22px] h-[22px] rounded-[7px]" style={{ background: on ? "var(--color-gold)" : "transparent", border: on ? "none" : "2px solid var(--line-2)" }} aria-hidden>
        {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1400" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
      </span>
      <span className="flex-1 min-w-0"><span className="block text-15 font-semibold leading-snug break-words">{q}</span><span className="block text-13 text-[var(--color-ink-2)] mt-0.5 break-words">{sub}</span></span>
    </button>);

  const themeSec = (t: string, extra?: boolean) => {
    const sel = value.picks[t] || [], list = pool(t), full = sel.length >= 2;
    return (
      <section className="flex flex-col gap-2" aria-label={t}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="display text-22 min-w-0 break-words" style={{ color: "var(--color-gold)" }}>{t}</h3>
          {!extra && <span className="text-13 font-bold" style={{ color: full ? "var(--color-ok)" : sel.length ? "var(--color-no)" : "var(--color-ink-2)" }}>{sel.length} of 2 ticked</span>}
        </div>
        {extra ? (
          <div className="flex flex-col gap-2 rounded-[14px] p-3" style={{ background: "rgba(255,255,255,.05)" }}>
            <p className="text-13 text-[var(--color-ink-2)]">One of your own themes, not in tonight&rsquo;s themes.</p>
            {onUseTheme && <button type="button" className="btn btn-sm btn-gold self-start" onClick={() => { const r = onUseTheme(t); setNote(r); }}>Play it tonight</button>}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-13 text-[var(--color-ink-2)]" htmlFor={"d-" + t}>Difficulty</label>
            <select id={"d-" + t} className="input !min-h-[44px] !text-16 !py-0 flex-1 min-w-0" value={value.themeDiff[t] || ""} onChange={(e) => setThemeDiff(t, e.target.value)}>
              {DIFFS.map(([k, l]) => <option key={k} value={k}>{k ? l : `${l} (${diffWords(difficulty)})`}</option>)}
            </select>
            {sel.length > 0 && <button type="button" className="btn btn-sm btn-ghost shrink-0" onClick={() => { const picks = { ...value.picks }; delete picks[t]; onChange({ ...value, picks }); }}>Clear</button>}
          </div>)}
        {list.length ? list.map((q) => row(q.id, sel.includes(q.id), !!extra || (!sel.includes(q.id) && full), () => tick(t, q.id),
          q.question, `${q.answer} · ${cap(q.difficulty)}${q.use_with ? ` · pairs with "${q.use_with}"` : ""}${q.onTv ? " · The TV's" : q.src === "manual" ? " · Yours" : ""}`))
          : <p className="text-14 text-[var(--color-ink-2)]">Nothing in this theme at {diffWords(diffFor(t))}.</p>}
      </section>);
  };
  const miniSec = (k: string) => {
    const m = MINI[k], sel = value[m.store], cp = capOf(k);
    const list = bank.bank.filter((q) => q.type === m.type && inLevels(q, levels) && (!many || m.type !== "saysame" || (Array.isArray(q.pool) ? q.pool.length : 0) >= 5));
    const lv = levels[m.type as keyof PickLevels];
    return (
      <section className="flex flex-col gap-2" aria-label={m.label}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="display text-22 min-w-0" style={{ color: "var(--color-a)" }}>{m.label}</h3>
          <span className="text-13 font-bold text-[var(--color-ink-2)] shrink-0">{sel.length} of {cp}</span>
        </div>
        <p className="text-13 text-[var(--color-ink-2)]">In the order you tick them. Anything short is dealt as usual.{lv?.length ? ` Showing ${lv.map(levelName).join(", ").replace(/^./, (c) => c.toUpperCase())} only, the levels picked in Setup.` : ""}</p>
        {list.map((q) => {
          const n = sel.indexOf(q.id);
          return row(q.id, n > -1, n < 0 && sel.length >= cp, () => tickMini(k, q.id),
            (n > -1 ? `${n + 1}. ` : "") + (m.type === "flag" || m.type === "dish" || m.type === "pin" || m.type === "airport" ? String(q.answer) : q.question),
            m.type === "flag" ? cap(levelName(String(q.level || ""))) : m.type === "dish" ? String(q.level || "").replace(/^c-/, "Cocktail · ").replace(/^d-/, "Dish · ") : m.type === "map" ? String(q.answer)
              : m.type === "pin" ? `${cap(levelName(String(q.level || "")))} · ${q.place}` : m.type === "airport" ? `${cap(levelName(String(q.level || "")))} · ${q.code}`
              : m.type === "majority" ? `${cap(String(q.level || ""))} · ${q.answer}${q.onTv ? " · The TV's" : q.src === "manual" ? " · Yours" : ""}` : String(q.answer));
        })}
      </section>);
  };

  const nextSec = secs[i + 1];
  return (
    <div className="picker fixed inset-0 z-40 flex flex-col" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Pick tonight's questions">
      <header className="pk-gutter shrink-0 flex flex-col gap-2 pb-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Host only · optional</div><h2 className="display text-26">Pick tonight&rsquo;s questions</h2>
            <div className="text-13 text-[var(--color-ink-2)] mt-0.5">{done} of {themes.length} themes set{many ? " · every team plays the two you pick" : ""}</div></div>
          <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={onClose}>Done</button>
        </div>
        {/* the chips: one row, pinned, swiped sideways */}
        <div ref={chips} className="pk-chips" role="tablist" aria-label="Themes and mini-games">
          <button type="button" className="chip pk-chip pk-add" onClick={() => setAdding(true)}>+ Add</button>
          {secs.map((s, j) => (
            <button key={s.kind + s.key} type="button" role="tab" data-i={j} aria-selected={j === i} className={"chip pk-chip " + (j === i ? "chip-on" : "") + (s.extra ? " pk-own" : "")}
              onClick={() => go(j)}>{s.label}{!s.extra && <span className="pk-n">{count(s)}</span>}</button>))}
        </div>
      </header>
      <div ref={body} className="pk-body pk-gutter flex-1 min-h-0 flex flex-col gap-3 pt-3 pb-4">
        {/* (one short line, the owner, 12 Nov) */}
        <p className="text-13 text-[var(--color-ink-2)]">{many ? "Pick 2 per theme." : "Pick 2, 1 per team."}</p>
        {note && <p className="text-13 text-[var(--color-no)]" role="alert">{note}</p>}
        {!sec ? <p className="text-14 text-[var(--color-ink-2)]">Switch on standard rounds or a mini-game in Setup to pick questions.</p>
          : sec.kind === "theme" ? themeSec(sec.key, sec.extra) : miniSec(sec.key)}
        <button type="button" className="btn btn-sm btn-ghost self-start mt-2" onClick={() => onChange(NO_PICKS)}>Clear every pick</button>
      </div>
      {/* Back and Next, pinned */}
      {/* (the count right beside Back, where it stays: in the middle it moved with the Next button's theme, 12 Nov) */}
      <nav className="pk-gutter shrink-0 grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 pt-2" aria-label="Move between themes and mini-games"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid var(--line)", background: "var(--color-bg)" }}>
        <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => go(i - 1)}>&lsaquo; Back</button>
        <span className="text-13 text-[var(--color-ink-2)] tabular-nums whitespace-nowrap">{secs.length ? `${i + 1} of ${secs.length}` : ""}</span>
        <span aria-hidden />
        {nextSec ? <button type="button" className="btn btn-sm btn-gold min-w-0" onClick={() => go(i + 1)}><span className="truncate max-w-[42vw]">Next: {nextSec.label}</span> &rsaquo;</button>
          : <button type="button" className="btn btn-sm btn-gold" onClick={onClose}>Done</button>}
      </nav>
      {adding && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Add a question">
          <header className="pk-gutter shrink-0 flex items-start justify-between gap-3 pb-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid var(--line)" }}>
            <div className="min-w-0"><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Host only</div><h2 className="display text-26">Add a question</h2></div>
            <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={() => setAdding(false)}>Back to the picker</button>
          </header>
          <div className="pk-body pk-gutter flex-1 min-h-0 pt-3 pb-6">
            <AddQuestion theme={sec?.kind === "theme" ? sec.key : undefined}
              note="Saved on this phone, with your other questions (Settings). It shows in the picker straight away; a new theme of yours shows there too, with a button to play it tonight." />
          </div>
        </div>)}
    </div>);
}
