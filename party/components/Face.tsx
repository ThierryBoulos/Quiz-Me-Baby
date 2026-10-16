"use client";
import { FACES } from "@/lib/faces";

/* SNAKED's face grid: taken faces greyed out and untappable; 4 a row on the narrowest phones, so every face stays a 44 px tap */
export function FacePicker({ value, taken, onPick }: { value: string; taken: string[]; onPick: (f: string) => void }) {
  return (
    <div className="grid grid-cols-4 min-[340px]:grid-cols-6 gap-1.5">
      {FACES.map((f) => {
        const off = taken.includes(f) && f !== value;
        return (
          <button key={f} type="button" disabled={off} onClick={() => onPick(f)} aria-pressed={f === value}
            className="aspect-square rounded-[14px] text-[24px] grid place-items-center transition"
            style={{ background: f === value ? "rgba(245,197,24,.18)" : "rgba(255,255,255,.05)",
                     border: "2px solid " + (f === value ? "var(--color-gold)" : "transparent"), opacity: off ? 0.25 : 1 }}>
            {f}
          </button>
        );
      })}
    </div>
  );
}
