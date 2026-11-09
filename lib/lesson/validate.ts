import type { Chunk, Corrections, Lang, ProfileCard } from "../types";
import type { Lesson } from "./schema";
const reasons: Record<Lang, string> = {
  en: "This response did not have valid support from the selected sources.",
  es: "Esta respuesta no tenía respaldo válido en las fuentes seleccionadas.",
};
export function validateLesson(value: Lesson, evidence: Chunk[], sourceIds: string[], card: ProfileCard | null, corrections: Corrections, lang: Lang): { lesson: Lesson; validCitations: boolean } {
  const allowed = new Map(evidence.filter((chunk) => sourceIds.includes(chunk.sourceId)).map((chunk) => [chunk.chunkId, chunk]));
  const supported = (ids: string[]) => ids.length > 0 && ids.every((id) => {
    const chunk = allowed.get(id);
    return chunk?.kind === "talk" && chunk.sourceId === sourceIds[0];
  });
  const answerValid = supported(value.cites);
  const steps = value.steps.filter((step) => supported(step.cites));
  const referenceNotes = value.referenceNotes.filter((note) => allowed.get(note.refChunkId)?.kind === "reference");
  const predictionSupported = !value.prediction || supported(value.prediction.cites);
  const prediction = value.prediction?.prompt.trim() && value.prediction.expected.trim() && predictionSupported ? value.prediction : null;
  const bridge = answerValid && !corrections.noAnalogy && card?.anchors.some((anchor) => anchor.id === value.bridge?.anchorId) ? value.bridge : null;
  const honestBoundary = !value.answer.trim() && value.cites.length === 0 && value.boundary;
  return {
    lesson: { ...value, answer: answerValid ? value.answer : "", cites: answerValid ? [...new Set(value.cites)] : [], steps: answerValid ? steps : [], bridge, referenceNotes, prediction: answerValid ? prediction : null, boundary: answerValid || honestBoundary ? value.boundary : { reason: reasons[lang], nearbyQuestion: "" } },
    validCitations: (answerValid || Boolean(honestBoundary)) && steps.length === value.steps.length && referenceNotes.length === value.referenceNotes.length && predictionSupported,
  };
}
