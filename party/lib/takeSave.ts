/* A game taken over from another device's copy on the server: a phone taking over a game with no TV, or a new laptop
   taking over as the TV (the 4 Nov audit, 4.3: the laptop stored the copy whole, so it read every tap of the night
   again and played with its own settings). Unpacked the same way for both: the game under its own key (two teams or
   3-8 teams), the last tap read, the taps' tags (a late second copy isn't taken), the night's settings, and when the
   copy was made by this device's clock (the time since comes off the clocks). */
export function storeTakenSave(code: string, sv: Record<string, unknown>, savedAgoSec?: number | null) {
  const { inboxLast, inboxTags, many: isMany, settings, ...rest } = sv as { inboxLast?: number; inboxTags?: string[]; many?: boolean; settings?: unknown } & Record<string, unknown>;
  if (settings) localStorage.setItem("qmb.party.settings", JSON.stringify(settings));
  if (savedAgoSec != null) rest.savedAt = Date.now() - Math.round(Number(savedAgoSec) * 1000);
  localStorage.setItem("qmb.tv." + code + (isMany ? ".many" : ".game"), JSON.stringify(isMany ? { ...rest } : rest));
  if (inboxLast) localStorage.setItem("qmb.tv." + code + ".last", String(inboxLast));
  if (inboxTags?.length) localStorage.setItem("qmb.tv." + code + ".taps", JSON.stringify(inboxTags));
  try { window.dispatchEvent(new Event("qmb:settings")); } catch { /* not in a browser */ }
}
