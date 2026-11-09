import { expect, test } from "vitest";
import { validateLesson } from "./validate";
import type { Lesson } from "./schema";
import type { Chunk, ProfileCard } from "../types";
const evidence: Chunk[] = [{ chunkId: "t1", sourceId: "talk-a", kind: "talk", title: "Invented switch example", url: "https://www.youtube.com/watch?v=abcdefghijk", text: "An invented switch closes the circuit." }, { chunkId: "r1", sourceId: "ref-a", kind: "reference", title: "Invented reference", url: "https://www.databricks.com/blog/example", text: "An invented reference." }, { chunkId: "other", sourceId: "talk-b", kind: "talk", title: "Other source", url: "https://www.youtube.com/watch?v=lmnopqrstuv", text: "Unrelated invented material." }];
const base: Lesson = { answer: "The switch closes the circuit.", cites: ["t1"], steps: [], bridge: null, referenceNotes: [], boundary: null, prediction: null };
const options = { depth: "standard", noAnalogy: false } as const;
function validate(lesson: Lesson, card: ProfileCard | null = null) { return validateLesson(lesson, evidence, ["talk-a", "ref-a"], card, options, "en").lesson; }
test("invalid direct support suppresses the answer instead of leaving uncited text", () => {
  const result = validate({ ...base, cites: ["t1", "invented-id"] });
  expect(result.answer).toBe(""); expect(result.cites).toEqual([]); expect(result.boundary?.reason).toContain("support");
});
test("cross-source steps and invalid reference notes and predictions are removed", () => {
  const result = validate({ ...base, steps: [{ text: "Wrong source", cites: ["other"] }], referenceNotes: [{ refChunkId: "t1", text: "Not a reference" }], prediction: { prompt: "What changes?", expected: "Invented", cites: ["other"] } });
  expect(result.answer).toBe(base.answer); expect(result.steps).toEqual([]); expect(result.referenceNotes).toEqual([]); expect(result.prediction).toBeNull();
});
test("reference evidence remains separately attributed and cannot support talk claims or predictions", () => {
  const note = { refChunkId: "r1", text: "The invented reference adds context." };
  const result = validate({ ...base, cites: ["r1"], steps: [{ text: "Reference-only claim", cites: ["r1"] }], referenceNotes: [note], prediction: { prompt: "What changes?", expected: "Invented", cites: ["r1"] } });
  expect(result.answer).toBe(""); expect(result.steps).toEqual([]); expect(result.prediction).toBeNull();
  expect(result.referenceNotes).toEqual([note]); expect(result.boundary).not.toBeNull();
});
test("General and missing anchors cannot produce a profile bridge", () => {
  const lesson = { ...base, bridge: { anchorId: "missing", text: "A bridge", limit: "A limit" } };
  expect(validate(lesson).bridge).toBeNull();
  expect(validate(lesson, { id: "invented", name: "Invented", role: "Invented", anchors: [{ id: "known", text: "Invented anchor", source: "Public web", tags: ["example"] }] }).bridge).toBeNull();
});
test("an honest source boundary remains usable without inventing an answer", () => {
  const boundary = { reason: "The invented source does not report a percentage.", nearbyQuestion: "What does the switch do?" };
  const result = validate({ ...base, answer: "", cites: [], boundary });
  expect(result.answer).toBe(""); expect(result.boundary).toEqual(boundary);
});
