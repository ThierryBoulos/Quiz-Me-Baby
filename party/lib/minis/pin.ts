/* Drop the Pin: one copy for every setup (24 Nov, the merge). Its words. Apart on purpose: how a pin scores (2 teams:
   +1 to the closer, best of 7 takes the game; 3 to 8: places, the closest first), in each setup's own rule lines. */
import { T_PIN } from "../game";

export const PIN = {
  title: "Drop the Pin",
  unit: "landmark",
  setupLine: (secs?: number) => `Seven landmarks, ${secs ?? T_PIN} seconds each: drop a pin where it is.`,
  rule1: (secs?: number) => `A photo of a landmark goes up. Captains have ${secs ?? T_PIN} seconds to drop a pin on the map where they think it is.`,
  /* 2 teams' rules 2 and 3 */
  rules2: (n: number, pts: string) => ["Closest pin: +1. The same distance? A point each. No pin? No point.", `Best of ${n} takes ${pts}. Tied? One more, or a point each.`],
  topCaptain: "Where is it? Drop your pin, then lock it in.",
  topPlayer: "Drop the Pin: help your captain",
  change: "Change landmark",
};
