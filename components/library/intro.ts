import type { Lang, ProfileCard } from "@/lib/types";

export function introCards(cards: ProfileCard[]): ProfileCard[] {
  return [...cards.filter(card => card.id !== "aditya-maramreddy"), ...cards.filter(card => card.id === "aditya-maramreddy")];
}

export function introWatchUrl(sourceId: string, lang: Lang, profile: string | null): string {
  const params = new URLSearchParams({ lang, autoplay: "1" });
  if (profile) params.set("profile", profile);
  return `/watch/${sourceId}?${params}`;
}
