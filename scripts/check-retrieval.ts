import { Client, errors } from "@elastic/elasticsearch";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { searchPrepared } from "../lib/search.ts";
import type { Lang, Chunk } from "../lib/types.ts";
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
  const evidencePath = resolve("data/evidence/elastic.json");
  const original: Record<string, unknown> = JSON.parse(readFileSync(evidencePath, "utf8"));
  const evidence = ElasticEvidenceSchema.parse(original);
  const client = new Client({ node: process.env.ELASTICSEARCH_URL, auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }, maxRetries: 0, requestTimeout: 30000 });
  const modes = ["lexical", "semantic", "hybrid", "rerank"] as const;
  const rows: { id: string; lang: Lang; expectedWindowMs: [number, number]; ranks: Record<string, number | null>; chunkIds: Record<string, string[]>; latencyMs: Record<string, number | null>; availability: Record<string, { available: boolean; errorClass?: string; httpStatus?: number }> }[] = [];
  for (const item of cases) {
    const ranks: Record<string, number | null> = {};
    const ids: Record<string, string[]> = {};
    const latencyMs: Record<string, number | null> = {};
    const availability: Record<string, { available: boolean; errorClass?: string; httpStatus?: number }> = {};
    for (const mode of modes) {
      if (mode === "rerank" && !evidence.nativeRrf) {
        ranks[mode] = null; ids[mode] = []; latencyMs[mode] = null;
        availability[mode] = { available: false, errorClass: "NativeRrfUnavailable" }; continue;
      }
      const start = performance.now();
      try {
        const hits = await searchPrepared(client, { question: item.query, lang: item.lang, sourceIds: ["omnigent", "omnigent-reference"], mode, nativeRrf: evidence.nativeRrf, size: 8 });
        const supports = (c: Chunk) => c.kind === "talk" && (c.startMs ?? Infinity) < item.window[1] && (c.endMs ?? 0) > item.window[0] && (item.id.startsWith("harness") ? /interface to the world|language model|connects it to files/i.test(c.text) : /confidential/i.test(c.text));
        const rank = hits.findIndex(supports);
        ranks[mode] = rank < 0 ? null : rank + 1; ids[mode] = hits.map((c) => c.chunkId);
        availability[mode] = { available: true };
      } catch (error) {
        if (mode !== "rerank") throw error;
        ranks[mode] = null; ids[mode] = [];
        availability[mode] = { available: false, errorClass: error instanceof Error ? error.name : "Error", httpStatus: error instanceof errors.ResponseError ? error.statusCode ?? undefined : undefined };
      }
      latencyMs[mode] = Math.round(performance.now() - start);
    }
    rows.push({ id: item.id, lang: item.lang, expectedWindowMs: item.window, ranks, chunkIds: ids, latencyMs, availability });
    console.log(`${item.id}: ${modes.map((mode) => `${mode}=${availability[mode]!.available ? ranks[mode] ?? "not in 8" : "unavailable"} (${latencyMs[mode] ?? "-"}ms)`).join("; ")}`);
  }
  const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.floor(sorted.length / 2)]!) / 2; };
  const summary = Object.fromEntries(modes.map((mode) => [mode, {
    available: rows.every((r) => r.availability[mode]!.available),
    passedTop3: rows.filter((r) => r.availability[mode]!.available && r.ranks[mode] !== null && r.ranks[mode]! <= 3).length,
    medianMs: rows.every((r) => r.availability[mode]!.available) ? median(rows.map((r) => r.latencyMs[mode]!)) : null,
  }]));
  const hybrid = summary.hybrid!; const rerank = summary.rerank!;
  const appMode = rerank.available && rerank.passedTop3 > hybrid.passedTop3 && rerank.medianMs! - hybrid.medianMs! <= 400 ? "rerank" : "hybrid";
  const passed = summary[appMode]!.passedTop3;
  const result = { at: new Date().toISOString(), inventedQueries: true, queryCount: cases.length, appMode, passedTop3: passed, required: 7, passed: passed >= 7, summary, rows };
  mkdirSync(resolve("data/evidence"), { recursive: true }); writeFileSync(resolve("data/evidence/retrieval.json"), JSON.stringify(result, null, 2) + "\n");
  writeFileSync(evidencePath, JSON.stringify({ ...original, appMode }, null, 2) + "\n");
  console.log(JSON.stringify({ appMode, summary, passed: result.passed }));
  if (!result.passed) for (const row of rows.filter((r) => r.ranks[appMode] === null || r.ranks[appMode]! > 3)) console.log(`${row.id}: top3 ${row.chunkIds[appMode]!.slice(0, 3).join(", ")}`);
  await client.close(); if (!result.passed) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(`Retrieval check stopped: ${error instanceof Error ? error.name : "Error"}. No credentials or payloads logged.`); process.exitCode = 1; });
