import { expect, test } from "vitest";
import { alignSentence } from "./align-audio.ts";

test("incomplete or overlapping word intervals cannot produce caption timing", () => {
  const tokens = [{ key: "one", from: 0, to: 3 }, { key: "two", from: 4, to: 7 }];
  const first = { word: "one", start: 1, end: 2 };
  expect(alignSentence("one two", tokens, [first, undefined], 5000)).toBeUndefined();
  expect(alignSentence("one two", tokens, [first, { word: "two", start: 1.9, end: 2.5 }], 5000)).toBeUndefined();
  expect(alignSentence("one two", tokens, [first, { word: "two", start: 2, end: 2.5 }], 5000)?.map((word) => word.text).join("")).toBe("one two");
});
