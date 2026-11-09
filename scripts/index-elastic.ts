import { Client, errors } from "@elastic/elasticsearch";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ChunkSchema } from "../lib/data-schema.ts";
import { getBudget } from "../lib/budget.ts";
import { searchPrepared } from "../lib/search.ts";
function errorStatus(error: unknown): number | undefined { return error instanceof errors.ResponseError ? error.statusCode ?? undefined : undefined; }
const ElasticErrorBody = z.object({ error: z.object({ type: z.string().optional(), reason: z.string().optional() }) });
async function main() {
  if (!process.env.ELASTICSEARCH_URL || !process.env.ELASTICSEARCH_API_KEY) throw new Error("Elastic environment is not configured");
  const endpointUrl = new URL(process.env.ELASTICSEARCH_URL);
  if (endpointUrl.protocol !== "https:") throw new Error("Elastic endpoint must use HTTPS");
  const client = new Client({ node: endpointUrl.href, auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }, maxRetries: 0, requestTimeout: 120000 });
  let inferenceId: string | undefined;
  for (const id of [".jina-embeddings-v5-text-small", ".jina-embeddings-v3"]) {
    try { await client.inference.get({ inference_id: id }); inferenceId = id; break; }
    catch (error) { if (errorStatus(error) !== 404) throw error; }
  }
  if (!inferenceId) {
    if (!process.env.OPENAI_API_KEY) throw new Error("Neither Jina endpoint exists and OpenAI fallback key is missing");
    inferenceId = "ct-openai-embeddings";
    try { await client.inference.get({ inference_id: inferenceId }); }
    catch (error) {
      if (errorStatus(error) !== 404) throw error;
      await client.inference.put({ task_type: "text_embedding", inference_id: inferenceId, inference_config: { service: "openai", service_settings: { api_key: process.env.OPENAI_API_KEY, model_id: "text-embedding-3-small", dimensions: 1536 } } });
    }
    // Elastic does not return provider token usage; keep a conservative charged hold.
    getBudget().admit("embedding", 0.01);
  }
  const name = "ct-passages-v1";
  if (!(await client.indices.exists({ index: name }))) await client.indices.create({ index: name, mappings: { properties: {
    chunk_id: { type: "keyword" }, source_id: { type: "keyword" }, kind: { type: "keyword" }, chapter: { type: "keyword" }, url: { type: "keyword", index: false }, start_ms: { type: "long" }, end_ms: { type: "long" }, sentence_ids: { type: "keyword" }, title: { type: "text" }, text: { type: "text", analyzer: "english" }, text_hi: { type: "text", analyzer: "hindi" }, text_es: { type: "text", analyzer: "spanish" }, text_zh: { type: "text", analyzer: "cjk" }, text_semantic: { type: "semantic_text", inference_id: inferenceId },
  } } });
  const talk = z.array(ChunkSchema).parse(JSON.parse(readFileSync(resolve("data/index/chunks.json"), "utf8")));
  const referenceDir = resolve("data/references");
  const references = readdirSync(referenceDir).filter((f) => f.endsWith(".json")).flatMap((f) => z.array(ChunkSchema).parse(JSON.parse(readFileSync(resolve(referenceDir, f), "utf8"))));
  const chunks = [...talk, ...references];
  if (new Set(chunks.map((c) => c.chunkId)).size !== chunks.length) throw new Error("Duplicate chunk ids");
  for (const chunk of talk) for (const lang of ["hi", "es", "zh"] as const) if (!chunk[`text_${lang}`]?.trim()) throw new Error(`Missing ${lang} translation: ${chunk.chunkId}`);
  const operations = chunks.flatMap((c) => [{ index: { _index: name, _id: c.chunkId } }, { chunk_id: c.chunkId, source_id: c.sourceId, kind: c.kind, title: c.title, url: c.url, chapter: c.chapter, start_ms: c.startMs, end_ms: c.endMs, sentence_ids: c.sentenceIds, text: c.text, text_hi: c.text_hi, text_es: c.text_es, text_zh: c.text_zh, text_semantic: c.text }]);
  const response = await client.bulk({ operations, refresh: true });
  if (response.errors) {
    const failures = response.items.filter((i) => (i.index?.status ?? 200) >= 300).map((i) => ({ id: i.index?._id, status: i.index?.status, type: i.index?.error?.type }));
    console.error("Bulk item failures:", JSON.stringify(failures)); throw new Error("Elastic ingestion failed");
  }
  let oldAliases: string[] = [];
  try { oldAliases = Object.keys(await client.indices.getAlias({ name: "ct-passages" })); }
  catch (error) { if (errorStatus(error) !== 404) throw error; }
  await client.indices.updateAliases({ actions: [...oldAliases.filter((i) => i !== name).map((index) => ({ remove: { index, alias: "ct-passages" } })), { add: { index: name, alias: "ct-passages" } }] });
  let nativeRrf = true;
  let rrfNote = "Native RRF verified";
  try { await searchPrepared(client, { question: "What is an agent harness?", lang: "en", sourceIds: ["omnigent", "omnigent-reference"] }); }
  catch (error) {
    const parsed = error instanceof errors.ResponseError ? ElasticErrorBody.safeParse(error.meta.body) : null;
    const body = parsed?.success ? parsed.data.error : undefined;
    if (!/license|rrf|retriever.*(unknown|unsupported)/i.test(`${body?.type ?? ""} ${body?.reason ?? ""}`)) throw error;
    nativeRrf = false; rrfNote = `Application RRF required (${body?.type ?? "unsupported"})`;
    await searchPrepared(client, { question: "What is an agent harness?", lang: "en", sourceIds: ["omnigent", "omnigent-reference"], nativeRrf });
  }
  const count = (await client.count({ index: "ct-passages" })).count;
  if (count !== chunks.length) throw new Error("Alias count differs from prepared chunks");
  mkdirSync(resolve("data/evidence"), { recursive: true });
  writeFileSync(resolve("data/evidence/elastic.json"), JSON.stringify({ at: new Date().toISOString(), index: name, alias: "ct-passages", inferenceId, nativeRrf, rrfNote, count }, null, 2) + "\n");
  console.log(`Indexed ${count} passages; inference ${inferenceId}; ${rrfNote}`);
  await client.close();
}
main().catch((error: unknown) => { console.error(`Indexing stopped: ${error instanceof Error ? error.name : "Error"}; HTTP ${errorStatus(error) ?? "n/a"}. No credentials or payloads logged.`); process.exitCode = 1; });
