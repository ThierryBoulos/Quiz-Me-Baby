"use client";
/* House rules for Party, kept on the device that runs the TV — Classic's
   Settings (index.html, DEFAULT_SETTINGS), minus what doesn't apply. */
export type Settings = {
  tQuestion: number; tSteal: number; tMini: number; tFriend: number;   // seconds
  sound: boolean; tick: boolean; volume: number;                       // 0..1
  noRepeat: boolean;          // never reuse a question this TV has already played
  alternateFirst: boolean;    // alternate which team answers first each round
  imad: boolean;              // Imad comments on the game in a bubble on the TV (text only)
  flagAway: boolean;          // flag a phone that leaves the game screen during a question
};
export const DEFAULTS: Settings = { tQuestion: 60, tSteal: 30, tMini: 90, tFriend: 30, sound: true, tick: true, volume: 0.75, noRepeat: true, alternateFirst: false, imad: true, flagAway: true };
const KEY = "qmb.party.settings";
export function getSettings(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s: Partial<Settings>) {
  const next = { ...getSettings(), ...s };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("qmb:settings"));
  return next;
}
/* the played-question memory (Party's own; Classic keeps its own) */
export const USED_KEY = "qmb.party.used";
export function usedCount() { try { return JSON.parse(localStorage.getItem(USED_KEY) || "[]").length; } catch { return 0; } }
export function forgetUsed() { try { localStorage.removeItem(USED_KEY); } catch { /* ignore */ } }
