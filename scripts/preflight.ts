import OpenAI from "openai";
import { Client, errors } from "@elastic/elasticsearch";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBudget } from "../lib/budget.ts";
import { ElasticEvidenceSchema } from "../lib/data-schema.ts";

type Check = { stage: string; ok: boolean; ms: number; details?: Record<string, string | number | boolean>; errorClass?: string; httpStatus?: number };
async function main() {
  const checks: Check[] = [];
  async function check(stage: string, fn: () => Promise<Record<string, string | number | boolean>>) {
    const start = performance.now();
    try {
      const details = await fn();
      checks.push({ stage, ok: true, ms: Math.round(performance.now() - start), details });
    }
    catch (error) { checks.push({ stage, ok: false, ms: Math.round(performance.now() - start), errorClass: error instanceof Error ? error.name : "UnknownError", httpStatus: error instanceof OpenAI.APIError ? error.status : error instanceof errors.ResponseError ? error.statusCode ?? undefined : undefined }); }
  }
  const presence = Object.fromEntries(["OPENAI_API_KEY", "ELASTICSEARCH_URL", "ELASTICSEARCH_API_KEY", "OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_HEADERS", "DASH0_RUM_ENDPOINT", "DASH0_RUM_TOKEN"].map((key) => [key, Boolean(process.env[key]?.trim())]));
  console.log("Environment presence only:", JSON.stringify(presence));
  await check("structured-schema", async () => { const format = zodTextFormat(z.object({ ok: z.boolean() }), "preflight"); return { zod4: format.type === "json_schema" && format.strict === true }; });
  if (presence.OPENAI_API_KEY) {
    const client = new OpenAI({ maxRetries: 0, timeout: 20000 });
    await check("responses", async () => {
      const hold = getBudget().admit("lesson", 0.01);
      const response = await client.responses.create({ model: "gpt-6-luna", input: "Say OK.", service_tier: "fast", max_output_tokens: 128, store: false });
      const usd = response.usage ? getBudget().record(hold, { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, fast: response.service_tier === "fast" || response.service_tier === "priority" }) : hold.maxUsd;
      return { requestedTier: "fast", servedTier: response.service_tier ?? "unknown", inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, chargedOrReservedUsd: usd };
    });
    await check("decisions", async () => {
      const hold = getBudget().admit("decision", 0.002);
      const response = await client.decisions.create({ model: "gpt-6-luna", input: "The number 2 is even.", questions: [{ name: "even", type: "predicate", instructions: "Is the statement true?" }] });
      const usd = getBudget().record(hold, { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
      if (response.answers[0]?.type !== "predicate") throw new Error("Decision refused");
      return { available: true, chargedUsd: usd };
    });
    await check("realtime-secret", async () => {
      const hold = getBudget().admit("narration", 0.05);
      const response = await client.realtime.clientSecrets.create({ expires_after: { anchor: "created_at", seconds: 120 }, session: { type: "realtime", model: "gpt-realtime-2.1-mini", output_modalities: ["audio"], audio: { input: { turn_detection: null }, output: { voice: "marin" } }, tracing: null } });
      if (!response.value || !response.expires_at) throw new Error("No ephemeral client secret");
      getBudget().record(hold, { inputTokens: 0, audioOutputTokens: 0 });
      return { created: true, audioConnected: false };
    });
  }
  if (presence.ELASTICSEARCH_URL && presence.ELASTICSEARCH_API_KEY) {
    if (new URL(process.env.ELASTICSEARCH_URL!).protocol !== "https:") throw new Error("Elastic URL must use HTTPS");
    const client = new Client({ node: process.env.ELASTICSEARCH_URL!, auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! }, maxRetries: 0, requestTimeout: 20000 });
    await check("elastic-ping", async () => ({ available: await client.ping() }));
    const path = resolve("data/evidence/elastic.json");
    if (existsSync(path)) {
      const evidence = ElasticEvidenceSchema.parse(JSON.parse(readFileSync(path, "utf8")));
      await check("elastic-inference", async () => { await client.inference.get({ inference_id: evidence.inferenceId }); return { inferenceId: evidence.inferenceId }; });
      await check("elastic-alias", async () => ({ count: (await client.count({ index: "ct-passages" })).count }));
    } else checks.push({ stage: "elastic-index", ok: false, ms: 0, details: { reason: "Index has not been prepared" } });
    await client.close();
  }
  const configured = presence.OPENAI_API_KEY && presence.ELASTICSEARCH_URL && presence.ELASTICSEARCH_API_KEY;
  const passed = configured && checks.every((row) => row.ok);
  const result = { at: new Date().toISOString(), passed, presence, checks, chargedOrReservedUsd: getBudget().spentUsd };
  mkdirSync(resolve("data/evidence"), { recursive: true }); writeFileSync(resolve("data/evidence/preflight.json"), JSON.stringify(result, null, 2) + "\n");
  for (const row of checks) console.log(JSON.stringify(row));
  console.log(`Preflight ${passed ? "PASS" : "NOT READY"}; charged/reserved $${result.chargedOrReservedUsd.toFixed(6)}`);
  if (!passed) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(`Preflight stopped: ${error instanceof Error ? error.name : "Error"}. No secret values logged.`); process.exitCode = 1; });
