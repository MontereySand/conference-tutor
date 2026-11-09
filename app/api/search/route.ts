import { getSources, getElasticEvidence } from "@/lib/data";
import { getElastic } from "@/lib/es";
import { searchPrepared } from "@/lib/search";
import { requireSameOrigin, parseJson, apiError } from "@/lib/http";
import { SearchSchema } from "@/lib/request-schema";
import { withSpan } from "@/lib/telemetry";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const { question, lang } = await parseJson(request, SearchSchema);
    const sources = getSources().filter((s) => s.ready); const readyIds = new Set(sources.map((s) => s.id));
    const evidence = getElasticEvidence();
    const hits = await withSpan("ct.retrieve", { lang, kind: "library", mode: evidence.appMode }, () => searchPrepared(getElastic(), { question, lang, sourceIds: [...readyIds], mode: evidence.appMode, nativeRrf: evidence.nativeRrf, size: 8, signal: request.signal }));
    const moments = hits.filter((c) => c.kind === "talk" && readyIds.has(c.sourceId) && c.startMs !== undefined && c.endMs !== undefined).map((c) => ({ chunkId: c.chunkId, sourceId: c.sourceId, title: c.title, startMs: c.startMs!, endMs: c.endMs!, url: "/watch/" + c.sourceId + "?t=" + c.startMs! / 1000 + "&lang=" + lang }));
    return Response.json({ moments });
  } catch (error) { return apiError(error, "search"); }
}
