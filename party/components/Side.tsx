"use client";
/* A phone held sideways (phase 4, the owner, 3 Nov): the room's left column, under the scores, takes what you look at
   (the question, the clock, the flag, the photo, your team's card), so the right column is all for answering.
   Upright there is no slot: <ToSide> renders its children right where they are, exactly as before. Sideways, the
   room page puts a slot in the left column and <ToSide> moves its children there, in the order given. */
import { createContext, useContext, useSyncExternalStore, type ReactNode, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";

/* the same test as the CSS: a phone on its side (tablets, laptops and TVs are taller) */
const SIDEWAYS = "(orientation: landscape) and (max-height: 500px)";
export function useSideways() {
  return useSyncExternalStore(
    (on) => { const m = window.matchMedia(SIDEWAYS); m.addEventListener("change", on); return () => m.removeEventListener("change", on); },
    () => window.matchMedia(SIDEWAYS).matches,
    () => false);
}

/* the left column's slot, or null (upright, or not in a room) */
export const SideSlot = createContext<HTMLElement | null>(null);

/* order: where it sits in the left column (the slot is a column; lower first). when: only move it when this holds */
export function ToSide({ children, order = 5, when = true, className = "", ...rest }:
  { children: ReactNode; order?: number; when?: boolean } & HTMLAttributes<HTMLDivElement>) {
  const slot = useContext(SideSlot);
  if (!slot || !when) return <>{children}</>;
  return createPortal(<div className={"side-part " + className} style={{ order }} {...rest}>{children}</div>, slot);
}
