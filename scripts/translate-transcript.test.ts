import { expect, test } from "vitest";
import { validateTranslation } from "./translate-transcript.ts";
test("translation keeps sentence identity and exact source numbers", () => {
  const source = [{ id: "s1", text: "Approval at $100; 2 tools." }, { id: "s2", text: "Use Omnigent." }];
  expect(() => validateTranslation(source, [{ id: "s1", text: "Aprobación a $100; 2 herramientas." }, { id: "s2", text: "Usa Omnigent." }])).not.toThrow();
  expect(() => validateTranslation(source, [{ id: "s1", text: "$1000; 2" }, { id: "s2", text: "Usa Omnigent." }])).toThrow("Number changed");
  expect(() => validateTranslation(source, [{ id: "s1", text: "$100; 2" }, { id: "s1", text: "$100; 2" }])).toThrow("id count");
  expect(() => validateTranslation(source, [{ id: "s1", text: "$100; 2" }, { id: "s2", text: " " }])).toThrow("Missing translation");
});
