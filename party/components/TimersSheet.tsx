"use client";
import { useEffect, useState } from "react";
import { useNoTv } from "./NoTv";
import { TimersOnly } from "./HouseRules";
import { DEFAULTS, type Settings } from "@/lib/settings";
import { sendQuiet } from "@/lib/supabase";

/* THE TIMERS, FROM THE STARTING CAPTAIN'S PHONE (no host, two teams: 11 Nov, the owner). No questions and no
   answers here, so no Advanced: only every clock in the game. A change shows at once and goes to the TV (with no TV,
   the phone running the game), which saves it as its own and shows its timers back in the room. */
export function TimersSheet({ code, timers, onClose }: { code: string; timers?: Partial<Settings>; onClose: () => void }) {
  const noTv = useNoTv(), the = noTv ? "the phone running the game" : "the TV";
  const base = { ...DEFAULTS, ...(timers || {}) } as Settings;
  const [pending, setPending] = useState<Partial<Settings>>({});
  const [err, setErr] = useState<string | null>(null);
  /* the TV's word is the last word: what comes back replaces what's shown, but for changes still on their way */
  useEffect(() => {
    setPending((p) => Object.fromEntries(Object.entries(p).filter(([k, v]) => timers?.[k as keyof Settings] !== v)) as Partial<Settings>);
  }, [timers]);
  const set = (p: Partial<Settings>) => {
    setPending((x) => ({ ...x, ...p })); setErr(null);
    sendQuiet(code, "setup", { timers: p }).catch(() => setErr(`That change didn't reach ${the}. Try again.`));
  };
  const saving = Object.keys(pending).length > 0;
  return (
    <div className="picker fixed inset-0 z-40 flex flex-col" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Timers">
      <header className="pk-gutter shrink-0 flex items-start justify-between gap-3 pb-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid var(--line)" }}>
        <div className="min-w-0"><div className="eyebrow" style={{ color: "var(--color-gold)" }}>No host</div><h2 className="display text-26">Timers</h2>
          <div className="text-13 mt-0.5" style={{ color: err ? "var(--color-no)" : "var(--color-ink-2)" }} role="status">
            {err || (saving ? `Saving on ${the}…` : timers ? `Saved on ${the}.` : `Waiting for ${the}…`)}</div></div>
        <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={onClose}>Done</button>
      </header>
      <div className="pk-body pk-gutter flex-1 min-h-0 flex flex-col gap-4 pt-3 pb-6">
        <TimersOnly s={{ ...base, ...pending }} set={set} />
      </div>
    </div>);
}
