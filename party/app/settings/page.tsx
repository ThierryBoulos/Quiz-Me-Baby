"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { loadBank } from "@/lib/engine";
import { DEFAULTS, forgetUsed, getSettings, saveSettings, usedCount, type Settings } from "@/lib/settings";
import { Snd } from "@/lib/sound";

/* SETTINGS — Classic's house rules (index.html, SCREENS.settings): the
   questions, the default timers, sound, gameplay. Saved on this device: open
   Settings on the screen that will be the TV. */
const TIMERS: [keyof Settings, string, number[]][] = [
  ["tQuestion", "Main question", [15, 30, 45, 60, 75, 90]],
  ["tSteal", "Steal window", [15, 20, 30, 45]],
  ["tMini", "Closest To Wins", [60, 75, 90, 120]],
  ["tFriend", "Call a Friend", [30, 45, 60]],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card flex flex-col gap-4"><h2 className="eyebrow" style={{ color: "var(--color-gold)" }}>{title}</h2>{children}</section>;
}
function Toggle({ on, set, title, help }: { on: boolean; set: (v: boolean) => void; title: string; help?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex items-center justify-between gap-4 text-left min-h-[48px]">
      <span><span className="block font-bold text-[16px]">{title}</span>{help && <span className="block text-[13px] text-[var(--color-ink-2)] mt-0.5">{help}</span>}</span>
      <span className="relative shrink-0 block w-[60px] h-[34px] rounded-full transition-colors" style={{ background: on ? "var(--color-gold)" : "rgba(255,255,255,.14)" }}>
        <span className="absolute top-[3px] w-[28px] h-[28px] rounded-full bg-white transition-all" style={{ left: on ? 29 : 3, boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
      </span>
    </button>);
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [bankLine, setBankLine] = useState("Loading the questions…");
  const [played, setPlayed] = useState(0);
  useEffect(() => {
    setS(getSettings()); setPlayed(usedCount());
    void loadBank().then((b) => {
      const by: Record<string, number> = {}; b.bank.forEach((q) => { by[q.type] = (by[q.type] || 0) + 1; });
      setBankLine(`${b.bank.length} questions loaded: ${by.standard || 0} standard across ${b.themes.length} themes, ${by.closest || 0} Closest To Wins, ${by.auction || 0} Auction, ${by.saysame || 0} Say-Same, ${by.map || 0} maps, ${by.flag || 0} flags and ${by.dish || 0} cocktails and dishes.`);
    });
  }, []);
  const set = (p: Partial<Settings>) => setS(saveSettings(p));

  return (
    <main className="screen !max-w-[720px]">
      <header className="flex items-end justify-between gap-3">
        <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Settings</div><h1 className="display text-[40px]">House rules</h1></div>
        <Link className="btn btn-sm btn-ghost" href="/">Back</Link>
      </header>
      <p className="text-[13px] text-[var(--color-ink-2)] -mt-2">Saved on this device. Change them on the screen that will be the TV.</p>

      <Section title="Questions">
        <p className="text-[15px] text-[var(--color-ink-2)]">{bankLine}</p>
      </Section>

      <Section title="Default timers">
        <div className="grid grid-cols-2 gap-3">
          {TIMERS.map(([k, label, opts]) => (
            <div key={k} className="flex flex-col gap-2 min-w-0">
              <label className="field-label !mb-0" htmlFor={"t-" + k}>{label}</label>
              <select id={"t-" + k} className="input !text-[16px] cursor-pointer" value={Number(s[k])} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<Settings>)}>
                {opts.map((n) => <option key={n} value={n}>{n} seconds</option>)}
              </select>
            </div>))}
        </div>
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

      <Section title="Gameplay">
        <Toggle on={s.noRepeat} set={(v) => set({ noRepeat: v })} title="Never reuse a question I've already played" help="Every question this TV plays is remembered. The same group can play week after week with no repeats." />
        <Toggle on={s.alternateFirst} set={(v) => set({ alternateFirst: v })} title="Alternate which team answers first each round" help="Off = Team A always goes first." />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[14px] text-[var(--color-ink-2)]">{played} question{played === 1 ? "" : "s"} marked as played.</span>
          <button type="button" className="btn btn-sm" disabled={!played}
            onClick={() => { if (window.confirm("Forget every played question on this device?")) { forgetUsed(); setPlayed(0); } }}>Forget played questions</button>
        </div>
      </Section>
    </main>
  );
}
