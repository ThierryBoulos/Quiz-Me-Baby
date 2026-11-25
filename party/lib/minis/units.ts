/* What one go of each game is called, one list for every setup (25 Nov, the merge): "Flag 3 of 10", "10 flags", "the
   last landmark". No "leg" (the reviewers, 31 Oct). The 2-team and 3-to-8 keys both: saysame/say, quiz, sudden */
const ONE: Record<string, string> = {
  quiz: "question", sudden: "question", comeback: "question", closest: "question", saysame: "question", say: "question", majority: "question",
  flag: "flag", dish: "recipe", map: "map", pin: "landmark", airport: "board", roulette: "spin", stakes: "round", see: "picture", fool: "fact",
};
/* "flag", "recipe"… (none known: "question") */
export const unitWord = (key: string) => ONE[key] || "question";
/* "Flag", "Recipe"… */
export const unitTitle = (key: string) => { const u = unitWord(key); return u[0].toUpperCase() + u.slice(1); };
/* "10 flags", "3 spins" */
export const unitCount = (key: string, n: number) => `${n} ${unitWord(key)}s`;
/* known to the list (else the caller's own word: the Auction's categories, the Battle's legs) */
export const hasUnit = (key: string) => key in ONE;
