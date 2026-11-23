"use client";
/* A timer's seconds in How to Play, as Settings has them on this device (23 Nov, the owner: the rules match the
   settings, every game). The default until the page has read them, so it never flickers to nothing. */
import { useEffect, useState } from "react";
import { DEFAULTS, getSettings, type Settings } from "@/lib/settings";

type TimerKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

export function Secs({ k }: { k: TimerKey }) {
  const [v, setV] = useState<number>(DEFAULTS[k] as number);
  useEffect(() => { const read = () => setV(getSettings()[k] as number); read(); window.addEventListener("qmb:settings", read); return () => window.removeEventListener("qmb:settings", read); }, [k]);
  return <>{v}</>;
}
