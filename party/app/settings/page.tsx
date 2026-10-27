"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { loadBaseBank, type Bank, type Q } from "@/lib/engine";
import { addCustom, CUSTOM_TYPES, customThemes, getCustom, MAX_CUSTOM_THEMES, removeCustom } from "@/lib/custom";
import { DEFAULTS, forgetUsed, getSettings, saveSettings, usedCount, type Settings } from "@/lib/settings";
import { HouseRules } from "@/components/HouseRules";

/* SETTINGS — Classic's house rules (index.html, SCREENS.settings): the
   questions, the default timers, sound, gameplay. Saved on this device: open
   Settings on the screen that will be the TV. */
/* a labelled field (kept outside the form, so typing never loses focus) */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2 min-w-0"><label className="field-label !mb-0" htmlFor={id}>{label}</label>{children}</div>;
}
/* Classic's "Add a question" form: every field exists once, the type decides what shows */
const BLANK = { type: "standard", question: "", answer: "", notes: "", theme: "", newTheme: "", difficulty: "medium", pool: "", use_with: "", options: ["", "", "", ""], correct: 0, level: "medium" };
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
      pool: f.pool.split("\n"), options: f.options, correct: f.correct, level: f.level }, builtIn, new Set(base.bank.map((q) => q.id)));
    if (err) { setMsg({ ok: false, text: err }); return; }
    setF({ ...BLANK, type: f.type, theme: f.theme === "__new__" ? theme : f.theme, difficulty: f.difficulty, level: f.level });
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
      {f.type === "majority" && (
        <fieldset className="flex flex-col gap-2 min-w-0">
          <legend className="field-label !mb-2">The four answers: tap the circle by the right one</legend>
          {f.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" role="radio" aria-checked={f.correct === i} aria-label={`Answer ${i + 1} is the right one`} onClick={() => set({ correct: i })}
                className="shrink-0 w-[44px] h-[44px] grid place-items-center rounded-full">
                <span className="block w-[24px] h-[24px] rounded-full border-2" style={{ borderColor: f.correct === i ? "var(--color-ok)" : "rgba(255,255,255,.3)", background: f.correct === i ? "var(--color-ok)" : "transparent" }} />
              </button>
              <input id={"nmo" + i} className="input !text-16 flex-1 min-w-0" maxLength={60} value={o} placeholder={i === f.correct ? "The right answer" : `Wrong answer ${i < f.correct ? i + 1 : i}`}
                aria-label={`Answer ${i + 1}`} onChange={(e) => set({ options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} />
            </div>))}
          <span className="text-13 text-[var(--color-ink-3)]">Every phone shuffles them. The note below shows with the answer on the TV.</span>
        </fieldset>)}
      {f.type === "majority" && (
        <Field id="nml" label="Level">
          <select id="nml" className="input !text-16 cursor-pointer" value={f.level} onChange={(e) => set({ level: e.target.value })}>
            {["easy", "medium", "hard"].map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </Field>)}
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
                <span className="block text-13 text-[var(--color-ink-2)] mt-0.5">{CUSTOM_TYPES.find(([k]) => k === q.type)?.[1]}{q.theme ? ` · ${q.theme}` : ""}{q.difficulty ? ` · ${q.difficulty}` : ""}{q.level ? ` · ${q.level} · ${q.answer}` : ""}</span></span>
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
  /* changed elsewhere meanwhile (the host's phone, through the TV in another tab): show it */
  useEffect(() => {
    const pull = (e: StorageEvent) => { if (!e.key || e.key.startsWith("qmb.party.")) { setS(getSettings()); setPlayed(usedCount()); } };
    window.addEventListener("storage", pull); return () => window.removeEventListener("storage", pull);
  }, []);
  const set = (p: Partial<Settings>) => setS(saveSettings(p));
  const pick = (t: "general" | "timers") => { setTab(t); try { history.replaceState(null, "", t === "timers" ? "#timers" : location.pathname); } catch { /* fine */ } };

  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Settings</div><h1 className="display text-40">House rules</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/">Back</Link>
      </header>
      <p className="text-13 text-[var(--color-ink-2)] -mt-2">Saved on this device. Change them on the screen that will be the TV, or as the host from your phone (Setup, Advanced, Settings).</p>

      <HouseRules s={s} set={set} tab={tab} pick={pick} played={played} onForget={() => { forgetUsed(); setPlayed(0); }} addQuestion={<AddQuestion />} />
    </main>
  );
}
