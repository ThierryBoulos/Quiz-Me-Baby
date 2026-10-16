import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import full from "@/data/bank.json";
import accept from "@/data/accept.json";

/* The bank with the answers (D5). Only the room's TV and its host get it: the
   database says who they are (qmb_sees_answers, with the caller's own
   session). Every other phone has public/bank.json, which has no questions
   and no answers. Flags go out under their public/fx names (scripts/hash-flags.mjs:
   the same key and hash). */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ryefabglqhdobqtlmkfx.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_eGQwRBjnVd4yHKf_dBP3vQ_G-Nv79ZD";
const FLAG_KEY = process.env.QMB_FLAG_KEY || "qmb-fx-2026-wave2";
const fx = (code: string) => createHash("sha256").update(FLAG_KEY + ":" + code).digest("hex").slice(0, 16);
type Row = { type: string; flag?: string; [k: string]: unknown };
const bank = { ...full, bank: (full.bank as Row[]).map((q) => (q.type === "flag" && q.flag ? { ...q, flag: fx(q.flag) } : q)) };

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const room = String(((await req.json().catch(() => ({}))) as { room?: unknown }).room || "").toUpperCase().slice(0, 4);
  if (!/^Bearer .+/.test(auth) || room.length !== 4) return Response.json({ error: "not allowed" }, { status: 401 });
  const sb = createClient(URL, KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("qmb_sees_answers", { r: room });
  if (error) return Response.json({ error: "check failed" }, { status: 502 });
  if (data !== true) return Response.json({ error: "not allowed" }, { status: 403 });
  return Response.json({ bank, accept }, { headers: { "cache-control": "private, no-store" } });
}
