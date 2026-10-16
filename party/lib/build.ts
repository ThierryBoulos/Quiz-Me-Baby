/* Party's version line. The date is the day this version went live (taken from the
   deploy itself, so it can't go stale); bump v by hand for a release worth naming. */
const built = new Date(process.env.NEXT_PUBLIC_BUILD_DATE || Date.now());
const date = built.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const BUILD = { v: "4.2", date, author: "Thierry Boulos", year: built.getUTCFullYear() };
