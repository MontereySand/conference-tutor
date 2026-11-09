import type { Lang } from "@/lib/types";
import { en, type Messages } from "./en";
import { hi } from "./hi";
import { es } from "./es";
import { zh } from "./zh";
export const languages: Record<Lang, string> = { en: "English", hi: "हिन्दी", es: "Español", zh: "简体中文" };
export const htmlLang: Record<Lang, string> = { en: "en", hi: "hi", es: "es-419", zh: "zh-Hans" };
const dictionaries: Record<Lang, Messages> = { en, hi, es, zh };
export function parseLang(value: unknown): Lang { return value === "hi" || value === "es" || value === "zh" ? value : "en"; }
export function t(lang: Lang): Messages { return dictionaries[lang]; }
export function timestamp(ms: number): string { const seconds = Math.floor(Math.max(0, ms) / 1000); return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0"); }
