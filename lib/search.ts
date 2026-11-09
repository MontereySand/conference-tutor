import type { Client, estypes } from "@elastic/elasticsearch";
import type { Chunk, Lang } from "./types.ts";
import { IndexedChunkSchema } from "./data-schema.ts";
export type SearchMode = "lexical" | "semantic" | "hybrid" | "rerank";
export type IndexedChunk = { chunk_id: string; source_id: string; kind: "talk" | "reference"; title: string; url: string; chapter?: string; start_ms?: number; end_ms?: number; sentence_ids?: string[]; text: string; text_hi?: string; text_es?: string; text_zh?: string };
export function toChunk(row: IndexedChunk): Chunk {
  return { chunkId: row.chunk_id, sourceId: row.source_id, kind: row.kind, title: row.title, url: row.url, chapter: row.chapter, startMs: row.start_ms, endMs: row.end_ms, sentenceIds: row.sentence_ids, text: row.text, text_hi: row.text_hi, text_es: row.text_es, text_zh: row.text_zh };
}
export function fuseRanks<T extends { chunkId: string }>(lists: T[][], size = 8): T[] {
  const scored = new Map<string, { item: T; score: number; order: number }>();
  for (const list of lists) for (const [rank, item] of list.entries()) {
    const entry = scored.get(item.chunkId) ?? { item, score: 0, order: scored.size };
    entry.score += 1 / (60 + rank + 1); scored.set(item.chunkId, entry);
  }
  return [...scored.values()].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, size).map((r) => r.item);
}
export function retrievalQueries(question: string, lang: Lang, sourceIds: string[]) {
  const filter: estypes.QueryDslQueryContainer[] = [{ terms: { source_id: sourceIds } }];
  const lexical: estypes.QueryDslQueryContainer = { bool: { filter, must: [{ multi_match: { query: question, fields: ["text^2", "title", ...(lang === "en" ? [] : [`text_${lang}`])] } }] } };
  const semantic: estypes.QueryDslQueryContainer = { bool: { filter, must: [{ semantic: { field: "text_semantic", query: question } }] } };
  return { lexical, semantic };
}
export async function searchPrepared(client: Client, options: { question: string; lang: Lang; sourceIds: string[]; mode?: SearchMode; nativeRrf?: boolean; size?: number; signal?: AbortSignal }): Promise<Chunk[]> {
  const { question, lang, sourceIds, mode = "hybrid", nativeRrf = true, size = 8, signal } = options;
  if (!sourceIds.length) return [];
  const { lexical, semantic } = retrievalQueries(question, lang, sourceIds);
  const query = async (value: estypes.QueryDslQueryContainer, count: number) => {
    const result = await client.search<IndexedChunk>({ index: "ct-passages", size: count, query: value, _source: { excludes: ["text_semantic"] } }, { signal });
    return result.hits.hits.flatMap((h) => h._source ? [toChunk(IndexedChunkSchema.parse(h._source))] : []);
  };
  if (mode === "lexical" || mode === "semantic") return query(mode === "lexical" ? lexical : semantic, size);
  if (!nativeRrf) {
    if (mode === "rerank") throw new Error("Reranking unavailable without native RRF");
    return fuseRanks(await Promise.all([query(lexical, 30), query(semantic, 30)]), size);
  }
  const rrf: estypes.RetrieverContainer = { rrf: { retrievers: [{ standard: { query: lexical } }, { standard: { query: semantic } }], rank_window_size: 30, rank_constant: 60 } };
  const retriever: estypes.RetrieverContainer = mode === "rerank"
    ? { text_similarity_reranker: { retriever: rrf, field: "text", inference_id: ".jina-reranker-v3", inference_text: question, rank_window_size: 30 } }
    : rrf;
  const result = await client.search<IndexedChunk>({ index: "ct-passages", size, _source: { excludes: ["text_semantic"] }, retriever }, { signal });
  return result.hits.hits.flatMap((h) => h._source ? [toChunk(IndexedChunkSchema.parse(h._source))] : []);
}
