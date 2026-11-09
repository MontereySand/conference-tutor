export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const url = process.env.DASH0_RUM_ENDPOINT?.trim();
  const authToken = process.env.DASH0_RUM_TOKEN?.trim();
  const headers = { "Cache-Control": "no-store" };
  if (!url || !authToken) return Response.json({ enabled: false }, { headers });
  try {
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) throw new Error("Invalid endpoint");
    // Only the intentionally browser-visible, ingest-only token belongs in this response.
    return Response.json({ enabled: true, url: endpoint.href, authToken }, { headers });
  } catch {
    return Response.json({ enabled: false }, { headers });
  }
}
