/* A "move on" tap (Next, Start, Spin, Done) that comes in a step behind: taken if it was tapped on the very screen
   still up (26 Nov: in the 15 Nov game Spin took three taps; the step had moved under the host's phone, an answer
   taken at time's up or a call, and the tap was dropped without a word). One rule for every setup (lib/tvGame.ts,
   lib/many/useTvMany.ts). Still ignored: a tap from an earlier screen, and a second tap once the first one has moved
   the game on (the screen changed, so its step is from before the screen came up). */
export type ScreenAt = { screen: string; step: number; mi?: number };
/* `up`: the screen up now and the step it came up at (kept by the TV each time it sends a screen) */
export function tapOnThisScreen(p: { on?: unknown; step?: unknown }, moveOn: boolean, now: { screen: string; step: number; mi?: number }, up: ScreenAt): boolean {
  const step = Number(p.step);
  return moveOn && p.on === now.screen && now.screen === up.screen && (up.mi ?? -1) === (now.mi ?? -1)
    && Number.isFinite(step) && step >= up.step && step < now.step;
}
/* the TV keeps where the screen came up: a new screen (or, 3 to 8 teams, a new game on the same kind of screen) */
export const nextScreenAt = (up: ScreenAt, now: { screen: string; step: number; mi?: number }): ScreenAt =>
  now.screen !== up.screen || (now.mi ?? -1) !== (up.mi ?? -1) ? { screen: now.screen, step: now.step, mi: now.mi } : up;
