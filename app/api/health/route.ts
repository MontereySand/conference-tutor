import { configured } from "@/lib/env";
export const runtime = "nodejs";
export function GET() { return Response.json({ ok: true, sha: process.env.GIT_SHA ?? "dev", configured: configured() }); }
