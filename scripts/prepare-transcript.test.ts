import { describe, expect, it } from "vitest";
import { buildChunks, parseTimestamp, parseTranscript } from "./prepare-transcript.ts";

const captions = `Talk header, not speech
00:00 — First chapter
00:10 — Second chapter
First chapter
0:00
First chapter
Um, value 3.14 is useful. Another
0:05
sentence ends here!
Second chapter
0:10
Uh, data bricks makes tools.
0:15
Final caption without punctuation
Second chapter
`;

describe("transcript preparation", () => {
  it("parses minute and hour markers without accepting malformed times", () => {
    expect(parseTimestamp("1:55")).toBe(115000);
    expect(parseTimestamp("01:02:03")).toBe(3723000);
    expect(parseTimestamp("01:60")).toBeNull();
    expect(parseTimestamp("1:5")).toBeNull();
    expect(parseTimestamp("01:55 — Heading")).toBeNull();
  });

  it("skips leading, interleaved and trailing headings, preserving decimals and raw captions", () => {
    const { transcript, fragmentCount } = parseTranscript(captions, { "data bricks": "Databricks" }, 20000);
    expect(fragmentCount).toBe(4);
    expect(transcript.chapters).toHaveLength(2);
    expect(transcript.sentences.map((sentence) => sentence.text)).toEqual([
      "value 3.14 is useful.", "Another sentence ends here!", "Databricks makes tools.", "Final caption without punctuation",
    ]);
    expect(transcript.sentences[0]!.raw).toBe("Um, value 3.14 is useful.");
    expect(transcript.sentences.at(-1)!.endMs).toBe(20000);
  });

  it("derives positive ordered intervals, separates chapters and resolves all chunk ids", () => {
    const { transcript } = parseTranscript(captions, {}, 20000);
    for (const [i, sentence] of transcript.sentences.entries()) {
      expect(sentence.endMs).toBeGreaterThan(sentence.startMs);
      expect(sentence.timing).toBe("derived");
      if (i) expect(sentence.startMs).toBeGreaterThanOrEqual(transcript.sentences[i - 1]!.endMs);
      const nextChapter = transcript.chapters[sentence.chapter + 1];
      if (nextChapter) expect(sentence.endMs).toBeLessThanOrEqual(nextChapter.startMs);
    }
    const ids = new Set(transcript.sentences.map((sentence) => sentence.id));
    const chunks = buildChunks(transcript);
    expect(chunks.map((chunk) => chunk.chunkId)).toEqual(["omnigent-c001", "omnigent-c002"]);
    for (const chunk of chunks) {
      expect(chunk.text.split(/\s+/u).length).toBeLessThanOrEqual(90);
      expect(chunk.sentenceIds!.every((id) => ids.has(id))).toBe(true);
    }
  });

  it("splits long speech only at fragment boundaries and overlaps chunks by one sentence", () => {
    const fragment = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const source = `00:00 — Chapter\n${Array.from({ length: 8 }, (_, i) => `0:${String(i * 5).padStart(2, "0")}\n${fragment}`).join("\n")}`;
    const { transcript } = parseTranscript(source, {}, 40000);
    expect(transcript.sentences).toHaveLength(8);
    expect(transcript.sentences.every((sentence) => sentence.raw === fragment)).toBe(true);
    const chunks = buildChunks(transcript);
    expect(chunks.map((chunk) => chunk.sentenceIds!.length)).toEqual([4, 4, 2]);
    expect(chunks[0]!.sentenceIds!.at(-1)).toBe(chunks[1]!.sentenceIds![0]);
    expect(chunks[1]!.sentenceIds!.at(-1)).toBe(chunks[2]!.sentenceIds![0]);
  });
});
