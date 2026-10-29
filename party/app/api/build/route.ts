/* the deploy that's live now (see lib/fresh.ts), and whether it must reach a TV mid-night (deploy.json) */
import deploy from "../../../deploy.json";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD || "", urgent: !!deploy.urgent }, { headers: { "Cache-Control": "no-store" } });
}
