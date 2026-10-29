/* Is the game server awake? One tiny read from the database. A scheduled job
   (.github/workflows/ping.yml) calls this every 30 minutes: it keeps a Free
   Supabase project from pausing itself after a quiet week, and GitHub emails
   the owner if it ever fails. A second leg (party/vercel.json) calls it once a
   day from Vercel, in case GitHub switches the schedule off after 60 idle days.
   ?deep=1 (once a day): also signs in anonymously and calls one RPC, the way
   a phone does, so a broken auth or RPC path is caught, not just a sleeping
   database. (The anonymous login it leaves is cleaned up after 30 days.) */
export const dynamic = "force-dynamic";
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ryefabglqhdobqtlmkfx.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_eGQwRBjnVd4yHKf_dBP3vQ_G-Nv79ZD";

async function deepCheck(): Promise<string> {
  const s = await fetch(BASE + "/auth/v1/signup", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}", cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!s.ok) return `sign-in HTTP ${s.status}`;
  const { access_token } = (await s.json()) as { access_token?: string };
  if (!access_token) return "sign-in gave no token";
  /* a harmless RPC: a room that can't exist answers no_room (auth, RLS and the function all ran) */
  const r = await fetch(BASE + "/rest/v1/rpc/qmb_rejoin", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ r: "ZZZZ", nm: "ping" }), cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) return `rpc HTTP ${r.status}`;
  const j = (await r.json()) as { error?: string };
  return j?.error === "no_room" ? "" : "rpc answered " + JSON.stringify(j).slice(0, 80);
}

export async function GET(req: Request) {
  const t0 = Date.now(), deep = new URL(req.url).searchParams.get("deep") === "1";
  let supabase: "ok" | "down" = "down", detail = "";
  try {
    const r = await fetch(BASE + "/rest/v1/rooms?select=code&limit=1", { headers: { apikey: KEY }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (r.ok) supabase = "ok"; else detail = `HTTP ${r.status}`;
    if (r.ok && deep) { detail = await deepCheck(); if (detail) supabase = "down"; }
  } catch (e) { detail = e instanceof Error ? e.message : String(e); }
  const body = { ok: supabase === "ok", supabase, deep, ms: Date.now() - t0, build: process.env.NEXT_PUBLIC_BUILD || "", ...(detail ? { detail } : {}) };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
