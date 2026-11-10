import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { z } from "zod";
import { SourceSchema, TranscriptSchema, ChunkSchema, ProfileCardSchema, ConceptSchema, ElasticEvidenceSchema } from "./data-schema";
import type { Lang, PreparedDemo, Transcript } from "./types";
import { applyTimingReview } from "./timing";
const root = resolve(process.cwd(), "data");
const cache = new Map<string, unknown>();
export class PreparedDataMissing extends Error {
  constructor(public readonly relativePath: string) { super("Prepared data required: " + relativePath); this.name = "PreparedDataMissing"; }
}
export function preparedPath(relative: string): string {
  const path = resolve(root, relative.replace(/^data\//, ""));
  if (!path.startsWith(root + sep)) throw new Error("Invalid prepared data path");
  return path;
}
function load<T>(relative: string, schema: z.ZodType<T>): T {
  if (cache.has(relative)) return cache.get(relative) as T;
  const path = preparedPath(relative);
  if (!existsSync(path)) throw new PreparedDataMissing(relative);
  const value = schema.parse(JSON.parse(readFileSync(path, "utf8")));
  cache.set(relative, value); return value;
}
export function getSources() { return load("sources.json", z.array(SourceSchema)); }
export function getSource(id: string) { return getSources().find((s) => s.id === id) ?? null; }
export function getTranscript(sourceId: string, lang: Lang): Transcript | null {
  const source = getSource(sourceId);
  if (!source?.ready || !source.transcriptPath) return null;
  const relative = source.transcriptPath.replace(/\.en\.json$/, "." + lang + ".json");
  if (lang !== "en" && !existsSync(preparedPath(relative))) return null;
  const transcript = load(relative, TranscriptSchema);
  const review = preparedPath("transcripts/" + source.id + ".review.json");
  if (existsSync(review)) {
    const { starts } = z.object({ starts: z.record(z.string(), z.number().int().nonnegative()) }).parse(JSON.parse(readFileSync(review, "utf8")));
    return applyTimingReview(transcript, starts);
  }
  return applyTimingReview(transcript, {});
}
export function getChunks() {
  const chunks = [...load("index/chunks.json", z.array(ChunkSchema))];
  for (const path of new Set(getSources().flatMap((s) => s.referencePaths))) chunks.push(...load(path, z.array(ChunkSchema)));
  return chunks;
}
export function getCards() { return load("profiles/cards.json", z.array(ProfileCardSchema)); }
export function getCard(id: string) { return getCards().find((card) => card.id === id) ?? null; }
export function getConcepts(sourceId: string) { const s = getSource(sourceId); return s?.conceptsPath ? load(s.conceptsPath, z.array(ConceptSchema)) : []; }
export function getPreparedDemo(sourceId: string): PreparedDemo | null {
  const source = getSource(sourceId);
  if (!source?.conceptsPath) return null;
  const concepts = getConcepts(sourceId).filter(concept => concept.prepared);
  if (concepts.length === 0) return null;
  if (concepts.length !== 1) throw new Error("Invalid prepared demo");
  const concept = concepts[0]!;
  const prepared = concept.prepared!;
  if (concept.endMs > source.durationMs) throw new Error("Invalid prepared demo interval");
  const chunks = getChunks();
  const sources = prepared.sourceIds.map(chunkId => {
    const matches = chunks.filter(chunk => chunk.chunkId === chunkId);
    const chunk = matches[0];
    if (matches.length !== 1 || !chunk || chunk.kind !== "talk" || chunk.sourceId !== sourceId || chunk.startMs === undefined || chunk.endMs === undefined || chunk.endMs <= chunk.startMs || chunk.endMs > source.durationMs) throw new Error("Invalid prepared demo source");
    return { chunkId: chunk.chunkId, startMs: chunk.startMs, endMs: chunk.endMs };
  });
  let coveredUntil = concept.startMs;
  for (const chunk of [...sources].sort((a, b) => a.startMs - b.startMs)) {
    if (chunk.startMs <= coveredUntil) coveredUntil = Math.max(coveredUntil, chunk.endMs);
  }
  if (coveredUntil < concept.endMs) throw new Error("Invalid prepared demo coverage");
  return { sourceId, startMs: concept.startMs, endMs: concept.endMs, title: prepared.title, question: prepared.question, explanation: prepared.explanation, steps: prepared.steps, bridge: prepared.bridge, sources };
}
export function getElasticEvidence() { return load("evidence/elastic.json", ElasticEvidenceSchema); }
