import { randomUUID } from "node:crypto";
import { zodTextFormat } from "openai/helpers/zod";
import { getSource, getTranscript, getCard, getChunks, getElasticEvidence, PreparedDataMissing } from "@/lib/data";
import { getElastic } from "@/lib/es";
import { getOpenAI } from "@/lib/openai";
import { searchPrepared } from "@/lib/search";
import { activeSentenceAt } from "@/lib/clock";
import { getBudget } from "@/lib/budget";
import { requireSameOrigin, parseJson, HttpError, apiError } from "@/lib/http";
import { AskSchema } from "@/lib/request-schema";
import { LessonSchema, type CitationSource } from "@/lib/lesson/schema";
import { LESSON_INSTRUCTIONS, lessonInput } from "@/lib/lesson/prompt";
import { validateLesson } from "@/lib/lesson/validate";
import { decideIntent, type Intent } from "@/lib/decide";
import { withSpan, recordCost, recordLesson } from "@/lib/telemetry";
import type { TurnKey, Corrections } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const started = performance.now(); const requestId = randomUUID();
  let stage = "validate"; let turnKey: TurnKey | undefined; let admitted = false;
  try {
    requireSameOrigin(request);
    const input = await parseJson(request, AskSchema); turnKey = input.turnKey;
    const source = getSource(turnKey.sourceId);
    if (!source?.ready) throw new HttpError(400, "unknown_source");
    const card = turnKey.profileId ? getCard(turnKey.profileId) : null;
    if (turnKey.profileId && !card) throw new HttpError(400, "unknown_profile");
    const transcript = getTranscript(source.id, "en");
    if (!transcript) throw new PreparedDataMissing("transcripts/" + source.id + ".en.json");
    const evidenceConfig = getElasticEvidence(); const elastic = getElastic(); const openai = getOpenAI();
    const currentMs = Math.max(0, Math.min(source.durationMs, input.currentMs));
    const activeIndex = activeSentenceAt(transcript.sentences, currentMs);
    const active = transcript.sentences[activeIndex];
    const sourceIds = [source.id, ...source.referenceIds];
    const anchor = active ? getChunks().find((c) => c.kind === "talk" && c.sourceId === source.id && c.sentenceIds?.includes(active.id)) : undefined;
    const hold = getBudget().admit("lesson", 0.01); admitted = true;
    stage = "retrieve";
    const intentPromise: Promise<Intent> = input.history.length ? decideIntent(input.question, turnKey.lang, request.signal).catch((error: unknown) => { if (request.signal.aborted) throw error; return "new_question"; }) : Promise.resolve("new_question");
    const [retrieved, intent] = await Promise.all([
      withSpan("ct.retrieve", { lang: turnKey.lang, "ct.request_id": requestId, mode: evidenceConfig.appMode }, () => searchPrepared(elastic, { question: input.question + (active ? "\n" + active.text : ""), lang: turnKey!.lang, sourceIds, mode: evidenceConfig.appMode, nativeRrf: evidenceConfig.nativeRrf, size: 8, signal: request.signal })),
      intentPromise,
    ]);
    const evidence = [...new Map([...(anchor ? [anchor] : []), ...retrieved].filter((c) => sourceIds.includes(c.sourceId)).map((c) => [c.chunkId, c])).values()];
    const corrections: Corrections = { ...input.corrections };
    if (intent === "analogy_unhelpful") corrections.noAnalogy = true;
    if (intent === "simpler") corrections.depth = "simple";
    if (intent === "deeper") corrections.depth = "deep";
    stage = "generate";
    const result = await withSpan("ct.generate", { lang: turnKey.lang, model: "gpt-6-luna", "ct.request_id": requestId, "ct.requested_tier": "fast", "ct.profile_mode": card ? "profile" : "general" }, async (span) => {
      const response = await openai.responses.parse({ model: "gpt-6-luna", service_tier: "fast", store: false, instructions: LESSON_INSTRUCTIONS, prompt_cache_key: "ct-lesson-v1", input: lessonInput({ question: input.question, lang: turnKey!.lang, context: activeIndex < 0 ? [] : transcript.sentences.slice(Math.max(0, activeIndex - 3), activeIndex + 4), evidence, card, corrections, history: input.history, intent }), text: { format: zodTextFormat(LessonSchema, "lesson") }, max_output_tokens: 1200 }, { signal: request.signal });
      span.setAttributes({ "ct.served_tier": response.service_tier ?? "unknown", "ct.input_tokens": response.usage?.input_tokens ?? 0, "ct.output_tokens": response.usage?.output_tokens ?? 0 });
      return response;
    });
    const checked = LessonSchema.safeParse(result.output_parsed);
    if (!checked.success) throw new HttpError(502, "unavailable");
    const parsed = checked.data;
    const { lesson, validCitations } = validateLesson(parsed, evidence, sourceIds, card, corrections, turnKey.lang);
    const fast = result.service_tier === "fast" || result.service_tier === "priority";
    const costUsd = result.usage ? getBudget().record(hold, { inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens, fast }) : hold.maxUsd;
    if (result.usage) recordCost("lesson", costUsd);
    const sources: CitationSource[] = evidence.map(({ chunkId, kind, title, url, startMs, endMs }) => ({ chunkId, kind, title, url, startMs, endMs }));
    const ms = Math.round(performance.now() - started);
    recordLesson(lesson.answer ? "answered" : "abstained", { lang: turnKey.lang, "ct.request_id": requestId, "ct.citation_valid": validCitations, "ct.served_tier": result.service_tier ?? "unknown", "ct.cost_usd": costUsd, "ct.duration_ms": ms });
    return Response.json({ turnKey, lesson, sources, corrections, meta: { servedTier: result.service_tier ?? "unknown", ms, costUsd } });
  } catch (error) {
    if (admitted) recordLesson(request.signal.aborted ? "aborted" : "failed", { lang: turnKey?.lang ?? "en", "ct.request_id": requestId, stage });
    return apiError(error, stage, turnKey);
  }
}
