import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Chunk, Sentence, Transcript } from "../lib/types.ts";

export const DURATION_MS = 1_421_526;
export const TALK_TITLE = "Omnigent — Matei Zaharia, Databricks keynote";
export const TALK_URL = "https://www.youtube.com/watch?v=3Xv0VjYhpCk";
type Corrections = Record<string, string>;
type Fragment = { startMs: number; endMs: number; raw: string };
type Part = Fragment & { chapter: number; terminal: boolean };
const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

export function parseTimestamp(marker: string): number | null {
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/u.test(marker)) return null;
  const values = marker.split(":").map(Number);
  if (values.at(-1)! > 59 || (values.length === 3 && values[1]! > 59)) return null;
  return values.reduce((seconds, value) => seconds * 60 + value, 0) * 1000;
}

function cleanText(raw: string, corrections: Corrections): string {
  const replacements = Object.entries(corrections).sort(([a], [b]) => b.length - a.length);
  const byLowercase = new Map(replacements.map(([from, to]) => [from.toLowerCase(), to]));
  let text = raw;
  if (replacements.length) {
    const pattern = replacements.map(([from]) => from.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
    text = text.replace(new RegExp(`\\b(?:${pattern})\\b`, "giu"), (match) => byLowercase.get(match.toLowerCase())!);
  }
  return text.replace(/\b(?:uh|um)\b[,;:]?\s*/giu, "").replace(/\s+([,.?!;:])/gu, "$1").replace(/\s+/gu, " ").trim();
}

function fragmentParts(fragment: Fragment, chapters: Transcript["chapters"]): Part[] {
  const cuts = [{ offset: 0, ms: fragment.startMs }];
  for (const chapter of chapters) {
    if (chapter.startMs <= fragment.startMs || chapter.startMs >= fragment.endMs) continue;
    const target = (chapter.startMs - fragment.startMs) / (fragment.endMs - fragment.startMs) * fragment.raw.length;
    const spaces = [...fragment.raw.matchAll(/\s+/gu)].map((match) => match.index);
    // Keep words whole; the next chapter starts at the first word after its boundary.
    const offset = spaces.find((candidate) => candidate >= target) ?? fragment.raw.length;
    cuts.push({ offset, ms: chapter.startMs });
  }
  cuts.push({ offset: fragment.raw.length, ms: fragment.endMs });
  const parts: Part[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const left = cuts[i]!;
    const right = cuts[i + 1]!;
    const raw = fragment.raw.slice(left.offset, right.offset);
    const chapter = chapters.findLastIndex((item) => item.startMs <= left.ms);
    const boundary = /[.?!](?=\s|$)/gu;
    let offset = 0;
    const emit = (end: number, terminal: boolean) => {
      const slice = raw.slice(offset, end);
      const leading = slice.length - slice.trimStart().length;
      const trailing = slice.trimEnd().length;
      if (slice.trim()) {
        parts.push({
          raw: slice.trim(), chapter, terminal,
          startMs: Math.round(fragment.startMs + (left.offset + offset + leading) / fragment.raw.length * (fragment.endMs - fragment.startMs)),
          endMs: Math.min(right.ms, Math.round(fragment.startMs + (left.offset + offset + trailing) / fragment.raw.length * (fragment.endMs - fragment.startMs))),
        });
      }
      offset = end;
    };
    for (const match of raw.matchAll(boundary)) emit(match.index + 1, true);
    emit(raw.length, false);
  }
  return parts;
}

export function parseTranscript(source: string, corrections: Corrections = {}, durationMs = DURATION_MS): { transcript: Transcript; fragmentCount: number } {
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new Error("Invalid transcript duration");
  const lines = source.split(/\r?\n/u).map((line) => line.trim());
  const chapters: Transcript["chapters"] = [];
  for (const line of lines) {
    const match = /^(\d{2}:\d{2}) — (.+)$/u.exec(line);
    if (!match) continue;
    const startMs = parseTimestamp(match[1]!)!;
    if (startMs === null || startMs >= durationMs || (chapters.length > 0 && startMs <= chapters.at(-1)!.startMs)) {
      throw new Error(`Invalid chapter marker: ${match[1]}`);
    }
    chapters.push({ startMs, title: match[2]!.trim() });
  }
  if (!chapters.length || chapters[0]!.startMs !== 0) throw new Error("Transcript needs a chapter at 00:00");
  const headings = new Set(chapters.map((chapter) => chapter.title));
  const fragments: Fragment[] = [];
  let pending: number | null = null;
  for (const line of lines) {
    if (!line || headings.has(line) || /^\d{2}:\d{2} — /u.test(line)) continue;
    const marker = parseTimestamp(line);
    if (marker !== null) {
      if (pending !== null) throw new Error(`Caption missing after marker ${pending}`);
      if (marker >= durationMs || (fragments.length > 0 && marker <= fragments.at(-1)!.startMs)) throw new Error(`Out-of-order caption marker: ${line}`);
      pending = marker;
    } else if (pending !== null) {
      fragments.push({ startMs: pending, endMs: durationMs, raw: line });
      pending = null;
    } else if (fragments.length) {
      throw new Error("Unmarked caption text after the first fragment");
    }
  }
  if (pending !== null) throw new Error("Final caption marker has no text");
  if (!fragments.length) throw new Error("No caption fragments found");
  for (let i = 0; i < fragments.length - 1; i++) fragments[i]!.endMs = fragments[i + 1]!.startMs;

  const sentences: Sentence[] = [];
  let current: Part[] = [];
  const flush = () => {
    if (!current.length) return;
    const raw = current.map((part) => part.raw).join(" ");
    const text = cleanText(raw, corrections);
    if (!text) throw new Error("Caption cleaning produced an empty sentence");
    const startMs = current[0]!.startMs;
    const endMs = current.at(-1)!.endMs;
    if (endMs <= startMs || (sentences.length && startMs < sentences.at(-1)!.endMs)) throw new Error("Invalid sentence timing");
    sentences.push({ id: `omnigent-s${String(sentences.length + 1).padStart(4, "0")}`, startMs, endMs, raw, text, chapter: current[0]!.chapter, timing: "derived" });
    current = [];
  };
  for (const fragment of fragments) {
    for (const part of fragmentParts(fragment, chapters)) {
      if (current.length && (current[0]!.chapter !== part.chapter || wordCount([...current.map((item) => item.raw), part.raw].join(" ")) > 30)) flush();
      current.push(part);
      if (part.terminal) flush();
    }
  }
  flush();
  const sourceWords = fragments.map((fragment) => fragment.raw).join(" ").split(/\s+/u);
  const sentenceWords = sentences.map((sentence) => sentence.raw).join(" ").split(/\s+/u);
  if (sourceWords.length !== sentenceWords.length || sourceWords.some((word, i) => word !== sentenceWords[i])) throw new Error("Caption coverage changed");
  return { transcript: { sourceId: "omnigent", lang: "en", durationMs, chapters, sentences, machineTranslated: false, reviewed: false }, fragmentCount: fragments.length };
}

export function buildChunks(transcript: Transcript): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < transcript.sentences.length) {
    const first = transcript.sentences[start]!;
    let end = start;
    let words = 0;
    while (end < transcript.sentences.length) {
      const sentence = transcript.sentences[end]!;
      const count = wordCount(sentence.text);
      if (sentence.chapter !== first.chapter || words + count > 90) break;
      words += count;
      end++;
    }
    if (end === start) throw new Error(`Sentence exceeds the 90-word chunk limit: ${first.id}`);
    const sentences = transcript.sentences.slice(start, end);
    chunks.push({ chunkId: `omnigent-c${String(chunks.length + 1).padStart(3, "0")}`, sourceId: transcript.sourceId, kind: "talk", title: TALK_TITLE, url: TALK_URL, chapter: transcript.chapters[first.chapter]!.title, startMs: first.startMs, endMs: sentences.at(-1)!.endMs, sentenceIds: sentences.map((sentence) => sentence.id), text: sentences.map((sentence) => sentence.text).join(" ") });
    if (end === transcript.sentences.length) break;
    // Do not repeat an entire one-sentence chunk or overlap across chapters.
    start = end - start > 1 && transcript.sentences[end]!.chapter === first.chapter ? end - 1 : end;
  }
  return chunks;
}

async function main() {
  const prep = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const corrections: Corrections = JSON.parse(await readFile(resolve(prep, "data/transcripts/corrections.json"), "utf8"));
  const source = await readFile(resolve(prep, "../resources/sources/videos/main/transcript1.txt"), "utf8");
  const { transcript, fragmentCount } = parseTranscript(source, corrections);
  const chunks = buildChunks(transcript);
  for (const [path, data] of [["data/transcripts/omnigent.en.json", transcript], ["data/index/chunks.json", chunks]] as const) {
    const destination = resolve(prep, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(JSON.stringify({ fragments: fragmentCount, sentences: transcript.sentences.length, chunks: chunks.length, chapters: transcript.chapters.length, durationMs: transcript.durationMs, timing: "derived; character-proportional, not audio-reviewed" }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
