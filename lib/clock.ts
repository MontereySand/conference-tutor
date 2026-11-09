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

export function observePlayerClock(readSeconds: () => number, onTime: (ms: number) => void): () => void {
  let lastMs: number | undefined;
  const sample = () => {
    const ms = readSeconds() * 1000;
    if (!Number.isFinite(ms) || ms < 0 || ms === lastMs) return;
    lastMs = ms;
    onTime(ms);
  };
  sample();
  const interval = setInterval(sample, 100);
  return () => clearInterval(interval);
}
