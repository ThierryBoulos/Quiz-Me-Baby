"use client";
import { useMemo, useState } from "react";
import { QMB, type Bank, type Q } from "@/lib/engine";
import { PARTY_LEGS } from "@/lib/game";

/* HAND-PICKED QUESTIONS — Classic's picker (index.html, pickerHTML), for the
   host's phone only: it shows the answers. Two per theme, one for each team;
   a theme left alone gets a matched pair from the app. Mini-games take their
   questions in the order ticked, up to their length; anything short is dealt
   as usual. A theme can run at its own difficulty. */
export type Picks = {
  picks: Record<string, string[]>; themeDiff: Record<string, string>;
  pickClosest: string[]; pickAuction: string[]; pickSaySame: string[]; pickMap: string[]; pickFlag: string[]; pickDish: string[];
};
export const NO_PICKS: Picks = { picks: {}, themeDiff: {}, pickClosest: [], pickAuction: [], pickSaySame: [], pickMap: [], pickFlag: [], pickDish: [] };
type MiniStore = "pickClosest" | "pickAuction" | "pickSaySame" | "pickMap" | "pickFlag" | "pickDish";
const MINI: Record<string, { store: MiniStore; type: string; cap: number; label: string }> = {
  closest: { store: "pickClosest", type: "closest", cap: QMB.LEGS.closest, label: "Closest To Wins" },
  auction: { store: "pickAuction", type: "auction", cap: QMB.LEGS.auction, label: "The Auction" },
  saysame: { store: "pickSaySame", type: "saysame", cap: PARTY_LEGS.saysame ?? QMB.LEGS.saysame, label: "Don't Say the Same" },
  map: { store: "pickMap", type: "map", cap: QMB.LEGS.map, label: "Guess the Map" },
  flag: { store: "pickFlag", type: "flag", cap: QMB.LEGS.flag, label: "Guess the Flag" },
  dish: { store: "pickDish", type: "dish", cap: PARTY_LEGS.dish ?? QMB.LEGS.dish, label: "Cocktail or Dish" },
};
const DIFFS = [["", "Tonight's"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["mixed", "Mixed"]] as const;
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : "");

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

export function Picker({ bank, themes, minis, difficulty, value, onChange, onClose }: {
  bank: Bank; themes: string[]; minis: string[]; difficulty: string; value: Picks; onChange: (p: Picks) => void; onClose: () => void;
}) {
  const [filter, setFilter] = useState<string>("");
  const [note, setNote] = useState<string | null>(null);
  const deal = useMemo(() => QMB.createDealer({ bank: () => bank.bank, used: () => new Set(), noRepeat: () => false,
    ok: { map: (q: Q) => q.type === "map", flag: (q: Q) => q.type === "flag", dish: (q: Q) => q.type === "dish" } }), [bank]);
  const minisOn = minis.filter((k) => MINI[k]);
  const diffFor = (t: string) => value.themeDiff[t] || difficulty;
  const pool = (t: string) => bank.bank.filter((q) => q.type === "standard" && q.theme === t && deal.matchDiff(q, diffFor(t)));
  const shownThemes = filter.startsWith("mini:") ? [] : filter ? [filter] : themes;
  const shownMinis = filter.startsWith("mini:") ? [filter.slice(5)] : filter ? [] : minisOn;

  const tick = (t: string, id: string) => {
    setNote(null);
    const arr = value.picks[t] || [];
    let next: string[];
    if (arr.includes(id)) next = arr.filter((x) => x !== id);
    else if (arr.length >= 2) { setNote("Two per theme, one question for each team. Untick one first."); return; }
    else next = [...arr, id];
    const picks = { ...value.picks }; if (next.length) picks[t] = next; else delete picks[t];
    onChange({ ...value, picks });
  };
  const tickMini = (k: string, id: string) => {
    setNote(null);
    const m = MINI[k], arr = value[m.store];
    if (arr.includes(id)) { onChange({ ...value, [m.store]: arr.filter((x) => x !== id) }); return; }
    if (arr.length >= m.cap) { setNote(`${m.cap} is the whole ${m.label}. Untick one first.`); return; }
    onChange({ ...value, [m.store]: [...arr, id] });
  };
  const setThemeDiff = (t: string, d: string) => {
    const themeDiff = { ...value.themeDiff }; if (d) themeDiff[t] = d; else delete themeDiff[t];
    /* a pair picked at the old difficulty may no longer fit: clear it */
    const picks = { ...value.picks }; delete picks[t];
    onChange({ ...value, themeDiff, picks });
  };
  const done = themes.filter((t) => (value.picks[t] || []).length === 2).length;
  const Row = ({ on, disabled, onTap, q, sub }: { on: boolean; disabled?: boolean; onTap: () => void; q: string; sub: string }) => (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onTap}
      className="flex items-start gap-3 text-left w-full min-h-[48px] py-2.5 px-3 rounded-[14px] transition-colors disabled:opacity-40"
      style={{ background: on ? "rgba(245,197,24,.12)" : "rgba(255,255,255,.035)", border: `1px solid ${on ? "rgba(245,197,24,.55)" : "transparent"}` }}>
      <span className="mt-0.5 grid place-items-center shrink-0 w-[22px] h-[22px] rounded-[7px]" style={{ background: on ? "var(--color-gold)" : "transparent", border: on ? "none" : "2px solid var(--line-2)" }} aria-hidden>
        {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1400" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
      </span>
      <span className="flex-1 min-w-0"><span className="block text-[15px] font-semibold leading-snug">{q}</span><span className="block text-[13px] text-[var(--color-ink-2)] mt-0.5">{sub}</span></span>
    </button>);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Pick tonight's questions">
      <div className="screen !gap-4">
        <header className="flex items-start justify-between gap-3 sticky top-0 z-10 -mx-5 px-5 pt-1 pb-3" style={{ background: "var(--color-bg)" }}>
          <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Host only · optional</div><h2 className="display text-[30px]">Pick tonight&rsquo;s questions</h2>
            <div className="text-[13px] text-[var(--color-ink-2)] mt-1">{done} of {themes.length} themes set</div></div>
          <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={onClose}>Done</button>
        </header>
        <p className="text-[14px] text-[var(--color-ink-2)] -mt-2">Two per theme, one for each team. Themes you leave alone get a matched pair. The answers show here, so keep this phone to yourself.</p>
        {note && <p className="text-[13px] text-[var(--color-no)]" role="alert">{note}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className={"chip " + (!filter ? "chip-on" : "")} aria-pressed={!filter} onClick={() => setFilter("")}>Everything</button>
          {themes.map((t) => <button key={t} type="button" className={"chip " + (filter === t ? "chip-on" : "")} aria-pressed={filter === t} onClick={() => setFilter(t)}>{t} {(value.picks[t] || []).length}/2</button>)}
          {minisOn.map((k) => <button key={k} type="button" className={"chip " + (filter === "mini:" + k ? "chip-on" : "")} aria-pressed={filter === "mini:" + k} onClick={() => setFilter("mini:" + k)}>{MINI[k].label} {value[MINI[k].store].length}/{MINI[k].cap}</button>)}
        </div>

        {shownThemes.map((t) => {
          const sel = value.picks[t] || [], list = pool(t), full = sel.length >= 2;
          return (
            <section key={t} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="display text-[22px]" style={{ color: "var(--color-gold)" }}>{t}</div>
                <span className="text-[13px] font-bold" style={{ color: full ? "var(--color-ok)" : sel.length ? "var(--color-no)" : "var(--color-ink-2)" }}>{sel.length} of 2 ticked</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[13px] text-[var(--color-ink-2)]" htmlFor={"d-" + t}>Difficulty</label>
                <select id={"d-" + t} className="input !min-h-[44px] !text-[16px] !py-0 flex-1 min-w-0" value={value.themeDiff[t] || ""} onChange={(e) => setThemeDiff(t, e.target.value)}>
                  {DIFFS.map(([k, l]) => <option key={k} value={k}>{k ? l : `${l} (${cap(difficulty)})`}</option>)}
                </select>
                {sel.length > 0 && <button type="button" className="btn btn-sm btn-ghost shrink-0" onClick={() => { const picks = { ...value.picks }; delete picks[t]; onChange({ ...value, picks }); }}>Clear</button>}
              </div>
              {list.length ? list.map((q) => (
                <Row key={q.id} on={sel.includes(q.id)} disabled={!sel.includes(q.id) && full} onTap={() => tick(t, q.id)}
                  q={q.question} sub={`${q.answer} · ${cap(q.difficulty)}${q.use_with ? ` · pairs with "${q.use_with}"` : ""}${q.src === "manual" ? " · Yours" : ""}`} />))
                : <p className="text-[14px] text-[var(--color-ink-2)]">Nothing in this theme at {cap(diffFor(t))} difficulty.</p>}
            </section>);
        })}

        {shownMinis.map((k) => {
          const m = MINI[k], sel = value[m.store];
          const list = bank.bank.filter((q) => q.type === m.type);
          return (
            <section key={k} className="card flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="display text-[22px]" style={{ color: "var(--color-a)" }}>{m.label}</div>
                <span className="text-[13px] font-bold text-[var(--color-ink-2)]">{sel.length} of {m.cap}</span>
              </div>
              <p className="text-[13px] text-[var(--color-ink-2)]">In the order you tick them. Anything short is dealt as usual.</p>
              {list.map((q) => {
                const i = sel.indexOf(q.id);
                return <Row key={q.id} on={i > -1} disabled={i < 0 && sel.length >= m.cap} onTap={() => tickMini(k, q.id)}
                  q={(i > -1 ? `${i + 1}. ` : "") + (m.type === "flag" || m.type === "dish" ? q.answer : q.question)}
                  sub={m.type === "flag" ? cap(String(q.level || "")) : m.type === "dish" ? String(q.level || "").replace(/^c-/, "Cocktail · ").replace(/^d-/, "Dish · ") : m.type === "map" ? q.answer : String(q.answer)} />;
              })}
            </section>);
        })}

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn" onClick={() => onChange(NO_PICKS)}>Clear everything</button>
          <button type="button" className="btn btn-gold" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>);
}
