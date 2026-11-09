import { expect, it } from "vitest";
import { TranscriptSchema } from "./data-schema";
import type { Transcript } from "./types";

function transcript(): Transcript {
  return {
    sourceId: "invented", lang: "en", durationMs: 1000,
    chapters: [{ startMs: 0, title: "Invented example" }],
    sentences: [{ id: "one", startMs: 100, endMs: 400, text: "Red light.", raw: "", chapter: 0, timing: "derived", words: [
      { text: "Red ", startMs: 100, endMs: 200 }, { text: "light.", startMs: 200, endMs: 300 },
    ] }],
    machineTranslated: false, reviewed: false,
    glosses: [{ id: "color", term: "Red", text: "The example names a color.", startMs: 100, endMs: 600, cites: ["invented-c01"] }],
  };
}

const invalidWords: [string, (value: Transcript) => void][] = [
  ["changed caption text", value => { value.sentences[0]!.words![0]!.text = "Blue "; }],
  ["overlapping words", value => { value.sentences[0]!.words![1]!.startMs = 199; }],
  ["word before its caption", value => { value.sentences[0]!.words![0]!.startMs = 99; }],
  ["word after its caption", value => { value.sentences[0]!.words![1]!.endMs = 401; }],
  ["zero-duration word", value => { value.sentences[0]!.words![0]!.endMs = 100; }],
];
it.each(invalidWords)("rejects %s instead of displaying invented word precision", (_, mutate) => {
  const value = transcript(); mutate(value);
  expect(TranscriptSchema.safeParse(value).success).toBe(false);
});

it("rejects prepared definitions without source IDs or valid unique playback intervals", () => {
  const missingSource = transcript(); missingSource.glosses![0]!.cites = [];
  const outsideVideo = transcript(); outsideVideo.glosses![0]!.endMs = 1001;
  const duplicate = transcript(); duplicate.glosses!.push({ ...duplicate.glosses![0]! });
  for (const value of [missingSource, outsideVideo, duplicate]) expect(TranscriptSchema.safeParse(value).success).toBe(false);
});
