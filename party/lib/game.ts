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
  result?: { answer: string; notes?: string; correct: boolean; stolen: boolean; by: 0 | 1 | null; pts: number; typed?: Two<string[] | null> };
  roundPts?: Two<number>;
  lifeline?: { key: string; team: 0 | 1; deadline: number | null } | null;
  sudden?: { ready: boolean; shown: boolean; n: number; answer?: string } | null;
  mini?: { key: MiniKey; title: string; leg: number; of: number; wins: Two<number>; pts: number; kinds?: string; tie?: boolean };
  flag?: string;                  // the flag's file name (flags/<flag>.svg)
  dish?: { kind: string; ings: string[]; n: number };
  reveal?: { answer: string; typed?: Two<string[] | null>; guesses?: Two<number | null>; ok?: Two<boolean | null>; w: 0 | 1 | "tie" | "none" | null };
  summary?: { wins: Two<number>; winner: 0 | 1 | null; needsHost: boolean; note: string; award?: Two<number> };
  winner?: 0 | 1 | null;
  toast?: { id: number; text: string } | null;
  /* no host: what a captain sent, the app's verdict, and how long the other captain has to overrule it */
  pending?: { team: 0 | 1; text: string; v: boolean; until: number } | null;
  map?: { id: string; reveal: boolean; hint?: string; title?: string; notes?: string; ruled?: Two<boolean | null> };
  auction?: { cat: string; notes?: string; bid: number; by: 0 | 1 | null; turn: 0 | 1; count: number; leg: number; n: number; wins: Two<number>;
    last?: { bid: number; by: 0 | 1; count: number; made: boolean; won: 0 | 1 }; winner?: 0 | 1 | null; award?: Two<number> };
  battle?: { cap: 0 | 1; i: number; n: number; score: Two<number>; last?: { answer: string; got: boolean } | null; tb?: number; winner?: 0 | 1 | null; note?: string; award?: Two<number> };
  autoAt?: number | null;         // no host: when this screen moves on by itself
  pips?: { kind: "std" | "mini"; state: "now" | "done" | "todo" }[];   // the night's progress, for the tracker
  captains?: [string | null, string | null];
  tMini?: number;
  paused?: boolean;          // the clock was paused: the question is hidden until it restarts
  lead?: 0 | 1;              // no host: the captain who starts and moves the night on (Team A's, or B's)
  nextBy?: string;           // no host: whose Start or Next the room is waiting for
  nextOpenAt?: number;       // ...and from when the other captain may tap it too
  nextOther?: string | null; // that other captain
  imad?: { id: number; text: string };   // Imad's latest line (text only)
  /* phones that left the game screen during a question (another app or tab): name, team, how long (null: still away) */
  flags?: { id: number; name: string; team: 0 | 1 | null; label: string; qid?: string; ms: number | null }[];                 // Closest To Wins clock, for its rules
  mode: "host" | "nohost";
};
/* host only: the answer, and what the captains typed with the app's opinion */
export type Secret = { qid?: string; step?: number; answer?: string; notes?: string; typed?: Two<string[] | null>; match?: Two<boolean | null>; guesses?: Two<number | null> };

export const MINI_TITLES: Record<MiniKey, string> = { closest: "Closest To Wins", flag: "Guess the Flag", dish: "Cocktail or Dish", map: "Guess the Map", auction: "The Auction", saysame: "Don't Say the Same as Me", battle: "Battle of the Captains" };
export const T_CLOSEST = 90, T_FLAG = 15, DISH_STEP = 3, DISH_LAST = 8, T_MAP = 60, T_AUCTION = 30;
export const T_SAY = 20, T_BATTLE_HOST = 7, T_BATTLE_TYPED = 15;
/* no host: the other captain has this long to agree or overrule the app before it stands */
export const T_OVERRULE = 15, T_SUDDEN_BUZZ = 30, T_MAP_RULE = 30;
/* the Battle is rapid fire: a shorter window there (the other captain can still Agree at once) */
export const T_OVERRULE_BATTLE = 8;
/* no host: if the lead captain hasn't tapped Next after this long, the other captain can */
export const T_NEXT_FALLBACK = 20;
/* a captain whose phone has been gone this long hands over to a teammate who's still here */
export const T_AWAY = 60;
