/* What the TV publishes for the phones. The TV holds the whole game; the
   phones only ever get this view of it — and the answer goes in a separate
   row only the host can read (Supabase row-level security). */
export type Team = { name: string; score: number; ll: { friend: boolean; dip: boolean; dbl: boolean } };
export type Pub = {
  step: number;                   // bumps on every move; host taps carry it so stale ones are refused
  screen: string;                 // roundIntro | ask | steal | answer | roundScore | sudden | final | lifeline…
  r: number; N: number; theme?: string;
  turn?: 0 | 1;                   // the team answering (or stealing) now
  first?: 0 | 1;                  // who answers first this round
  question?: string;
  deadline?: number | null;       // ms since epoch when the clock runs out; null = paused/none
  left?: number;                  // seconds left when paused
  timeUp?: boolean;
  dbl?: [boolean, boolean];
  llUsed?: [string[], string[]];
  teams: [Team, Team];
  result?: { answer: string; notes?: string; correct: boolean; stolen: boolean; by: 0 | 1 | null; pts: number };
  roundPts?: [number, number];
  lifeline?: { key: string; team: 0 | 1; deadline: number | null } | null;
  sudden?: { ready: boolean; shown: boolean; n: number; answer?: string } | null;
  winner?: 0 | 1 | null;
  toast?: { id: number; text: string } | null;
  mode: "host" | "nohost";
};
export type Secret = { answer?: string; notes?: string };
