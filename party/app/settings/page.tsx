"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { loadBaseBank, type Bank, type Q } from "@/lib/engine";
import { addCustom, CUSTOM_TYPES, customThemes, getCustom, MAX_CUSTOM_THEMES, removeCustom } from "@/lib/custom";
import { DEFAULTS, forgetUsed, getSettings, saveSettings, usedCount, type Settings } from "@/lib/settings";
import { Snd } from "@/lib/sound";

/* SETTINGS — Classic's house rules (index.html, SCREENS.settings): the
   questions, the default timers, sound, gameplay. Saved on this device: open
   Settings on the screen that will be the TV. */
/* every clock in the game, on its own tab: the standard rounds, then the mini-games */
type Timer = [keyof Settings, string, number[], string?];
const STANDARD_TIMERS: Timer[] = [
  ["tQuestion", "Main question", [15, 30, 45, 60, 75, 90, 120]],
  ["tSteal", "Steal", [10, 15, 20, 30, 45, 60]],
  ["tFriend", "Call a Friend", [20, 30, 45, 60, 90]],
  ["tContest", "Answering a contest", [10, 15, 20, 30], "No host: how long a captain has to answer the other captain's contest before the app's call stands."],
  ["tSudden", "Sudden death: time to buzz", [15, 20, 30, 45, 60], "No host: also the Battle's tie-breaker question."],
];
const MINI_TIMERS: Timer[] = [
  ["tMini", "Closest To Wins", [30, 45, 60, 75, 90, 120]],
  ["tAuction", "The Auction: naming time", [20, 30, 45, 60, 90]],
  ["tSay", "Don't Say the Same as Me", [10, 15, 20, 30, 45]],
  ["tMap", "Guess the Map", [30, 45, 60, 90, 120]],
  ["tFlag", "Guess the Flag", [10, 15, 20, 30]],
  ["tPin", "Drop the Pin", [30, 45, 60, 90]],
  ["tAirport", "Guess the Airport", [20, 30, 45, 60]],
  ["tMajority", "Majority Rules: per question", [10, 15, 20, 30]],
  ["tDishStep", "Guess the Cocktail or Dish: a new ingredient every", [2, 3, 4, 5]],
  ["tDishType", "Guess the Cocktail or Dish: time to type after a buzz", [5, 10, 15, 20]],
  ["tBattleHost", "Battle, with a host: per question (out loud)", [5, 7, 10, 15]],
  ["tBattleTyped", "Battle, no host: per question (typed)", [10, 15, 20, 30]],
];
const TIMER_KEYS = [...STANDARD_TIMERS, ...MINI_TIMERS].map(([k]) => k);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card flex flex-col gap-4"><h2 className="eyebrow" style={{ color: "var(--color-gold)" }}>{title}</h2>{children}</section>;
}
function Toggle({ on, set, title, help }: { on: boolean; set: (v: boolean) => void; title: string; help?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex items-center justify-between gap-4 text-left min-h-[48px]">
      <span><span className="block font-bold text-16">{title}</span>{help && <span className="block text-13 text-[var(--color-ink-2)] mt-0.5">{help}</span>}</span>
      <span className="relative shrink-0 block w-[60px] h-[34px] rounded-full transition-colors" style={{ background: on ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
        <span className="absolute top-[3px] w-[28px] h-[28px] rounded-full bg-white transition-all" style={{ left: on ? 29 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
      </span>
    </button>);
}

function Timers({ list, s, set }: { list: Timer[]; s: Settings; set: (p: Partial<Settings>) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4">
      {list.map(([k, label, opts, help]) => {
        const v = Number(s[k]), all = opts.includes(v) ? opts : [...opts, v].sort((x, y) => x - y);
        return (
          <div key={k} className="flex flex-col gap-2 min-w-0">
            <label className="field-label !mb-0 leading-snug" htmlFor={"t-" + k}>{label}</label>
            <select id={"t-" + k} className="input !text-16 cursor-pointer" value={v} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<Settings>)}>
              {all.map((n) => <option key={n} value={n}>{n} sec{n === DEFAULTS[k] ? " (default)" : ""}</option>)}
            </select>
            {help && <span className="text-12 text-[var(--color-ink-3)] leading-snug">{help}</span>}
          </div>); })}
    </div>);
}

/* a labelled field (kept outside the form, so typing never loses focus) */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2 min-w-0"><label className="field-label !mb-0" htmlFor={id}>{label}</label>{children}</div>;
}
/* Classic's "Add a question" form: every field exists once, the type decides what shows */
const BLANK = { type: "standard", question: "", answer: "", notes: "", theme: "", newTheme: "", difficulty: "medium", pool: "", use_with: "" };
function AddQuestion() {
  const [base, setBase] = useState<Bank | null>(null);
  const [mine, setMine] = useState<Q[]>([]);
  const [f, setF] = useState(BLANK);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showList, setShowList] = useState(false);
  useEffect(() => {
    void loadBaseBank().then(setBase);
    const pull = () => setMine(getCustom()); pull();
    window.addEventListener("qmb:custom", pull);
    return () => window.removeEventListener("qmb:custom", pull);
  }, []);
  if (!base) return <p className="text-14 text-[var(--color-ink-2)]">Loading…</p>;
  const builtIn = base.themes, custom = customThemes(builtIn, mine), slots = MAX_CUSTOM_THEMES - custom.length;
  const themes = [...builtIn, ...custom];
  const set = (p: Partial<typeof BLANK>) => { setF({ ...f, ...p }); setMsg(null); };
  const themed = f.type === "standard" || f.type === "closest";
  const save = () => {
    const theme = f.theme === "__new__" ? (themes.find((t) => t.toLowerCase() === f.newTheme.trim().toLowerCase()) || f.newTheme.trim()) : (f.theme || themes[0]);
    if (themed && f.theme === "__new__" && !f.newTheme.trim()) { setMsg({ ok: false, text: "Name the custom theme, or pick an existing one." }); return; }
    const err = addCustom({ type: f.type, question: f.question, answer: f.answer, notes: f.notes, theme, difficulty: f.difficulty, use_with: f.use_with,
      pool: f.pool.split("\n") }, builtIn, new Set(base.bank.map((q) => q.id)));
    if (err) { setMsg({ ok: false, text: err }); return; }
    setF({ ...BLANK, type: f.type, theme: f.theme === "__new__" ? theme : f.theme, difficulty: f.difficulty });
    setMsg({ ok: true, text: `Added${themed && !builtIn.includes(theme) ? " under " + theme : ""}.` });
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-14 text-[var(--color-ink-2)]">Kept in this browser on this device, through every app update. They join the game when this device starts it (or is the TV), and the host can hand-pick them under Advanced. Clearing this browser&rsquo;s data, or a private window, loses them.</p>
      <Field id="ny" label="Type">
        <select id="ny" className="input !text-16 cursor-pointer" value={f.type} onChange={(e) => set({ type: e.target.value })}>
          {CUSTOM_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field id="nq" label={f.type === "auction" ? "Category" : f.type === "saysame" ? "Prompt" : "Question"}>
        <textarea id="nq" rows={2} className="input !py-3 !text-16 !font-semibold" value={f.question}
          placeholder={f.type === "auction" ? "How many countries can you name?" : f.type === "saysame" ? "Name a cheese" : "Type the question"} onChange={(e) => set({ question: e.target.value })} />
      </Field>
      {f.type === "standard" && <Field id="na" label="Answer"><input id="na" className="input !text-16" value={f.answer} placeholder="The answer" onChange={(e) => set({ answer: e.target.value })} /></Field>}
      {f.type === "closest" && <Field id="naNum" label="Answer, a number"><input id="naNum" className="input !text-16" inputMode="decimal" value={f.answer} placeholder="e.g. 236" onChange={(e) => set({ answer: e.target.value })} /></Field>}
      {f.type === "saysame" && <Field id="npool" label="Possible answers, one per line (at least two)">
        <textarea id="npool" rows={5} className="input !py-3 !text-16 !font-semibold" value={f.pool} placeholder={"Feta\nCheddar\nBrie\nMozzarella"} onChange={(e) => set({ pool: e.target.value })} /></Field>}
      {f.type !== "saysame" && <Field id="nn" label={f.type === "auction" ? "Ruling note: what counts" : "Notes (shown with the answer)"}>
        <input id="nn" className="input !text-16" value={f.notes} placeholder={f.type === "auction" ? "e.g. Marques only. Toyota counts, Corolla does not." : "Optional"} onChange={(e) => set({ notes: e.target.value })} /></Field>}
      {themed && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="nt" label="Theme">
            <select id="nt" className="input !text-16 cursor-pointer" value={f.theme || themes[0]} onChange={(e) => set({ theme: e.target.value })}>
              {themes.map((t) => <option key={t} value={t}>{t}</option>)}
              {slots > 0 && <option value="__new__">+ New custom theme…</option>}
            </select>
          </Field>
          <Field id="nd" label="Difficulty">
            <select id="nd" className="input !text-16 cursor-pointer" value={f.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
              {["easy", "medium", "hard", "expert"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
          </Field>
        </div>)}
      {themed && f.theme === "__new__" && (
        <Field id="ntNew" label="Custom theme name">
          <input id="ntNew" className="input !text-16" maxLength={24} value={f.newTheme} placeholder={`Custom Theme ${custom.length + 1}`} onChange={(e) => set({ newTheme: e.target.value })} />
          <span className="text-13 text-[var(--color-ink-3)]">{slots} of {MAX_CUSTOM_THEMES} custom theme slots left. A custom theme lives as long as it has questions.</span>
        </Field>)}
      {f.type === "standard" && f.theme !== "__new__" && (
        <Field id="nu" label="Pair ticker (optional)">
          <input id="nu" className="input !text-16" value={f.use_with} placeholder="e.g. capital-of" onChange={(e) => set({ use_with: e.target.value })} />
          <span className="text-13 text-[var(--color-ink-3)]">Two questions in a theme with the same ticker are asked together, one to each team.</span>
        </Field>)}
      {f.type === "auction" && <p className="text-13 text-[var(--color-ink-3)]">A category has no theme, no difficulty and no answer: the bidding sets the difficulty, and the answers are counted out loud.</p>}
      {f.type === "saysame" && <p className="text-13 text-[var(--color-ink-3)]">No theme, no difficulty: how wide the answers are is the difficulty. One line is drawn at random each time it plays.</p>}
      {msg && <p className="text-14 font-bold" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--color-ok)" : "var(--color-no)" }}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <button type="button" className="btn btn-gold" onClick={save}>Add it</button>
        {mine.length > 0 && <button type="button" className="btn btn-sm btn-ghost" aria-expanded={showList} onClick={() => setShowList(!showList)}>{showList ? "Hide" : "Show"} mine ({mine.length})</button>}
      </div>
      {showList && mine.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mine.map((q) => (
            <li key={q.id} className="flex items-start gap-3 rounded-[14px] px-3 py-2.5" style={{ background: "rgba(255,255,255,.04)" }}>
              <span className="flex-1 min-w-0"><span className="block text-15 font-semibold leading-snug">{q.question}</span>
                <span className="block text-13 text-[var(--color-ink-2)] mt-0.5">{CUSTOM_TYPES.find(([k]) => k === q.type)?.[1]}{q.theme ? ` · ${q.theme}` : ""}{q.difficulty ? ` · ${q.difficulty}` : ""}</span></span>
              <button type="button" className="btn btn-sm btn-ghost shrink-0" onClick={() => removeCustom(q.id)}>Delete</button>
            </li>))}
        </ul>)}
    </div>);
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [played, setPlayed] = useState(0);
  /* two tabs, so the timers don't crowd the rest; #timers opens that one */
  const [tab, setTab] = useState<"general" | "timers">("general");
  useEffect(() => { setS(getSettings()); setPlayed(usedCount()); if (location.hash === "#timers") setTab("timers"); }, []);
  const set = (p: Partial<Settings>) => setS(saveSettings(p));
  const pick = (t: "general" | "timers") => { setTab(t); try { history.replaceState(null, "", t === "timers" ? "#timers" : location.pathname); } catch { /* fine */ } };
  const changed = TIMER_KEYS.some((k) => s[k] !== DEFAULTS[k]);

  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Settings</div><h1 className="display text-40">House rules</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/">Back</Link>
      </header>
      <p className="text-13 text-[var(--color-ink-2)] -mt-2">Saved on this device. Change them on the screen that will be the TV.</p>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Settings">
        {([["general", "General"], ["timers", "Timers"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={"btn " + (tab === k ? "btn-gold" : "btn-ghost")} onClick={() => pick(k)}>{label}</button>))}
      </div>

      {tab === "timers" ? (<>
        <Section title="Standard trivia">
          <Timers list={STANDARD_TIMERS} s={s} set={set} />
        </Section>
        <Section title="Mini-games">
          <Timers list={MINI_TIMERS} s={s} set={set} />
        </Section>
        <button type="button" className="btn btn-sm btn-ghost self-center" disabled={!changed}
          onClick={() => set(Object.fromEntries(TIMER_KEYS.map((k) => [k, DEFAULTS[k]])) as Partial<Settings>)}>Back to the default timers</button>
      </>) : (<>
      <Section title="Add a question">
        <AddQuestion />
      </Section>
      <Section title="Sound">
        <Toggle on={s.sound} set={(v) => set({ sound: v })} title="Jingles and chimes" help="A calm 5-second sting at the top of every round, soft bells when a timer runs out. Played on the TV only." />
        <Toggle on={s.tick} set={(v) => set({ tick: v })} title="Quiet tick in the last 10 seconds" help="Barely there. Turn it off if the room is small." />
        <div className="flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="vol">Volume: {Math.round(s.volume * 100)}%</label>
          <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full h-11 accent-[var(--color-gold)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => Snd.jingle()}>Test jingle</button>
          <button type="button" className="btn btn-sm" onClick={() => Snd.alarm()}>Test end-of-timer chime</button>
        </div>
      </Section>

      <Section title="Your MC: Imad">
        <Toggle on={s.imad} set={(v) => set({ imad: v })} title="Imad comments" help="He comments on the game in a speech bubble on the TV: round intros, right and wrong answers, steals, lead changes, the final. Text only, no voice." />
      </Section>

      <Section title="Gameplay">
        <Toggle on={s.noRepeat} set={(v) => set({ noRepeat: v })} title="Never reuse a question I've already played" help="Every question this TV plays is remembered. The same group can play week after week with no repeats." />
        <Toggle on={s.alternateFirst} set={(v) => set({ alternateFirst: v })} title="Alternate which team answers first each round" help="Off = Team A always goes first." />
        <Toggle on={s.flagAway} set={(v) => set({ flagAway: v })} title="Flag phones that leave the game during a question" help="Someone switches app or tab while a question is up (a search, a chatbot)? The TV says so, and the host's phone keeps the list. Call a Friend is allowed." />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-14 text-[var(--color-ink-2)]">{played} question{played === 1 ? "" : "s"} marked as played.</span>
          <button type="button" className="btn btn-sm" disabled={!played}
            onClick={() => { if (window.confirm("Forget every played question on this device?")) { forgetUsed(); setPlayed(0); } }}>Forget played questions</button>
        </div>
      </Section>
      </>)}
    </main>
  );
}
