import { describe, expect, it } from "vitest";
import type { ProfileCard } from "@/lib/types";
import { introCards } from "./intro";

describe("intro selection", () => {
  it("keeps the supplied order except for placing Aditya last", () => {
    const cards = ["aditya-maramreddy", "first", "second"].map(id => ({ id, name: id, role: "", anchors: [] } satisfies ProfileCard));
    expect(introCards(cards).map(card => card.id)).toEqual(["first", "second", "aditya-maramreddy"]);
    expect(cards[0]?.id).toBe("aditya-maramreddy");
  });
});
