import { describe, expect, it } from "vitest";
import { boundedSelection, visibleGlosses } from "./transcript-helpers";

describe("transcript interaction bounds", () => {
  it("trims and bounds selected text without splitting a surrogate pair", () => {
    expect(boundedSelection("  hello  ")).toBe("hello");
    expect(boundedSelection("a".repeat(999) + "😀")).toBe("a".repeat(999));
  });
  it("shows prepared cues only during their actual clock intervals", () => {
    const cue = { id: "one", term: "term", text: "definition", startMs: 1000, endMs: 5500, cites: ["chunk"] };
    expect(visibleGlosses([cue], 999)).toEqual([]);
    expect(visibleGlosses([cue], 1000)).toEqual([cue]);
    expect(visibleGlosses([cue], 5499)).toEqual([cue]);
    expect(visibleGlosses([cue], 5500)).toEqual([]);
    expect(visibleGlosses(undefined, 2000)).toEqual([]);
  });
});
