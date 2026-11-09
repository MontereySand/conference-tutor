import type { Lang, ProfileCard } from "@/lib/types";

export function introCards(cards: ProfileCard[]): ProfileCard[] {
  return [...cards.filter(card => card.id !== "aditya-maramreddy"), ...cards.filter(card => card.id === "aditya-maramreddy")];
}

export function introWatchUrl(sourceId: string, lang: Lang, profile: string): string {
  const params = new URLSearchParams({ lang, autoplay: "1", profile });
  return `/watch/${sourceId}?${params}`;
}
