/* A theme picked more than once (Setup's "Repeat a theme", the owner, 15 Nov): the rounds' themes are a list, one per
   round, and a theme can be in it more than once. These read it. */
export const timesOf = (list: string[], t: string) => list.filter((x) => x === t).length;
export const uniqueThemes = (list: string[]) => [...new Set(list)];
/* "Geography ×2, History, Music" */
export const themeLabel = (t: string, n: number) => (n > 1 ? `${t} ×${n}` : t);
export const themeList = (list: string[]) => uniqueThemes(list).map((t) => themeLabel(t, timesOf(list, t))).join(", ");
/* how many rounds a theme can fill at tonight's level: two questions a round */
export const roundsIn = (questions: number) => Math.floor(questions / 2);
