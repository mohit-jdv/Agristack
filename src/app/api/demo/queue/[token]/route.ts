import { isDemoMode } from "@/lib/config";
import { snapshotByToken } from "@/lib/demo/queue-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  if (!isDemoMode()) {
    return Response.json({ error: "Demo API disabled" }, { status: 404 });
  }

  const token = decodeURIComponent(params.token);
  const snap = snapshotByToken(token);
  if (!snap) {
    return Response.json({ error: "Token not found" }, { status: 404 });
  }

  return Response.json(snap, {
    headers: { "Cache-Control": "no-store" },
  });
}
