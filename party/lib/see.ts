/* What Do You See? (12 Nov): the parts the TV, the phones and both setups share. A picture starts blurred (a face, a
   logo) or zoomed right in (a close-up) and clears in steps as the clock runs: every screen works out the step from
   the TV's clock (the question's deadline), so the TV and the phones show the same thing at the same moment. Fully
   clear for the last 3 seconds. With animations off, 5 plain steps instead of about 12 eased ones. */
import type { Two } from "./game";

export type SeeKind = "face" | "logo" | "close";
export const SEE_CLEAR = 3;
/* a buzz (12 Nov, the owner): the picture stops, and the team has this long to say it out loud and type it */
export const SEE_TYPE = 10;          // seconds fully clear at the end
export const SEE_STEPS = 12, SEE_STEPS_STILL = 5;
/* the blur at the start, as a share of the picture's width (so a phone and the TV show the same). A logo is a simple
   shape that reads through a face's blur (checked by eye, 12 Nov): it starts at nearly twice as much */
export const SEE_BLUR: Record<SeeKind, number> = { face: 0.045, logo: 0.085, close: 0 };

/* what every screen gets: the picture (its file's hashed name), how it clears, and at the reveal what it was */
export type SePub = {
  photo: string; kind: SeeKind; effect: "blur" | "zoom"; zoom: [number, number, number] | null;
  total: number;                    // the clock's seconds
  n: number; of: number;            // picture n of 7 (a tie-breaker goes past it)
  out?: boolean[];                  // a team that guessed wrong (or ran out of its 10 seconds): out of this picture
  buzz?: number | null;             // the team that buzzed, while it answers (the picture and its clock stopped)
  typeBy?: number | null;           // ...and when its 10 seconds run out (the TV's clock)
  rev?: { answer: string; notes?: string; credit: string; licence: string; who: number | null; ms: number | null; at: (number | null)[] };
};
/* the bank row's picture fields */
export const sePic = (q: { photo: string; kind: SeeKind; effect: "blur" | "zoom"; zoom?: number[] | null }) =>
  ({ photo: q.photo, kind: q.kind, effect: q.effect, zoom: q.zoom && q.zoom.length === 3 ? [q.zoom[0], q.zoom[1], q.zoom[2]] as [number, number, number] : null });

/* how far it has cleared, 0 (the start) to 1 (clear), in steps: from the seconds gone on the clock */
export function seeStep(gone: number, total: number, still: boolean): number {
  const steps = still ? SEE_STEPS_STILL : SEE_STEPS, run = Math.max(1, total - SEE_CLEAR);
  const p = Math.min(1, Math.max(0, gone / run));
  return Math.min(steps, Math.floor(p * steps + 1e-6)) / steps;
}
/* the seconds gone, from the clock: a deadline (running) or what was left (paused); null deadline and nothing left
   is the end (time up) */
export const seeGone = (total: number, deadline: number | null | undefined, left: number | null | undefined, now: number) =>
  deadline ? total - Math.max(0, (deadline - now) / 1000) : left ? total - left : total;

/* a blurred picture at step q: the blur (a share of the width) and how much it's grown so its soft edges stay out of
   the frame. The blur falls away faster at first, then slowly to sharp */
export const seeBlur = (q: number, kind: SeeKind) => { const b = (SEE_BLUR[kind] || SEE_BLUR.face) * Math.pow(1 - q, 1.6); return { b, grow: 1 + b * 4 }; };
/* a close-up at step q: the zoom (z0 at the start, 1 at the end, geometrically so each step looks the same size)
   and the top-left corner of the part shown (shares of the picture), moving from the focus point to the middle */
export function seeZoom(q: number, zoom: [number, number, number] | null) {
  const [fx, fy, z0] = zoom || [0.5, 0.5, 5];
  const z = Math.pow(z0, 1 - q), half = 0.5 / z;
  const cx = fx + (0.5 - fx) * q, cy = fy + (0.5 - fy) * q;
  const x = Math.min(Math.max(cx - half, 0), 1 - 2 * half), y = Math.min(Math.max(cy - half, 0), 1 - 2 * half);
  return { z, x, y };
}
/* "6.4 s" */
export const seeSecs = (ms: number | null | undefined) => (ms == null ? "" : `${(Math.round(ms / 100) / 10).toFixed(1)} s`);
/* two teams: the fastest right answer takes the picture (the calls as they stand: a host's change, a contest agreed) */
export function seeWinner(ok: Two<boolean | null>, at: Two<number | null>): 0 | 1 | "none" {
  const right = ([0, 1] as const).filter((t) => ok[t] && at[t] != null);
  if (!right.length) return "none";
  return right.length === 1 ? right[0] : (at[0]! <= at[1]! ? 0 : 1);
}
