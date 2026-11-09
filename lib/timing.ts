import { TranscriptSchema } from "./data-schema";
import type { Transcript } from "./types";

export function applyTimingReview(transcript: Transcript, starts: Record<string, number>): Transcript {
  const reviewed = structuredClone(transcript);
  const sentences = new Map(reviewed.sentences.map(sentence => [sentence.id, sentence]));
  for (const [id, startMs] of Object.entries(starts)) {
    const sentence = sentences.get(id);
    if (!sentence || !Number.isInteger(startMs) || startMs < 0 || startMs >= reviewed.durationMs) {
      throw new RangeError("Invalid timing review mark");
    }
    sentence.startMs = startMs;
    sentence.timing = "reviewed";
  }
  for (const [index, sentence] of reviewed.sentences.entries()) {
    const previous = reviewed.sentences[index - 1];
    if (previous && sentence.startMs <= previous.startMs) throw new RangeError("Invalid timing review order");
  }
  for (const [index, sentence] of reviewed.sentences.entries()) {
    if (!Object.hasOwn(starts, sentence.id)) continue;
    if (index > 0) reviewed.sentences[index - 1]!.endMs = sentence.startMs;
    // A later mark can outgrow its derived interval; otherwise retain the gap.
    if (sentence.endMs <= sentence.startMs) {
      sentence.endMs = reviewed.sentences[index + 1]?.startMs ?? reviewed.durationMs;
    }
  }
  for (const [index, sentence] of reviewed.sentences.entries()) {
    const original = transcript.sentences[index]!;
    if ((sentence.startMs !== original.startMs || sentence.endMs !== original.endMs) &&
        sentence.words?.some(word => word.startMs < sentence.startMs || word.endMs > sentence.endMs)) {
      // A corrected cue can invalidate machine alignment; never move words to invent precision.
      delete sentence.words;
    }
  }
  reviewed.reviewed = reviewed.sentences.every(sentence => sentence.timing === "reviewed");
  return TranscriptSchema.parse(reviewed);
}
