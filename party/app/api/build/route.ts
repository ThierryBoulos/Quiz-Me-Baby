/* the deploy that's live now (see lib/fresh.ts) */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD || "" }, { headers: { "Cache-Control": "no-store" } });
}
