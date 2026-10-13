// Liveness and readiness for the container health check, a load balancer or a monitor. 200 means the app is up and
// the database answers; 503 means the database does not. It says nothing else: no versions of dependencies, no
// hostnames, no counts, because anyone can reach it.
import config from "@payload-config";
import { getPayload } from "payload";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const payload = await getPayload({ config });
    await payload.count({ collection: "sites" });
    return Response.json({ status: "ok", version: process.env.POLYSITE_VERSION || "dev" }, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
