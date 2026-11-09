"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import spanish from "@astryxdesign/core/locales/es-ES.generated.js";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

const messages = { "es-ES": spanish };
function subscribeLanguage(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}
function language() { return document.documentElement.lang.startsWith("es") ? "es-ES" : "en"; }
function serverLanguage() { return "en"; }

export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeLanguage, language, serverLanguage);
  return <Theme theme={neutralTheme} mode="light"><InternationalizationProvider locale={locale} messages={messages}><LinkProvider component={Link}>{children}</LinkProvider></InternationalizationProvider></Theme>;
}
