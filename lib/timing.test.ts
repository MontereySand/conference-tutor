import { describe, expect, it } from "vitest";
import { applyTimingReview } from "./timing";
import type { Lang, Transcript } from "./types";

function transcript(lang: Lang = "en"): Transcript {
  return {
    sourceId: "invented", lang, durationMs: 1000,
    chapters: [{ startMs: 0, title: "Invented chapter" }],
    sentences: [
      { id: "a", startMs: 100, endMs: 200, text: "Invented first sentence.", raw: "", chapter: 0, timing: "derived" },
      { id: "b", startMs: 300, endMs: 400, text: "Invented second sentence.", raw: "", chapter: 0, timing: "derived" },
      { id: "c", startMs: 700, endMs: 800, text: "Invented third sentence.", raw: "", chapter: 0, timing: "derived" },
    ],
    machineTranslated: lang !== "en", reviewed: false,
  };
}

function intervals(value: Transcript) {
  return value.sentences.map(({ startMs, endMs, timing }) => [startMs, endMs, timing]);
}

describe("timing review application", () => {
  it("moves an earlier start, aligns its predecessor, and preserves the following gap", () => {
    const original = transcript();
    const result = applyTimingReview(original, { b: 150 });
    expect(intervals(result)).toEqual([[100, 150, "derived"], [150, 400, "reviewed"], [700, 800, "derived"]]);
    expect(result.reviewed).toBe(false);
    expect(intervals(original)).toEqual([[100, 200, "derived"], [300, 400, "derived"], [700, 800, "derived"]]);
    expect(result.chapters[0]).not.toBe(original.chapters[0]);
  });

  it("accepts a later start beyond its old end and extends only the obsolete interval", () => {
    const result = applyTimingReview(transcript(), { b: 500 });
    expect(intervals(result)).toEqual([[100, 500, "derived"], [500, 700, "reviewed"], [700, 800, "derived"]]);
    expect(result.reviewed).toBe(false);
  });

  it("extends a final sentence to duration when its old end is obsolete", () => {
    const result = applyTimingReview(transcript(), { c: 900 });
    expect(intervals(result)).toEqual([[100, 200, "derived"], [300, 900, "derived"], [900, 1000, "reviewed"]]);
  });

  it("retains a still-usable end when moving later within the interval", () => {
    expect(intervals(applyTimingReview(transcript(), { b: 350 }))).toEqual([
      [100, 350, "derived"], [350, 400, "reviewed"], [700, 800, "derived"],
    ]);
  });

  it("applies all starts before deriving ends regardless of mark order", () => {
    const result = applyTimingReview(transcript(), { c: 900, b: 850, a: 500 });
    expect(intervals(result)).toEqual([[500, 850, "reviewed"], [850, 900, "reviewed"], [900, 1000, "reviewed"]]);
    expect(result.reviewed).toBe(true);
  });

  it("preserves prior review status and recomputes transcript review completeness", () => {
    const original = transcript();
    original.sentences[0]!.timing = "reviewed";
    original.sentences[2]!.timing = "reviewed";
    const result = applyTimingReview(original, { b: 300 });
    expect(result.sentences.every(sentence => sentence.timing === "reviewed")).toBe(true);
    expect(result.reviewed).toBe(true);
    original.reviewed = true;
    original.sentences[0]!.timing = "derived";
    expect(applyTimingReview(original, {}).reviewed).toBe(false);
  });

  it("preserves all untouched intervals and gaps without marks", () => {
    expect(applyTimingReview(transcript(), {})).toEqual(transcript());
  });

  it.each([100, 99, 700, 701])("rejects equal or crossing neighboring starts: %s", startMs => {
    expect(() => applyTimingReview(transcript(), { b: startMs })).toThrow();
  });

  it.each([-1, 1000, 1001, 300.5, NaN, Infinity])("rejects noninteger or out-of-duration marks: %s", startMs => {
    expect(() => applyTimingReview(transcript(), { b: startMs })).toThrow();
  });

  it("rejects unknown sentence IDs instead of silently discarding marks", () => {
    expect(() => applyTimingReview(transcript(), { unknown: 500 })).toThrow();
  });

  it("revalidates the resulting transcript schema", () => {
    const original = transcript();
    original.sentences[2]!.endMs = 1001;
    expect(() => applyTimingReview(original, { b: 350 })).toThrow();
  });

  it.each(["en", "hi", "es", "zh"] as const)("applies aligned intervals and status in %s", lang => {
    const original = transcript(lang);
    const result = applyTimingReview(original, { a: 100, b: 500, c: 900 });
    expect(intervals(result)).toEqual([[100, 500, "reviewed"], [500, 900, "reviewed"], [900, 1000, "reviewed"]]);
    expect(result.reviewed).toBe(true);
    expect(result.lang).toBe(lang);
    expect(result.machineTranslated).toBe(lang !== "en");
    expect(result.sentences.map(sentence => sentence.text)).toEqual(original.sentences.map(sentence => sentence.text));
  });
});
