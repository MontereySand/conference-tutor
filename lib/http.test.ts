import { expect, test } from "vitest";
import { z } from "zod";
import { requireSameOrigin, parseJson, HttpError } from "./http";
test("foreign and absent origins fail before request handling", () => {
  for (const origin of [undefined, "https://foreign.example"]) {
    const request = new Request("http://localhost:3000/api/ask", { method: "POST", headers: origin ? { origin } : {} });
    try { requireSameOrigin(request); throw new Error("accepted"); } catch (error) { expect(error).toBeInstanceOf(HttpError); expect((error as HttpError).status).toBe(403); }
  }
  requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { origin: "http://localhost:3000" } }));
});
test("uses the actual Host when Next normalizes a loopback URL to localhost", () => {
  requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }));
  expect(() => requireSameOrigin(new Request("http://localhost:3000/api/ask", { headers: { host: "127.0.0.1:3000", origin: "https://foreign.example" } }))).toThrow(HttpError);
});
test("actual streamed bytes are bounded even without a content length", async () => {
  const request = new Request("http://localhost:3000/api/ask", { method: "POST", body: JSON.stringify({ question: "x".repeat(40) }) });
  await expect(parseJson(request, z.object({ question: z.string() }), 20)).rejects.toMatchObject({ status: 413 });
});
