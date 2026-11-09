import type { Lang } from "@/lib/types";
import { en, type Messages } from "./en";
import { es } from "./es";
export const languages: Record<Lang, string> = { en: "English", es: "Español" };
export const htmlLang: Record<Lang, string> = { en: "en", es: "es-419" };
const dictionaries: Record<Lang, Messages> = { en, es };
export function parseLang(value: unknown): Lang { return value === "es" ? "es" : "en"; }
export function t(lang: Lang): Messages { return dictionaries[lang]; }
export function timestamp(ms: number): string { const seconds = Math.floor(Math.max(0, ms) / 1000); return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"); }
