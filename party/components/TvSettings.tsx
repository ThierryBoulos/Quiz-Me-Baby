"use client";
import { useEffect, useState } from "react";
import { HouseRules } from "./HouseRules";
import type { TvShare } from "@/lib/game";
import type { Settings } from "@/lib/settings";
import { sendQuiet } from "@/lib/supabase";

/* THE TV'S SETTINGS, FROM THE HOST'S PHONE (Setup, Advanced): every setting on the
   TV's Settings page, the same controls. A change shows here at once and goes to
   the TV, which saves it as its own (as if changed on the TV) and sends its
   settings back; until they come back, the change reads "Saving on the TV…". */
export function TvSettings({ code, tv, onClose }: { code: string; tv: TvShare; onClose: () => void }) {
  const [s, setS] = useState<Settings>(tv.settings);
  const [tab, setTab] = useState<"general" | "timers">("general");
  const [pending, setPending] = useState<Partial<Settings>>({});
  const [err, setErr] = useState<string | null>(null);
  /* the TV's word is the last word: what it sends back replaces what's shown, but for changes still on their way */
  useEffect(() => {
    setPending((p) => Object.fromEntries(Object.entries(p).filter(([k, v]) => tv.settings[k as keyof Settings] !== v)) as Partial<Settings>);
  }, [tv.settings]);
  useEffect(() => { setS({ ...tv.settings, ...pending }); }, [tv.settings, pending]);
  const set = (p: Partial<Settings>) => {
    setPending((x) => ({ ...x, ...p })); setErr(null);
    sendQuiet(code, "setup", { settings: p }).catch(() => setErr("That change didn't reach the TV. Try again."));
  };
  const forget = () => sendQuiet(code, "setup", { forgetPlayed: true }).catch(() => setErr("That didn't reach the TV. Try again."));
  const saving = Object.keys(pending).length > 0;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="The TV's settings">
      <div className="screen !gap-4">
        <header className="flex items-start justify-between gap-3 sticky top-0 z-10 -mx-5 px-5 pt-1 pb-3" style={{ background: "var(--color-bg)" }}>
          <div><div className="eyebrow" style={{ color: "var(--color-gold)" }}>Host only</div><h2 className="display text-30">Settings</h2>
            <div className="text-13 mt-1" style={{ color: err ? "var(--color-no)" : "var(--color-ink-2)" }} role="status">
              {err || (saving ? "Saving on the TV…" : "Saved on the TV, as if changed on its own Settings page.")}</div></div>
          <button type="button" className="btn btn-gold btn-sm shrink-0" onClick={onClose}>Done</button>
        </header>
        <HouseRules s={s} set={set} tab={tab} pick={setTab} played={tv.played} onForget={forget} remote />
      </div>
    </div>);
}
