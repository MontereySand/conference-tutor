import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import { z } from "zod";
import { ChunkSchema, TranscriptSchema } from "../lib/data-schema.ts";
import type { Sentence, Transcript, WordTiming } from "../lib/types.ts";

const output = resolve("../evidence/processed-media/alignment");
const data = resolve("../app/data");
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const Asr = z.object({ duration: z.number().positive(), words: z.array(z.object({ word: z.string(), start: z.number().nonnegative(), end: z.number().nonnegative() })).min(1) });
type AsrWord = z.infer<typeof Asr>["words"][number];
type Token = { key: string; from: number; to: number };
const tokenize = (text: string): Token[] => Array.from(text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu), (m) => ({ key: m[0].toLowerCase().replaceAll("’", "'"), from: m.index, to: m.index + m[0].length }));

// Boundaries are accepted only when every caption token maps to consecutive, valid ASR words.
export function alignSentence(text: string, tokens: Token[], matched: (AsrWord | undefined)[], durationMs: number): WordTiming[] | undefined {
  if (!tokens.length || tokens.length !== matched.length || matched.some((word) => !word)) return undefined;
  const words: WordTiming[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const word = matched[i]!;
    const startMs = Math.round(word.start * 1000), endMs = Math.round(word.end * 1000);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs > durationMs || endMs <= startMs || (i && startMs < words[i - 1]!.endMs)) return undefined;
    words.push({ text: text.slice(i ? tokens[i]!.from : 0, tokens[i + 1]?.from ?? text.length), startMs, endMs });
  }
  return words;
}

async function transcribe() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const audio = resolve(output, "audio.mp3");
  if (statSync(audio).size <= 0 || statSync(audio).size >= 25_000_000) throw new Error("Audio outside supported upload size");
  const file = resolve(output, "asr.json");
  if (existsSync(file)) throw new Error("ASR output already exists; preserve it rather than repeat the paid request");
  const client = new OpenAI({ maxRetries: 0, timeout: 600_000 });
  const result = await client.audio.transcriptions.create({ file: createReadStream(audio), model: "whisper-1", language: "en", response_format: "verbose_json", timestamp_granularities: ["word", "segment"] });
  Asr.parse(result);
  save("asr.json", result);
  console.log("Private timestamped ASR saved.");
}

function align() {
  const en = TranscriptSchema.parse(json(resolve(data, "transcripts/omnigent.en.json")));
  const es = TranscriptSchema.parse(json(resolve(data, "transcripts/omnigent.es.json")));
  const chunks = z.array(ChunkSchema.passthrough()).parse(json(resolve(data, "index/chunks.json")));
  const asr = Asr.parse(json(resolve(output, "asr.json")));
  if (Math.abs(asr.duration * 1000 - en.durationMs) > 2000) throw new Error("ASR duration differs from source transcript");
  if (en.sentences.length !== es.sentences.length || en.sentences.some((s, i) => s.id !== es.sentences[i]!.id)) throw new Error("Language sentence parity mismatch");
  if (en.sentences.some((s) => s.timing === "reviewed") || es.sentences.some((s) => s.timing === "reviewed")) throw new Error("Reviewed transcript requires manual reconciliation");
  const captions = en.sentences.map((s) => tokenize(s.text));
  const flat = captions.flat();
  const audioWords = asr.words.map((word, index) => ({ word, index, tokens: tokenize(word.word) })).filter(({ tokens }) => tokens.length === 1);
  const n = flat.length, m = audioWords.length;
  if (!n || !m || (n + 1) * (m + 1) > 100_000_000) throw new Error("Alignment matrix outside supported bounds");
  const directions = new Uint8Array((n + 1) * (m + 1));
  let prev = new Uint32Array(m + 1), curr = new Uint32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const index = i * (m + 1) + j;
      if (flat[i - 1]!.key === audioWords[j - 1]!.tokens[0]!.key) { curr[j] = prev[j - 1]! + 1; directions[index] = 1; }
      else if (prev[j]! >= curr[j - 1]!) { curr[j] = prev[j]!; directions[index] = 2; }
      else { curr[j] = curr[j - 1]!; directions[index] = 3; }
    }
    [prev, curr] = [curr, prev]; curr.fill(0);
  }
  const matched: (number | undefined)[] = new Array(n);
  for (let i = n, j = m; i && j;) {
    const d = directions[i * (m + 1) + j];
    if (d === 1) { matched[--i] = --j; } else if (d === 2) i--; else j--;
  }
  let offset = 0;
  const candidates = en.sentences.map((sentence, index) => {
    const tokens = captions[index]!;
    const indexes = matched.slice(offset, offset + tokens.length); offset += tokens.length;
    const present = indexes.filter((v): v is number => v !== undefined);
    if (tokens.length < 3 || indexes[0] === undefined || indexes.at(-1) === undefined || present.length / tokens.length < 0.8) return undefined;
    const first = audioWords[present[0]!]!, last = audioWords[present.at(-1)!]!;
    if (present.length / (last.index - first.index + 1) < 0.8) return undefined;
    const startMs = Math.round(first.word.start * 1000), endMs = Math.round(last.word.end * 1000);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs > en.durationMs || endMs <= startMs || Math.abs(startMs - sentence.startMs) > 30_000) return undefined;
    const complete = present.length === tokens.length && present.every((v, i) => !i || audioWords[v]!.index === audioWords[present[i - 1]!]!.index + 1);
    const words = complete ? alignSentence(sentence.text, tokens, present.map((i) => audioWords[i]!.word), en.durationMs) : undefined;
    return { startMs, endMs, words };
  });
  // Uncertain captions retain their original derived intervals; conflicting proposals are discarded.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < en.sentences.length; i++) {
      const left = candidates[i - 1] ?? en.sentences[i - 1]!;
      const right = candidates[i] ?? en.sentences[i]!;
      if (left.endMs <= right.startMs) continue;
      if (candidates[i - 1] && !candidates[i]) candidates[i - 1] = undefined;
      else if (candidates[i]) candidates[i] = undefined;
      else throw new Error("Original transcript intervals overlap");
      changed = true;
    }
  }
  const update = (t: Transcript): Transcript => ({ ...t, reviewed: false, sentences: t.sentences.map((s, i): Sentence => {
    const original = { ...s };
    delete original.words;
    const match = candidates[i];
    if (!match) return original;
    return { ...original, startMs: match.startMs, endMs: match.endMs, timing: "derived", ...(t.lang === "en" && match.words ? { words: match.words } : {}) };
  }) });
  const alignedEn = TranscriptSchema.parse(update(en));
  const alignedEs = TranscriptSchema.parse(update(es));
  const byId = new Map(alignedEn.sentences.map((s) => [s.id, s]));
  for (const chunk of chunks) if (chunk.kind === "talk") {
    const ids = chunk.sentenceIds ?? [];
    const first = byId.get(ids[0]!), last = byId.get(ids.at(-1)!);
    if (!first || !last || ids.some((id) => !byId.has(id))) throw new Error("Chunk references unknown sentences");
    chunk.startMs = first.startMs; chunk.endMs = last.endMs;
  }
  for (const [i, s] of alignedEn.sentences.entries()) {
    if (s.id !== en.sentences[i]!.id || s.text !== en.sentences[i]!.text || alignedEs.sentences[i]!.id !== s.id || alignedEs.sentences[i]!.text !== es.sentences[i]!.text || alignedEs.sentences[i]!.startMs !== s.startMs || alignedEs.sentences[i]!.endMs !== s.endMs) throw new Error("Staged sentence identity or parity mismatch");
  }
  const drift = candidates.flatMap((c, i) => c ? [c.startMs - en.sentences[i]!.startMs] : []).sort((a, b) => a - b);
  const uncertain = en.sentences.flatMap((s, i) => candidates[i] ? [] : [{ id: s.id, startMs: s.startMs, endMs: s.endMs }]);
  const noWordTiming = alignedEn.sentences.flatMap((s, i) => candidates[i] && !s.words ? [{ id: s.id, startMs: s.startMs, endMs: s.endMs }] : []);
  save("omnigent.en.json", alignedEn); save("omnigent.es.json", alignedEs); save("chunks.json", chunks);
  save("manifest.json", { sourceDurationMs: en.durationMs, asrDurationSeconds: asr.duration, audioBytes: statSync(resolve(output, "audio.mp3")).size, model: "whisper-1", sentenceCount: en.sentences.length, chunkCount: chunks.length, audioWordCount: asr.words.length, alignedSentences: drift.length, wordAlignedSentences: alignedEn.sentences.filter((s) => s.words).length, retainedDerivedSentences: uncertain.length, driftMs: drift.length ? { min: drift[0], median: drift[Math.floor(drift.length / 2)], max: drift.at(-1) } : null, uncertain, noWordTiming, reviewed: false, spanishWordTimings: false });
  console.log(`Aligned ${drift.length}/${en.sentences.length} sentences; private staged outputs and manifest saved.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  mkdirSync(output, { recursive: true, mode: 0o700 });
  const action = process.argv[2];
  Promise.resolve().then(() => action === "transcribe" ? transcribe() : action === "align" ? align() : Promise.reject(new Error("Expected transcribe or align"))).catch((error: unknown) => {
    console.error(`Alignment stopped: ${error instanceof Error ? error.name : "Error"}. No automatic retry.`); process.exitCode = 1;
  });
}
