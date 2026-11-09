import { describe, expect, it } from "vitest";
import type { ProfileCard } from "@/lib/types";
import { introCards, introWatchUrl } from "./intro";

describe("intro selection", () => {
  it("keeps the supplied order except for placing Aditya last", () => {
    const cards = ["aditya-maramreddy", "first", "second"].map(id => ({ id, name: id, role: "", anchors: [] } satisfies ProfileCard));
    expect(introCards(cards).map(card => card.id)).toEqual(["first", "second", "aditya-maramreddy"]);
    expect(cards[0]?.id).toBe("aditya-maramreddy");
  });
  it("requests autoplay and carries only the selected profile", () => {
    expect(introWatchUrl("talk", "en", null)).toBe("/watch/talk?lang=en&autoplay=1");
    expect(introWatchUrl("talk", "es", "aditya-maramreddy")).toBe("/watch/talk?lang=es&autoplay=1&profile=aditya-maramreddy");
  });
});
