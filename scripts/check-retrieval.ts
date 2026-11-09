import { Client } from "@elastic/elasticsearch";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { searchPrepared } from "../lib/search.ts";
import type { Lang, Chunk } from "../lib/types.ts";
import { getBudget } from "../lib/budget.ts";
import { ElasticEvidenceSchema } from "../lib/data-schema.ts";
const cases: { id: string; lang: Lang; query: string; window: [number, number] }[] = [
  { id: "harness-en", lang: "en", query: "What is an AI agent harness?", window: [115000, 159000] },
  { id: "harness-hi", lang: "hi", query: "AI एजेंट हार्नेस क्या है?", window: [115000, 159000] },
  { id: "harness-es", lang: "es", query: "¿Qué es el arnés de un agente de IA?", window: [115000, 159000] },
  { id: "harness-zh", lang: "zh", query: "什么是 AI 智能体的 harness？", window: [115000, 159000] },
  { id: "policy-en", lang: "en", query: "Why is email blocked after reading a confidential document?", window: [687000, 706000] },
  { id: "policy-hi", lang: "hi", query: "गोपनीय दस्तावेज़ पढ़ने के बाद ईमेल भेजना क्यों बंद हो जाता है?", window: [687000, 706000] },
  { id: "policy-es", lang: "es", query: "¿Por qué se bloquea el correo después de leer un documento confidencial?", window: [687000, 706000] },
  { id: "policy-zh", lang: "zh", query: "为什么读取机密文档后发送电子邮件会被阻止？", window: [687000, 706000] },
];
async function main() {
  if (!process.env.ELASTICSEARCH_URL || !process.env.ELASTICSEARCH_API_KEY) throw new Error("Elastic environment is not configured");
  const evidence = ElasticEvidenceSchema.parse(JSON.parse(readFileSync(resolve("data/evidence/elastic.json"), "utf8")));
  const client = new Client({ node: process.env.ELASTICSEARCH_URL, auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }, maxRetries: 0 });
  const rows = [];
  for (const item of cases) {
    const ranks: Record<string, number | null> = {};
    const ids: Record<string, string[]> = {};
    for (const mode of ["lexical", "semantic", "hybrid"] as const) {
      if (mode !== "lexical" && evidence.inferenceId === "ct-openai-embeddings") getBudget().admit("embedding", 0.001);
      const hits = await searchPrepared(client, { question: item.query, lang: item.lang, sourceIds: ["omnigent", "omnigent-reference"], mode, nativeRrf: evidence.nativeRrf, size: 8 });
      const supports = (c: Chunk) => c.kind === "talk" && (c.startMs ?? Infinity) < item.window[1] && (c.endMs ?? 0) > item.window[0] && (item.id.startsWith("harness") ? /interface to the world|language model|connects it to files/i.test(c.text) : /confidential/i.test(c.text));
      const rank = hits.findIndex(supports); ranks[mode] = rank < 0 ? null : rank + 1; ids[mode] = hits.map((c) => c.chunkId);
    }
    rows.push({ id: item.id, lang: item.lang, expectedWindowMs: item.window, ranks, chunkIds: ids });
    console.log(`${item.id}: lexical=${ranks.lexical ?? "not in 8"}; semantic=${ranks.semantic ?? "not in 8"}; hybrid=${ranks.hybrid ?? "not in 8"}`);
  }
  const passed = rows.filter((r) => r.ranks.hybrid !== null && r.ranks.hybrid <= 3).length;
  const result = { at: new Date().toISOString(), inventedQueries: true, queryCount: cases.length, passedTop3: passed, required: 7, passed: passed >= 7, rows };
  mkdirSync(resolve("data/evidence"), { recursive: true }); writeFileSync(resolve("data/evidence/retrieval.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(`Hybrid expected-window top 3: ${passed}/8; ${result.passed ? "PASS" : "FAIL"}`);
  await client.close(); if (!result.passed) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(`Retrieval check stopped: ${error instanceof Error ? error.name : "Error"}. No credentials or payloads logged.`); process.exitCode = 1; });
