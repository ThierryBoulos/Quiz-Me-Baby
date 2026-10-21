/* What the TV publishes for the phones. The TV holds the whole game; the
   phones only ever get this view of it — and the answer goes in a separate
   row only the host can read (Supabase row-level security). */
export type Team = { name: string; score: number; ll: { friend: boolean; dip: boolean; dbl: boolean } };
export type Two<T> = [T, T];
export type MiniKey = "closest" | "flag" | "dish" | "map" | "auction" | "saysame" | "battle";
export type Pub = {
  step: number;                   // bumps on every host move and screen change; host taps carry it so stale ones are refused
  screen: string;                 // roundIntro | ask | steal | answer | roundScore | sudden | final | miniIntro | miniQ | closestReveal | miniSummary | flag… | dish…
  qid?: string;                   // the question on screen now — suggestions are filed under it
  r: number; N: number; theme?: string;
  turn?: 0 | 1;                   // the team answering (or stealing) now
  first?: 0 | 1;                  // who answers first this round
  question?: string;              // never set for flags or dishes: there the question IS the answer
  deadline?: number | null;       // ms since epoch when the clock runs out; null = paused/none
  left?: number;                  // seconds left when paused
  timeUp?: boolean;
  dbl?: Two<boolean>;
  llUsed?: Two<string[]>;
  teams: Two<Team>;
  sent?: Two<boolean>;            // which captains have sent an answer for this question
  buzz?: 0 | 1 | null;            // who buzzed (dish, sudden death)
  out?: Two<boolean>;             // who is out of this one (dish, sudden death)
  result?: { answer: string; notes?: string; correct: boolean; stolen: boolean; by: 0 | 1 | null; pts: number; typed?: Two<string[] | null>; owner?: 0 | 1 };
  roundPts?: Two<number>;
  lifeline?: { key: string; team: 0 | 1; deadline: number | null; left?: number; wait?: boolean } | null;   // left: Call a Friend paused with this many seconds to go; wait: the call not started yet
  sudden?: { ready: boolean; shown: boolean; n: number; answer?: string } | null;
  mini?: { key: MiniKey; title: string; leg: number; of: number; wins: Two<number>; pts: number; kinds?: string; tie?: boolean; fun?: boolean };
  /* a mini-game won with legs to spare: keep playing for fun, or stop here (screen "decided") */
  decided?: { key: MiniKey; title: string; winner: 0 | 1; spare: number; pts: number };
  /* the app's calls on this screen (answer card, reveals, Battle review), and one being contested:
     with no host the other captain agrees or not before `until` (then the call stands); with a host, the host decides */
  calls?: { id: string; team: 0 | 1; text: string; ok: boolean; done?: boolean; note?: string; answer?: string }[];
  contest?: { id: string; by: 0 | 1; team: 0 | 1; text: string; ok: boolean; until: number } | null;
  /* with a host: what the captain typed (never the answer), so the host's phone shows it the moment it lands */
  said?: Two<string[] | null>;
  /* pictures coming up next (flags under their public/fx names, map ids), fetched ahead so they show at once */
  preload?: { flags?: string[]; maps?: string[] };
  /* the end of the night: a short story of it, shown after the confetti */
  recap?: { margin: number; sudden: boolean; leadChanges: number; steals: Two<number>; minis: Two<number>; best?: { title: string; team: 0 | 1; legs: Two<number> } };
  flag?: string;                  // the flag's file name (flags/<flag>.svg)
  dish?: { kind: string; ings: string[]; n: number; late?: 0 | 1 | null;   // late: the team whose 10 s to type ran out
    typeBy?: number | null };   // the buzzer's own clock to type it (the TV's time), while they haven't
  /* ok: the verdict that stands now; app: what the app said first (the "App suggests" tag) */
  reveal?: { answer: string; typed?: Two<string[] | null>; guesses?: Two<number | null>; ok?: Two<boolean | null>; app?: Two<boolean | null>; w: 0 | 1 | "tie" | "none" | null;
    offList?: Two<boolean>; notes?: string };   // notes: Closest To Wins' word on the answer. offList: Say the Same: an answer that isn't a real answer to the prompt (it counts as SAID IT)
  summary?: { wins: Two<number>; winner: 0 | 1 | null; needsHost: boolean; note: string; award?: Two<number> };
  winner?: 0 | 1 | null;
  toast?: { id: number; text: string } | null;
  /* no host: what a captain sent, the app's verdict, and how long the other captain has to change the call */
  pending?: { team: 0 | 1; text: string; v: boolean; until: number } | null;
  map?: { id: string; reveal: boolean; hint?: string; title?: string; notes?: string; ruled?: Two<boolean | null> };
  auction?: { cat: string; notes?: string; bid: number; by: 0 | 1 | null; turn: 0 | 1; count: number; leg: number; n: number; wins: Two<number>; bids?: Two<number | null>;
    last?: { bid: number; by: 0 | 1; count: number; made: boolean; won: 0 | 1 }; winner?: 0 | 1 | null; award?: Two<number>;
    countedBy?: string };   // who taps +1 while the bidder names them (the host, or with no host the other captain)
  battle?: { cap: 0 | 1; i: number; n: number; score: Two<number>; last?: { answer: string; got: boolean | null } | null;
    tb?: number; winner?: 0 | 1 | null; note?: string; award?: Two<number>;
    half?: { said: string; got: boolean; answer: string }[] };   // half: at the handoff, the first captain's every answer
  autoAt?: number | null;         // no host: when this screen moves on by itself
  pips?: { kind: "std" | "mini"; state: "now" | "done" | "todo" }[];   // the night's progress, for the tracker
  captains?: [string | null, string | null];
  tMini?: number;
  /* the house timers (Settings, on the TV), for the rules shown on every screen */
  timers?: { question: number; steal: number; friend: number; contest: number; sudden: number; mini: number; flag: number; map: number; say: number;
    auction: number; dishStep: number; dishType: number; battleHost: number; battleTyped: number };
  paused?: boolean;          // the clock was paused: the question is hidden until it restarts
  lead?: 0 | 1;              // no host: the captain who starts and moves the night on (Team A's, or B's)
  nextBy?: string;           // no host: whose Start or Next the room is waiting for
  nextOpenAt?: number;       // ...and from when the other captain may tap it too
  nextOther?: string | null; // that other captain
  imad?: { id: number; text: string };   // Imad's latest line (text only)
  at?: number;               // the TV's clock when this was published (phones correct their own clock with it)
  /* per phone, its last few taps the TV has dealt with (tag → "+" taken, else why not, "-" if nothing to say):
     a few, not one, as two quick taps can reach the TV the other way round */
  ack?: Record<string, Record<string, string>>;
  tvAway?: boolean;          // the TV's screen is asleep or hidden: everything is paused until it's back
  /* phones that left the game screen during a question (another app or tab): name, team, how long (null: still away) */
  flags?: { id: number; name: string; team: 0 | 1 | null; label: string; qid?: string; ms: number | null; kind?: "away" | "paste" }[];                 // Closest To Wins clock, for its rules
  exit?: boolean;            // the night is over and someone tapped Exit: every screen goes home
  mode: "host" | "nohost";
};
/* host only: the answer, and what the captains typed with the app's opinion */
export type Secret = { qid?: string; step?: number; answer?: string; notes?: string; accept?: string[]; typed?: Two<string[] | null>; match?: Two<boolean | null>; guesses?: Two<number | null> };

/* level at the end of a mini-game: the host (with no host, the lead captain) picks "One more" or "A point each" */
export const TIE_SCREENS = ["miniTie", "sayTie", "flagTie", "dishTie", "mapTie", "battleLevel"];
/* a mini-game can't be lost any more, with legs still to play: the same people choose — keep playing for fun, or stop here */
export const DECIDED = "decided";
export const MINI_TITLES: Record<MiniKey, string> = { closest: "Closest To Wins", flag: "Guess the Flag", dish: "Guess the Cocktail or Dish", map: "Guess the Map", auction: "The Auction", saysame: "Don't Say the Same as Me", battle: "Battle of the Captains" };
export const T_CLOSEST = 60, T_FLAG = 15, DISH_STEP = 3, DISH_LAST = 8, T_MAP = 60, T_AUCTION = 30;
export const T_SAY = 20, T_BATTLE_HOST = 7, T_BATTLE_TYPED = 15;
/* no host: the other captain has this long to give a point the app called WRONG (a RIGHT always stands) */
/* T_OVERRULE: no host, how long a captain has to answer the other captain's contest before the app's call stands */
export const T_OVERRULE = 15, T_SUDDEN_BUZZ = 30, T_MAP_RULE = 30;
/* the Battle is rapid fire: a shorter window there (the other captain can still confirm at once) */
export const T_OVERRULE_BATTLE = 8;
/* no host: if the lead captain hasn't tapped Next after this long, the other captain can */
export const T_NEXT_FALLBACK = 20;
/* a captain whose phone has been gone this long hands over to a teammate who's still here */
export const T_AWAY = 60;
/* in the lobby: a captain silent this long shows as away on the TV, and a teammate can take the armband */
export const T_LOBBY_AWAY = 30;
/* Guess the Cocktail or Dish: after a buzz, this long to type it (no clock shown); then it's wrong */
export const T_DISH_TYPE = 10;
/* A clock closes this long after it shows 0, unseen: an answer sent at "1 s left" is still on its way
   when the TV's clock hits zero (phone to server to TV), and it counts. */
export const T_GRACE_MS = 1000;
/* the Auction: nobody names more than this in the time (and a typo can't bid 999) */
export const MAX_BID = 100;
/* Party plays some mini-games shorter than Classic (the shared engine keeps Classic's lengths) */
export const PARTY_LEGS: Partial<Record<MiniKey, number>> = { closest: 5, saysame: 7, dish: 5 };

/* A name inside a sentence, isolated, so a right-to-left name (Arabic) doesn't drag the
   punctuation around it out of order: "(Abdulrahman) left the screen" stays in order. */
export const iso = (name: string) => "\u2068" + name + "\u2069";
/* Closest To Wins: how far a guess is from the answer, without the computer's rounding noise
   (361.6 − 281 is 80.60000000000002 to it: that's 80.6, and two guesses as far off are level) */
export const offBy = (guess: number, answer: number) => Number(Math.abs(guess - answer).toPrecision(12));
/* a number as people read it: 1,500,000 · 80.6 */
export const showNum = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 6 });
