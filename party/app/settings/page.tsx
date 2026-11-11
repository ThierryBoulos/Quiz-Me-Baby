"use client";
import { useEffect, useState } from "react";
import { DEFAULTS, forgetUsed, getSettings, saveSettings, usedCount, type Settings } from "@/lib/settings";
import { HouseRules } from "@/components/HouseRules";
import { AddQuestion } from "@/components/AddQuestion";
import { MqPage, MqTop } from "@/components/Marquee";

/* SETTINGS — Classic's house rules (index.html, SCREENS.settings): the
   questions, the default timers, sound, gameplay. Saved on this device: open
   Settings on the screen that will be the TV. */

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
    <MqPage wide>
      <MqTop href="/" eyebrow="Settings" title="House rules" />
      <p className="text-13 text-[var(--color-ink-2)] -mt-2">Saved on this device. Change them on the screen that will be the TV, or as the host from your phone (Setup, Advanced, Settings).</p>

      <HouseRules s={s} set={set} tab={tab} pick={pick} played={played} onForget={() => { forgetUsed(); setPlayed(0); }} addQuestion={<AddQuestion />} />
    </MqPage>
  );
}
