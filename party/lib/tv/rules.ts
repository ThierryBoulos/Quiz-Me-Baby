/* The rules the TV checks every tap against: which moves a host or a captain may
   send, and on which screen; and the small pure helpers the TV's hook uses. */
import { getSettings } from "../settings";
import { DECIDED, DISH_LAST, TIE_SCREENS, type MiniKey } from "../game";

/* the house timers come from Settings on this TV */
export const T = () => getSettings();
export type Action = { id: number; room: string; user_id: string; kind: string; payload: Record<string, unknown>; at: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type G = any;
export type W = 0 | 1 | "tie" | "none";
export type PKind = "ask" | "steal" | "dish" | "sudden" | "battle" | "battleTie";
export type Where = string | string[];
/* the screens where the app's calls are shown, and can be contested */
export const CONTEST_SCREENS = ["answer", "flagReveal", "sayReveal", "mapReveal", "airportReveal", "dishReveal", "battleReview",
  /* sudden death and the tie-breaker: the question just decided, on the screen after it */
  "final", "battleSummary", "sudden", "battleTie"];
/* ...where the night goes on meanwhile: no buzz until the contest is decided (its clock waits too) */
export const SD_CONTEST = ["sudden", "battleTie"];
/* the taps that move the night on from those screens (held while a contest is open) */
export const NEXT_MOVES = new Set(["round/afterAnswer", "ui/next", "dish/next", "battle/reviewDone", "battle/done"]);
export const inScreen = (where: Where, sc: string) => where === "*" || (Array.isArray(where) ? where : [where]).includes(sc);

/* Moves the host's phone may send, and the screen each one belongs to.
   "ui/…" moves are the TV's own (clocks, reveals, overrules); the rest go
   straight to the shared engine. Anything else is refused. */
export const HOST_MOVES: Record<string, Where> = {
  "round/armDbl": "roundIntro", "round/begin": "roundIntro", "round/swap": "ask", "round/lifeline": "ask",
  "round/judge": "ask", "round/judgeSteal": "steal", "round/afterAnswer": "answer", "round/next": "roundScore",
  "sudden/go": "sudden", "sudden/show": "sudden", "sudden/swap": "sudden", "sudden/win": "sudden",
  "closest/start": "miniIntro", "closest/swap": "miniQ", "closest/award": "miniSummary", "closest/done": "miniSummary",
  "flag/start": "flagIntro", "flag/swap": "flagQ", "flag/award": "flagSummary", "flag/done": "flagSummary",
  "pin/start": "pinIntro", "pin/swap": "pinQ", "pin/award": "pinSummary", "pin/done": "pinSummary",
  "airport/start": "airportIntro", "airport/swap": "airportQ", "airport/award": "airportSummary", "airport/done": "airportSummary",
  "dish/start": "dishIntro", "dish/swap": "dishQ", "dish/right": "dishQ", "dish/wrong": "dishQ", "dish/next": "dishReveal",
  "dish/more": "dishTie", "dish/stop": "dishTie", "dish/award": "dishSummary", "dish/done": "dishSummary",
  "map/start": "mapIntro", "map/hint": "mapQ", "map/swap": "mapQ", "map/more": "mapTie", "map/stop": "mapTie", "map/award": "mapSummary", "map/done": "mapSummary",
  "auction/begin": "auctionIntro", "auction/skip": "auctionBid", "auction/tick": "auctionRun", "auction/untick": "auctionRun",
  "auction/resolve": "auctionRun", "auction/nextLeg": "auctionLeg", "auction/done": "auctionResult",
  "say/start": "sayIntro", "say/swap": "sayQ", "say/award": "saySummary", "say/done": "saySummary",
  "battle/start": ["battleIntro", "battleHandoff"], "battle/mark": "battleQ", "battle/swap": "battleQ", "battle/tbSwap": "battleTie", "battle/tbWin": "battleTie", "battle/done": "battleSummary",
  "ui/sayOk": "sayReveal",
  /* the host decides a captain's contest (v: change the call), and can change any call on these screens */
  "ui/contestOk": CONTEST_SCREENS, "ui/flip": CONTEST_SCREENS, "battle/reviewDone": "battleReview",
  "ui/closeLifeline": "*", "ui/setScore": "*", "ui/timeUp": ["ask", "steal"], "ui/pause": ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "battleQ"],
  "ui/reveal": ["miniQ", "flagQ", "mapQ", "sayQ", "pinQ", "airportQ"], "ui/flagOk": "flagReveal", "ui/mapOk": "mapReveal", "ui/airportOk": "airportReveal",
  "ui/next": ["closestReveal", "flagReveal", "mapReveal", "sayReveal", "pinReveal", "airportReveal"],
  "ui/sdRight": ["sudden", "battleTie"], "ui/sdWrong": ["sudden", "battleTie"],
  "ui/exit": "final", "ui/again": "final",
  /* level at the end of a mini-game: one more, or a point each */
  "tie/more": TIE_SCREENS, "tie/stop": TIE_SCREENS,
  /* won with legs to spare: keep playing for fun, or stop here */
  "decided/more": DECIDED, "decided/stop": DECIDED,
  /* Call a Friend's clock */
  "ui/pauseFriend": "ask", "ui/startCall": "ask",
};
/* What a CAPTAIN may tap, and who: "any" captain, the team whose "turn" it
   is, the "other" one (the referee), or the "lead": Team A's captain (Team
   B's if A has none), who starts and moves the night on, like a host would.
   The Auction's bidding is always the captains'; everything else here only
   exists when there's no host. */
export type Who = "any" | "turn" | "other" | "lead";
export const CAPTAIN_MOVES: Record<string, { where: Where; who: Who; nohostOnly?: boolean }> = {
  "auction/raise": { where: "auctionBid", who: "turn" },
  "auction/pass": { where: "auctionBid", who: "turn" },
  "round/begin": { where: "roundIntro", who: "lead", nohostOnly: true },
  "closest/start": { where: "miniIntro", who: "lead", nohostOnly: true },
  "flag/start": { where: "flagIntro", who: "lead", nohostOnly: true },
  "pin/start": { where: "pinIntro", who: "lead", nohostOnly: true },
  "airport/start": { where: "airportIntro", who: "lead", nohostOnly: true },
  "dish/start": { where: "dishIntro", who: "lead", nohostOnly: true },
  "map/start": { where: "mapIntro", who: "lead", nohostOnly: true },
  "auction/begin": { where: "auctionIntro", who: "lead", nohostOnly: true },
  "sudden/go": { where: "sudden", who: "lead", nohostOnly: true },
  "say/start": { where: "sayIntro", who: "lead", nohostOnly: true },
  "battle/start": { where: ["battleIntro", "battleHandoff"], who: "lead", nohostOnly: true },
  "say/done": { where: "saySummary", who: "lead", nohostOnly: true },
  "battle/done": { where: "battleSummary", who: "lead", nohostOnly: true },
  "round/afterAnswer": { where: "answer", who: "lead", nohostOnly: true },
  "round/next": { where: "roundScore", who: "lead", nohostOnly: true },
  "ui/next": { where: ["closestReveal", "flagReveal", "sayReveal", "mapReveal", "pinReveal", "airportReveal"], who: "lead", nohostOnly: true },
  "dish/next": { where: "dishReveal", who: "lead", nohostOnly: true },
  "auction/nextLeg": { where: "auctionLeg", who: "lead", nohostOnly: true },
  "auction/done": { where: "auctionResult", who: "lead", nohostOnly: true },
  "closest/done": { where: "miniSummary", who: "lead", nohostOnly: true },
  "flag/done": { where: "flagSummary", who: "lead", nohostOnly: true },
  "pin/done": { where: "pinSummary", who: "lead", nohostOnly: true },
  "airport/done": { where: "airportSummary", who: "lead", nohostOnly: true },
  "dish/done": { where: "dishSummary", who: "lead", nohostOnly: true },
  "map/done": { where: "mapSummary", who: "lead", nohostOnly: true },
  "ui/pause": { where: ["ask", "steal", "miniQ", "flagQ", "dishQ", "mapQ", "auctionRun", "sayQ", "pinQ", "airportQ", "battleQ"], who: "any", nohostOnly: true },
  "ui/closeLifeline": { where: "*", who: "turn", nohostOnly: true },
  /* The app's calls stand unless contested: either captain contests one (host or not); with no host
     the other captain agrees or not (the app's call stands after a while); with a host, the host decides */
  "ui/contest": { where: CONTEST_SCREENS, who: "any" },
  "ui/contestOk": { where: CONTEST_SCREENS, who: "any", nohostOnly: true },
  "battle/reviewDone": { where: "battleReview", who: "lead", nohostOnly: true },
  "auction/tick": { where: "auctionRun", who: "other", nohostOnly: true },
  "auction/untick": { where: "auctionRun", who: "other", nohostOnly: true },
  "ui/exit": { where: "final", who: "any", nohostOnly: true },
  "ui/again": { where: "final", who: "any", nohostOnly: true },
  "tie/more": { where: TIE_SCREENS, who: "lead", nohostOnly: true },
  "tie/stop": { where: TIE_SCREENS, who: "lead", nohostOnly: true },
  "decided/more": { where: DECIDED, who: "lead", nohostOnly: true },
  "decided/stop": { where: DECIDED, who: "lead", nohostOnly: true },
  "ui/pauseFriend": { where: "ask", who: "lead", nohostOnly: true },
  "ui/startCall": { where: "ask", who: "turn", nohostOnly: true },
};
/* Taps that adjust the screen they're on — counting names, marking a team
   right or wrong, pausing. They skip the stale-tap check (and don't bump the
   step): a host tapping +1 five times fast must get five, and a tap on
   "Next" straight after marking a team must not be refused as stale. */
export const SAME_SCREEN = new Set(["ui/setScore", "auction/tick", "auction/untick", "ui/flagOk", "ui/mapOk", "ui/sayOk", "ui/airportOk", "ui/pause", "ui/pauseFriend", "ui/startCall", "ui/contest", "ui/contestOk", "ui/flip"]);
/* no host: the screens that wait for the lead captain's Start or Next (nothing moves on by itself) */
export const WAITS_FOR_NEXT = new Set(["battleReview", "roundIntro", "miniIntro", "flagIntro", "dishIntro", "mapIntro", "auctionIntro", "sayIntro", "pinIntro", "airportIntro", "battleIntro", "battleHandoff",
  "answer", "roundScore", "closestReveal", "flagReveal", "mapReveal", "sayReveal", "pinReveal", "airportReveal", "dishReveal", "auctionLeg", "auctionResult",
  "miniSummary", "flagSummary", "dishSummary", "mapSummary", "saySummary", "pinSummary", "airportSummary", "battleSummary", "sudden", DECIDED, ...TIE_SCREENS]);
export const other = (t: 0 | 1) => (t === 0 ? 1 : 0) as 0 | 1;
export const DIFFS = ["easy", "medium", "hard", "mixed"];
/* a picture game's levels from the phone: known ones only, or the default */
export const levels = (x: unknown, keys: string[], dflt: string[]) => { const v = (Array.isArray(x) ? x : []).filter((k) => keys.includes(k)); return v.length ? v : dflt; };
export const PARTY_MINIS = ["closest", "auction", "saysame", "map", "flag", "dish", "pin", "airport", "battle"];
/* the server's timestamps, in either spelling ("…T12:00:00.123456+00:00" from a read, "… 12:00:00.123456+00" from a push), as ms */
export const serverMs = (x: string) => Date.parse(String(x || "").replace(" ", "T").replace(/(\.\d{3})\d+/, "$1").replace(/([+-]\d\d)$/, "$1:00"));
export const dishKind = (q: G) => ((q?.level || "")[0] === "c" ? "Cocktail" : "Dish");
export const dishTotal = (q: G) => (q.ings.length - 1) * T().tDishStep + DISH_LAST;
export const miniOf = (sc: string): MiniKey | null => /^(mini|closest)/.test(sc) ? "closest" : /^flag/.test(sc) ? "flag" : /^dish/.test(sc) ? "dish"
  : /^map/.test(sc) ? "map" : /^auction/.test(sc) ? "auction" : /^say/.test(sc) ? "saysame" : /^pin/.test(sc) ? "pin" : /^airport/.test(sc) ? "airport" : /^battle/.test(sc) ? "battle" : null;
/* the engine's move prefix for each mini-game */
export const PREFIX: Record<MiniKey, string> = { closest: "closest", flag: "flag", dish: "dish", map: "map", auction: "auction", saysame: "say", pin: "pin", airport: "airport", battle: "battle" };
/* Closest, Say the Same, Flag, Pin and Airport: the engine goes straight into a tie-breaker leg when level at the end;
   Party stops there first and asks (One more / A point each), as Dish and Map already do */
export const TIES: Record<string, { key: MiniKey; q: string; summary: string; award: string }> = {
  miniTie: { key: "closest", q: "miniQ", summary: "miniSummary", award: "closest/award" },
  sayTie: { key: "saysame", q: "sayQ", summary: "saySummary", award: "say/award" },
  flagTie: { key: "flag", q: "flagQ", summary: "flagSummary", award: "flag/award" },
  pinTie: { key: "pin", q: "pinQ", summary: "pinSummary", award: "pin/award" },
  airportTie: { key: "airport", q: "airportQ", summary: "airportSummary", award: "airport/award" },
};
export const miniState = (g: G, k: MiniKey | null) => k === "closest" ? g.mini : k === "flag" ? g.flagGame : k === "map" ? g.mapGame : k === "dish" ? g.dishGame : k === "saysame" ? g.saySame
  : k === "pin" ? g.pinGame : k === "airport" ? g.airportGame : null;
/* Drop the Pin: a pin from a phone, if it is one ({lat, lon} in range); else null */
export const asPin = (x: unknown): { lat: number; lon: number } | null => {
  const p = x as { lat?: unknown; lon?: unknown } | null;
  const lat = Number(p?.lat), lon = Number(p?.lon);
  return p && typeof p === "object" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 } : null;
};
