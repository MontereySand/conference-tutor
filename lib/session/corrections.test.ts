import { describe, expect, it } from "vitest";
import { AskSchema } from "../request-schema";
import type { Corrections } from "../types";
import { correctionsForIntent } from "./corrections";

describe("correction precedence", () => {
  it("keeps explicit Deeper despite an old simpler question", () => {
    const explicit: Corrections = { depth: "deep", noAnalogy: true };
    expect(correctionsForIntent(explicit, "simpler", "regenerate")).toEqual(explicit);
  });
  it("keeps explicit Simpler despite an old deeper question", () => {
    const explicit: Corrections = { depth: "simple", noAnalogy: false };
    expect(correctionsForIntent(explicit, "deeper", "regenerate")).toEqual(explicit);
  });
  it("does not infer rejection of an analogy during regeneration", () => {
    const explicit: Corrections = { depth: "standard", noAnalogy: false };
    expect(correctionsForIntent(explicit, "analogy_unhelpful", "regenerate")).toEqual(explicit);
  });
  it("honors recognized typed follow-ups without mutating current corrections", () => {
    const current: Corrections = { depth: "standard", noAnalogy: false };
    expect(correctionsForIntent(current, "simpler", "question")).toEqual({ depth: "simple", noAnalogy: false });
    expect(correctionsForIntent(current, "deeper", "question")).toEqual({ depth: "deep", noAnalogy: false });
    expect(correctionsForIntent(current, "analogy_unhelpful", "question")).toEqual({ depth: "standard", noAnalogy: true });
    expect(current).toEqual({ depth: "standard", noAnalogy: false });
  });
  it("preserves existing corrections for the low-confidence new_question fallback and disagreement", () => {
    const current: Corrections = { depth: "deep", noAnalogy: true };
    expect(correctionsForIntent(current, "new_question", "question")).toEqual(current);
    expect(correctionsForIntent(current, "disagreement", "question")).toEqual(current);
  });
});

describe("ask request kind boundary", () => {
  const request = {
    turnKey: { sourceId: "invented", profileId: null, lang: "en", version: 0, turnId: "one" },
    question: "Why does the invented mechanism work?", currentMs: 1000,
    corrections: { depth: "standard", noAnalogy: false }, history: [],
  };
  it("requires a recognized kind with no legacy fallback", () => {
    for (const requestKind of [undefined, null, "", "retry", 1]) {
      expect(AskSchema.safeParse({ ...request, requestKind }).success).toBe(false);
    }
    expect(AskSchema.safeParse(request).success).toBe(false);
  });
  it("accepts both question and regeneration requests", () => {
    for (const requestKind of ["question", "regenerate"]) {
      expect(AskSchema.parse({ ...request, requestKind }).requestKind).toBe(requestKind);
    }
  });
});
