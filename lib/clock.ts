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

export function confirmedPlayerTime(ms: number, seekTargetMs: number | null): number | null {
  if (!Number.isFinite(ms) || ms < 0) return null;
  // A seek is asynchronous; its requested target is never an observed timestamp.
  if (seekTargetMs !== null && Math.abs(ms - seekTargetMs) > 500) return null;
  return ms;
}

export type PlayerPosition = {
  select: (ms: number, live: boolean) => void;
  observe: (ms: number) => void;
  fail: () => void;
  getTimeMs: () => number;
  dispose: () => void;
};
export function createPlayerPosition(initialMs: number, onPending: (pending: boolean) => void, onSettled: (acknowledged: boolean) => void): PlayerPosition {
  let observedMs = initialMs, selectedMs = initialMs, available = false;
  let targetMs: number | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timeout); timeout = undefined; };
  const settle = (acknowledged: boolean) => {
    clear(); targetMs = null; available = acknowledged;
    onPending(false); onSettled(acknowledged);
  };
  return {
    select(ms: number, live: boolean) {
      clear(); selectedMs = ms; targetMs = live ? ms : null; available = false;
      onPending(live);
      if (live) timeout = setTimeout(() => settle(false), 5000);
    },
    observe(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) return;
      observedMs = ms;
      if (!available && confirmedPlayerTime(ms, targetMs ?? selectedMs) !== null) settle(true);
    },
    fail() {
      if (available) selectedMs = observedMs;
      settle(false);
    },
    // Only unavailable video uses the explicitly selected/last-known question moment.
    getTimeMs: () => available || targetMs !== null ? observedMs : selectedMs,
    dispose: clear
  };
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
