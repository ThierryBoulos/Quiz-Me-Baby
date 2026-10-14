"use client";
import { DISH_STEP, T_AUCTION, T_BATTLE_HOST, T_BATTLE_TYPED, T_CLOSEST, T_DISH_TYPE, T_FLAG, T_MAP, T_OVERRULE, T_SAY, T_SUDDEN_BUZZ } from "./game";
/* House rules for Party, kept on the device that runs the TV — Classic's
   Settings (index.html, DEFAULT_SETTINGS), minus what doesn't apply. */
export type Settings = {
  /* the timers, in seconds. Standard trivia: */
  tQuestion: number; tSteal: number; tFriend: number;
  tContest: number;           // no host: how long the other captain has to change the app's call
  tSudden: number;            // no host: sudden death and the Battle's tie-breaker, time to buzz
  /* the mini-games: */
  tMini: number; tFlag: number; tMap: number; tSay: number; tAuction: number;
  tDishStep: number;          // Cocktail or Dish: a new ingredient every…
  tDishType: number;          // …and after a buzz, this long to type it
  tBattleHost: number; tBattleTyped: number;   // the Battle, per question: out loud with a host, typed with none
  sound: boolean; tick: boolean; volume: number;                       // 0..1
  noRepeat: boolean;          // never reuse a question this TV has already played
  alternateFirst: boolean;    // alternate which team answers first each round
  imad: boolean;              // Imad comments on the game in a bubble on the TV (text only)
  flagAway: boolean;          // flag a phone that leaves the game screen during a question
};
export const DEFAULTS: Settings = { tQuestion: 60, tSteal: 30, tFriend: 30, tContest: T_OVERRULE, tSudden: T_SUDDEN_BUZZ,
  tMini: T_CLOSEST, tFlag: T_FLAG, tMap: T_MAP, tSay: T_SAY, tAuction: T_AUCTION, tDishStep: DISH_STEP, tDishType: T_DISH_TYPE,
  tBattleHost: T_BATTLE_HOST, tBattleTyped: T_BATTLE_TYPED, sound: true, tick: true, volume: 0.75, noRepeat: true, alternateFirst: false, imad: true, flagAway: true };
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
