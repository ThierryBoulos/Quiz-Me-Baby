/* A theme picked more than once (Setup's "Repeat a theme", the owner, 15 Nov): the rounds' themes are a list, one per
   round, and a theme can be in it more than once. These read it. */
export const timesOf = (list: string[], t: string) => list.filter((x) => x === t).length;
export const uniqueThemes = (list: string[]) => [...new Set(list)];
/* "Geography ×2, History, Music" */
export const themeLabel = (t: string, n: number) => (n > 1 ? `${t} ×${n}` : t);
export const themeList = (list: string[]) => uniqueThemes(list).map((t) => themeLabel(t, timesOf(list, t))).join(", ");
/* how many rounds a theme can fill at tonight's level: two questions a round */
export const roundsIn = (questions: number) => Math.floor(questions / 2);

/* the Setup's themes, every setup (27 Nov, the merge): one per round, trimmed when the rounds go down, topped up at
   random when they go up, from those the bank can field tonight (avail), never one that's off until picked (off) */
export const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export function topUpThemes(cur: string[] | null, avail: string[], rounds: number, off: readonly string[]): string[] {
  let t = (cur ?? shuffle(avail.filter((x) => !off.includes(x)))).filter((x) => avail.includes(x));
  if (t.length > rounds) t = t.slice(0, rounds);
  const spare = shuffle(avail.filter((x) => !t.includes(x) && !off.includes(x)));
  while (t.length < rounds && spare.length) t = [...t, spare.shift()!];
  return t;
}
