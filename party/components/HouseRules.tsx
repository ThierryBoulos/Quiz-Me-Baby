"use client";
import type { ReactNode } from "react";
import { DEFAULTS, type Settings } from "@/lib/settings";
import { Snd } from "@/lib/sound";

/* THE HOUSE RULES — every setting, on two tabs (General, Timers). The Settings
   page shows them for this device; the host's "Settings" (Setup, Advanced)
   shows the very same controls for the TV, where each change is sent to the TV
   and saved there (remote: no test sounds, as they would play on the phone). */
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
  ["tDishType", "Time to type after a buzz (Cocktail or Dish, sudden death)", [5, 10, 15, 20]],
  ["tBattleHost", "Battle, with a host: per question (out loud)", [5, 7, 10, 15]],
  ["tBattleTyped", "Battle, no host: per question (typed)", [10, 15, 20, 30]],
];
const TIMER_KEYS = [...STANDARD_TIMERS, ...MINI_TIMERS].map(([k]) => k);

export function Section({ title, children }: { title: string; children: ReactNode }) {
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


export function HouseRules({ s, set, tab, pick, played, onForget, addQuestion, remote = false }: {
  s: Settings; set: (p: Partial<Settings>) => void; tab: "general" | "timers"; pick: (t: "general" | "timers") => void;
  played: number; onForget: () => void; addQuestion?: ReactNode; remote?: boolean }) {
  const changed = TIMER_KEYS.some((k) => s[k] !== DEFAULTS[k]);
  return (<>
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
      <Section title="Gameplay">
        <Toggle on={s.noRepeat} set={(v) => set({ noRepeat: v })} title="New questions first" help="Every question this TV plays is remembered, and the next games deal the ones you haven't played. When a game runs out of new ones, played ones come back (a night never gets shorter) and the lobby offers to reset." />
        <Toggle on={s.alternateFirst} set={(v) => set({ alternateFirst: v })} title="Alternate which team answers first each round" help="Off = Team A always goes first." />
        <Toggle on={s.manyTeams} set={(v) => set({ manyTeams: v })} title="Allow more than two teams" help="Adds Teams: 2 [−] [+] to the TV lobby, up to 8 teams. Needs a host; mini-games only (Majority Rules, Flags, Closest To Wins, Drop the Pin)." />
        <Toggle on={s.flagAway} set={(v) => set({ flagAway: v })} title="Flag phones that leave the game during a question" help="Someone switches app or tab while a question is up (a search, a chatbot)? The TV says so, and the host's phone keeps the list. Call a Friend is allowed." />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-14 text-[var(--color-ink-2)]">{played} question{played === 1 ? "" : "s"} marked as played{remote ? " on the TV" : ""}.</span>
          <button type="button" className="btn btn-sm" disabled={!played}
            onClick={() => { if (window.confirm(remote ? "Forget every played question on the TV?" : "Forget every played question on this device?")) onForget(); }}>Forget played questions</button>
        </div>
      </Section>
      {addQuestion && <Section title="Add a question">{addQuestion}</Section>}
      <Section title="Sound">
        <Toggle on={s.sound} set={(v) => set({ sound: v })} title="Jingles and chimes" help="A calm 5-second sting at the top of every round, soft bells when a timer runs out. Played on the TV only." />
        <Toggle on={s.tick} set={(v) => set({ tick: v })} title="Quiet tick in the last 10 seconds" help="Barely there. Turn it off if the room is small." />
        <div className="flex flex-col gap-2">
          <label className="field-label !mb-0" htmlFor="vol">Volume: {Math.round(s.volume * 100)}%</label>
          <input id="vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full h-11 accent-[var(--color-gold)]" />
        </div>
        {!remote && <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => Snd.jingle()}>Test jingle</button>
          <button type="button" className="btn btn-sm" onClick={() => Snd.alarm()}>Test end-of-timer chime</button>
        </div>}
      </Section>

      <Section title="Your MC: Imad">
        <Toggle on={s.imad} set={(v) => set({ imad: v })} title="Imad comments" help="He comments on the game in a speech bubble on the TV: round intros, right and wrong answers, steals, lead changes, the final. Text only, no voice." />
      </Section>

      </>)}
  </>);
}
