import { z } from "zod";
export const LangSchema = z.enum(["en", "es"]);
const Ms = z.number().int().nonnegative();
const WordTimingSchema = z.object({ text: z.string().min(1), startMs: Ms, endMs: Ms });
const TimedGlossSchema = z.object({ id: z.string().min(1), term: z.string().min(1).max(100), text: z.string().min(1).max(500), startMs: Ms, endMs: Ms, cites: z.array(z.string().min(1)).min(1).max(8) });
export const SentenceSchema = z.object({ id: z.string().min(1), startMs: Ms, endMs: Ms, text: z.string().min(1), raw: z.string(), chapter: z.number().int().nonnegative(), timing: z.enum(["derived", "reviewed"]), words: z.array(WordTimingSchema).min(1).optional() });
export const TranscriptSchema = z.object({ sourceId: z.string().min(1), lang: LangSchema, durationMs: Ms.positive(), chapters: z.array(z.object({ startMs: Ms, title: z.string().min(1) })).min(1), sentences: z.array(SentenceSchema).min(1), machineTranslated: z.boolean(), reviewed: z.boolean(), glosses: z.array(TimedGlossSchema).max(100).optional() }).superRefine((t, ctx) => {
  const ids = new Set<string>();
  for (const [i, s] of t.sentences.entries()) {
    if (ids.has(s.id) || s.endMs <= s.startMs || s.endMs > t.durationMs || (i > 0 && s.startMs < t.sentences[i - 1]!.endMs) || !t.chapters[s.chapter]) ctx.addIssue({ code: "custom", path: ["sentences", i], message: "Invalid sentence interval, identity, or chapter" });
    ids.add(s.id);
    if (s.words) {
      if (s.words.map(word => word.text).join("") !== s.text) ctx.addIssue({ code: "custom", path: ["sentences", i, "words"], message: "Aligned words must preserve the complete caption" });
      for (const [j, word] of s.words.entries()) {
        if (word.startMs < s.startMs || word.endMs > s.endMs || word.endMs <= word.startMs || (j > 0 && word.startMs < s.words[j - 1]!.endMs)) ctx.addIssue({ code: "custom", path: ["sentences", i, "words", j], message: "Invalid aligned word interval" });
      }
    }
  }
  const glossIds = new Set<string>();
  for (const [i, gloss] of (t.glosses ?? []).entries()) {
    if (glossIds.has(gloss.id) || gloss.endMs <= gloss.startMs || gloss.endMs > t.durationMs) ctx.addIssue({ code: "custom", path: ["glosses", i], message: "Invalid prepared definition interval or identity" });
    glossIds.add(gloss.id);
  }
});
const SourceUrl = z.string().url().refine((s) => { const u = new URL(s); return u.protocol === "https:" && ["www.youtube.com", "www.databricks.com"].includes(u.hostname); }, "Unsupported source URL");
export const ChunkSchema = z.object({ chunkId: z.string().min(1), sourceId: z.string().min(1), kind: z.enum(["talk", "reference"]), title: z.string().min(1), url: SourceUrl, chapter: z.string().optional(), startMs: Ms.optional(), endMs: Ms.optional(), sentenceIds: z.array(z.string()).optional(), text: z.string().min(1), text_es: z.string().min(1).optional() });
export const IndexedChunkSchema = z.object({ chunk_id: z.string().min(1), source_id: z.string().min(1), kind: z.enum(["talk", "reference"]), title: z.string().min(1), url: SourceUrl, chapter: z.string().optional(), start_ms: Ms.optional(), end_ms: Ms.optional(), sentence_ids: z.array(z.string()).optional(), text: z.string().min(1), text_es: z.string().min(1).optional() });
export const ProfileCardSchema = z.object({ id: z.string().min(1), name: z.string().min(1), role: z.string().min(1), anchors: z.array(z.object({ id: z.string().min(1), text: z.string().min(1), source: z.enum(["LinkedIn", "Public web", "Event report", "Event page"]), tags: z.array(z.string()).min(1) })).min(3).max(5) });
const LocaleText = z.object({ en: z.string().min(1), es: z.string().min(1) });
export const ConceptSchema = z.object({ id: z.string().min(1), startMs: Ms, endMs: Ms, title: LocaleText, suggested: LocaleText });
export const ElasticEvidenceSchema = z.object({ inferenceId: z.string().min(1), nativeRrf: z.boolean(), appMode: z.enum(["hybrid", "rerank"]).default("hybrid") });
const SourceLabel = z.object({ title: z.string(), event: z.string(), readiness: z.string(), unreadyReason: z.string().optional() });
export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), speaker: z.string().optional(),
  event: z.string(), youtubeId: z.string().regex(/^[\w-]{11}$/), url: SourceUrl,
  durationMs: Ms.positive(), ready: z.boolean(), unreadyReason: z.string().nullable(),
  referenceIds: z.array(z.string()), referencePaths: z.array(z.string()),
  conceptsPath: z.string().optional(), transcriptPath: z.string().optional(),
  labels: z.object({ en: SourceLabel, es: SourceLabel }),
  metadata: z.record(z.string(), z.unknown()),
});
export type Source = z.infer<typeof SourceSchema>;
