/* TEAM MASCOTS, the rules (28 Nov): who has which. No drawing here, so the TV's game logic (lib/tvGame,
   lib/many/useTvMany) and the simulated nights can use it; the creatures are drawn in components/Mascot. */
export const MASCOT_COUNT = 8;

/* the room's picks (room.state.teamMascots): what each team's captain picked, or null. A picked mascot is that team's
   alone: the other captains see it greyed out (28 Nov, the owner). A team that hasn't picked has its own number's
   creature, or the next one nobody has, so no two teams ever look alike */
const TEAMS_MAX = 8;
export const pickedOf = (picks: unknown, t: number) => {
  const v = Array.isArray(picks) && picks[t] != null ? Number(picks[t]) : NaN;
  return Number.isInteger(v) && v >= 0 && v < MASCOT_COUNT ? v : null;
};
export function allMascots(picks: unknown): number[] {
  const taken = new Set<number>(), out: number[] = [];
  for (let t = 0; t < TEAMS_MAX; t++) { const v = pickedOf(picks, t); if (v != null) taken.add(v); }
  for (let t = 0; t < TEAMS_MAX; t++) {
    const v = pickedOf(picks, t);
    if (v != null) { out[t] = v; continue; }
    let c = t % MASCOT_COUNT;
    for (let j = 0; j < MASCOT_COUNT; j++) { const x = (t + j) % MASCOT_COUNT; if (!taken.has(x)) { c = x; break; } }
    out[t] = c; taken.add(c);
  }
  return out;
}
export const mascotOf = (picks: unknown, t: number) => allMascots(picks)[t] ?? t % MASCOT_COUNT;
/* the mascots the other teams (of k) have picked: not to be picked again */
export const takenBy = (picks: unknown, t: number, k: number) => new Set(Array.from({ length: k }, (_, i) => (i === t ? null : pickedOf(picks, i))).filter((v): v is number => v != null));
