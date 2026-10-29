/* Every error a person can see, in plain words. The server answers with
   codes ("bad_name") or database messages ("violates check constraint
   members_name_check"); nobody at a party should ever read those. */
const CODES: Record<string, string> = {
  not_signed_in: "We couldn't connect your phone. Refresh the page and try again.",
  no_room: "Room not found. Check the code on the TV.",
  bad_name: "Names can be 1 to 12 characters.",
  name_taken: "Someone here already has that name.",
  face_taken: "Someone already took that face. Pick another.",
  not_started: "That game hasn't started yet, so just join with your name.",
  no_such_player: "Nobody with that name is in this game.",
  seat_in_use: "That seat's phone is still here. If it's yours and it died, wait a minute and try again.",
  "not in this room": "You're not in this room any more. Join again with the code on the TV.",
  "pick a team first": "Pick a team first.",
  "unknown role": "That didn't work. Try again.",
  game_over: "That game is over. Ask for the new code on the TV.",
};
const DB: [RegExp, string][] = [
  [/members_name_check|name.*too long|value too long/i, "Names can be 1 to 12 characters."],
  [/members_name_unique/i, "Someone here already has that name."],
  [/members_avatar_unique/i, "Someone already took that face. Pick another."],
  [/members_one_captain/i, "Your team already has a captain."],
  [/members_one_host/i, "There's already a host."],
  [/rate limit|too many requests|over_request_rate_limit|\b429\b/i, "Too many phones joined at once. Wait a minute and try again."],
  [/project.*(paused|inactive)/i, "The game server is asleep. Try again in a minute."],
  [/failed to fetch|networkerror|network request failed|load failed|timeout/i, "No connection. Check your internet and try again."],
  [/jwt|session|not signed in|anonymous/i, "Your session ran out. Refresh the page and try again."],
  [/row-level security|permission denied|not allowed/i, "You can't do that from this phone."],
];

export function friendly(e: unknown): string {
  const raw = (e instanceof Error ? e.message : typeof e === "string" ? e : "").trim();
  if (!raw) return "Something went wrong. Try again.";
  if (CODES[raw]) return CODES[raw];
  for (const [re, text] of DB) if (re.test(raw)) return text;
  /* already a sentence for people (e.g. "Lea is your captain"): tidy it up */
  if (/^[A-Z]?[\w' ]+$/.test(raw) && !raw.includes("_") && raw.split(" ").length > 1) return raw[0].toUpperCase() + raw.slice(1) + (/[.!?]$/.test(raw) ? "" : ".");
  return "Something went wrong. Try again.";
}
