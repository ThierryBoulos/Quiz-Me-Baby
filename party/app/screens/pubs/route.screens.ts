/* The screen check's data (npm run screens): the screens kept from simulated nights. A route only when QMB_SCREENS=1
   (next.config.mjs); never in a deploy. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.QMB_SCREENS !== "1") return new Response("Not found", { status: 404 });
  const text = await readFile(join(process.cwd(), "sim/.out/screens/pubs.json"), "utf8");
  return new Response(text, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
