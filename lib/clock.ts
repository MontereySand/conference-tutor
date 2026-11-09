import type { Sentence } from "./types";
export function activeSentenceAt(sentences: Sentence[], ms: number): number {
  if (!Number.isFinite(ms)) return -1;
  let low = 0, high = sentences.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const sentence = sentences[mid]!;
    if (ms < sentence.startMs) high = mid - 1;
    else if (ms >= sentence.endMs) low = mid + 1;
    else return mid;
  }
  return -1;
}
