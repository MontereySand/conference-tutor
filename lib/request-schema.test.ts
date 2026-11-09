import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { apiError, parseJson } from "./http";
import { AskSchema, CheckSchema, SearchSchema } from "./request-schema";
import { ChunkSchema, ConceptSchema, IndexedChunkSchema } from "./data-schema";

const turnKey = { sourceId: "invented", profileId: null, lang: "en", version: 0, turnId: "one" };
const ask = { turnKey, requestKind: "question", question: "Why?", currentMs: 0, corrections: { depth: "standard", noAnalogy: false }, history: [] };
const check = { turnKey, attempt: "An attempt", prediction: { prompt: "Why?", expected: "Because", cites: ["one"] } };

describe("locale request boundary", () => {
  it.each(["hi", "zh"])("returns a client error for unsupported %s in each API request", async (lang) => {
    const inputs: { schema: z.ZodType<unknown>; body: unknown; stage: string }[] = [
      { schema: AskSchema, body: { ...ask, turnKey: { ...turnKey, lang } }, stage: "validate" },
      { schema: CheckSchema, body: { ...check, turnKey: { ...turnKey, lang } }, stage: "check" },
      { schema: SearchSchema, body: { question: "Why?", lang }, stage: "search" },
    ];
    for (const { schema, body, stage } of inputs) {
      const request = new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
      try {
        await parseJson(request, schema);
        throw new Error("Unsupported locale was accepted");
      } catch (error) {
        const response = apiError(error, stage);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: { stage, code: "invalid" } });
      }
    }
  });
  it.each(["en", "es"])("accepts %s for ask, check and search", (lang) => {
    expect(AskSchema.safeParse({ ...ask, turnKey: { ...turnKey, lang } }).success).toBe(true);
    expect(CheckSchema.safeParse({ ...check, turnKey: { ...turnKey, lang } }).success).toBe(true);
    expect(SearchSchema.safeParse({ question: "Why?", lang }).success).toBe(true);
  });
});

it("strips historical chunk and concept locale fields while keeping Spanish", () => {
  const common = { kind: "talk", title: "Title", url: "https://www.youtube.com/watch?v=abcdefghijk", text: "English", text_es: "Español", text_hi: "old", text_zh: "old" };
  const chunk = ChunkSchema.parse({ ...common, chunkId: "one", sourceId: "source" });
  const indexed = IndexedChunkSchema.parse({ ...common, chunk_id: "one", source_id: "source" });
  for (const parsed of [chunk, indexed]) {
    expect(parsed).toHaveProperty("text_es", "Español");
    expect(parsed).not.toHaveProperty("text_hi");
    expect(parsed).not.toHaveProperty("text_zh");
  }
  const labels = { en: "English", es: "Español", hi: "old", zh: "old" };
  const concept = ConceptSchema.parse({ id: "one", startMs: 0, endMs: 1, title: labels, suggested: labels });
  expect(concept.title).toEqual({ en: "English", es: "Español" });
  expect(concept.suggested).toEqual({ en: "English", es: "Español" });
});
