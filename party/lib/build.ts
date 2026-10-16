/* Party's version line, all taken from the deploy itself so it can't go stale: the day this
   version went live and the short code of its commit (the same code GitHub and Vercel show). */
const built = new Date(process.env.NEXT_PUBLIC_BUILD_DATE || Date.now());
const date = built.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const sha = process.env.NEXT_PUBLIC_BUILD || "dev";
export const BUILD = { code: sha === "dev" ? "dev" : sha.slice(0, 7), date, author: "Thierry Boulos", year: built.getUTCFullYear() };
