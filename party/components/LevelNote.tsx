"use client";
/* Setup's note when a picked theme can't fill its round at the level picked (11 Nov, the owner): short, with what
   to do. Either the bank hasn't got two questions there at all (only a theme of the host's own can be that small),
   or this TV has played them all: then Forget played questions, or Add questions (the host's picker). */
import { useState } from "react";
import { sendQuiet } from "@/lib/supabase";
import { LEVELS, type FreshLeft } from "@/lib/freshLeft";

type Q = { type?: string; theme?: string; difficulty?: string };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function LevelNote({ code, themes, levels, left, bank, onAdd }: {
  code: string; themes: string[]; levels: (t: string) => string[]; left?: FreshLeft; bank?: { bank: Q[] } | null; onAdd?: () => void }) {
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  if (!bank || !themes.length) return null;
  const short: string[] = [], played: string[] = [];
  for (const t of themes) {
    const lv = levels(t), label = `${t} (${lv.map(cap).join(", ")})`;
    const total = bank.bank.filter((q) => q.type === "standard" && q.theme === t && lv.includes(q.difficulty || "")).length;
    const fresh = left ? lv.reduce((n, l) => n + (left[t]?.[LEVELS.indexOf(l as (typeof LEVELS)[number])] ?? 0), 0) : total;
    if (total < 2) short.push(label); else if (fresh < 2) played.push(label);
  }
  if (!short.length && !played.length) return null;
  return (
    <div className="card flex flex-col gap-2" role="status" style={{ borderColor: "color-mix(in srgb, var(--color-gold) 55%, transparent)" }}>
      {short.length > 0 && <p className="text-14 m-0">Not enough questions at this level: <b>{short.join("; ")}</b>. Change the level or the theme.</p>}
      {played.length > 0 && (<>
        <p className="text-14 m-0">No new questions left at this level: <b>{played.join("; ")}</b>. Change the level or the theme, or:</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn btn-sm btn-gold" disabled={state === "sent"}
            onClick={() => { setState("sent"); sendQuiet(code, "setup", { forgetPlayed: true }).catch(() => setState("failed")); }}>
            {state === "sent" ? "Forgetting…" : "Forget played questions"}</button>
          {onAdd && <button type="button" className="btn btn-sm" onClick={onAdd}>Add questions</button>}
          {state === "failed" && <span className="text-13 text-[var(--color-no)]">That didn&rsquo;t go through. Try again.</span>}
        </div></>)}
    </div>);
}
