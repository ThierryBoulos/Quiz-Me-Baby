/* Is the game server awake? One tiny read from the database. A scheduled job
   (.github/workflows/ping.yml) calls this every 30 minutes: it keeps a Free
   Supabase project from pausing itself after a quiet week, and GitHub emails
   the owner if it ever fails. */
export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ryefabglqhdobqtlmkfx.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_eGQwRBjnVd4yHKf_dBP3vQ_G-Nv79ZD";

export async function GET() {
  const t0 = Date.now();
  let supabase: "ok" | "down" = "down", detail = "";
  try {
    const r = await fetch(URL + "/rest/v1/rooms?select=code&limit=1", { headers: { apikey: KEY }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (r.ok) supabase = "ok"; else detail = `HTTP ${r.status}`;
  } catch (e) { detail = e instanceof Error ? e.message : String(e); }
  const body = { ok: supabase === "ok", supabase, ms: Date.now() - t0, build: process.env.NEXT_PUBLIC_BUILD || "", ...(detail ? { detail } : {}) };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
