import { NextResponse } from "next/server";

/**
 * Local liveness check for the Docker HEALTHCHECK. Handled directly by Next
 * (filesystem routes take priority over the `/api/:path*` → BACKEND_URL
 * rewrite in next.config.ts), so it never depends on a backend being
 * reachable — this fork runs entirely on the local AAG mock data.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
