import { getSource, getCard, getChunks } from "@/lib/data";
import { requireSameOrigin, parseJson, HttpError, apiError } from "@/lib/http";
import { CheckSchema } from "@/lib/request-schema";
import { checkPrediction } from "@/lib/decide";
import type { TurnKey } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let turnKey: TurnKey | undefined;
  try {
    requireSameOrigin(request); const input = await parseJson(request, CheckSchema); turnKey = input.turnKey;
    const source = getSource(turnKey.sourceId);
    if (!source?.ready) throw new HttpError(400, "unknown_source");
    if (turnKey.profileId && !getCard(turnKey.profileId)) throw new HttpError(400, "unknown_profile");
    const sourceIds = new Set([source.id, ...source.referenceIds]);
    const allowed = new Set(getChunks().filter((c) => sourceIds.has(c.sourceId)).map((c) => c.chunkId));
    if (!input.prediction.cites.every((id) => allowed.has(id))) throw new HttpError(400, "invalid_citation");
    const verdict = await checkPrediction({ attempt: input.attempt, prompt: input.prediction.prompt, expected: input.prediction.expected }, turnKey.lang, request.signal);
    return Response.json({ turnKey, verdict, expected: input.prediction.expected, cites: input.prediction.cites });
  } catch (error) { return apiError(error, "check", turnKey); }
}
