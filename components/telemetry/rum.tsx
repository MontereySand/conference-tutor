"use client";

import { init } from "@dash0/sdk-web";
import { useEffect } from "react";

let initialization: Promise<void> | undefined;

async function initializeRum() {
  const response = await fetch("/api/rum-config", { cache: "no-store" });
  if (!response.ok) return;
  const config = await response.json();
  if (!config.enabled || typeof config.url !== "string" || typeof config.authToken !== "string") return;
  const endpoint = new URL(config.url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || !config.authToken.trim()) return;
  init({
    serviceName: "conference-tutor",
    endpoint: { url: endpoint.href, authToken: config.authToken, dataset: "default" },
    enabledInstrumentations: ["@dash0/navigation", "@dash0/web-vitals", "@dash0/fetch", "@dash0/xhr"],
    headersToCapture: [],
    wrapEventHandlers: false,
    wrapTimers: false,
    sessionRecording: { samplingRate: 0, maskAllInputs: true, maskTextSelector: "*" },
    pageViewInstrumentation: { generateMetadata: () => ({ title: "Conference tutor" }) },
    urlAttributeScrubber: (attrs) => {
      const url = new URL(attrs["url.full"]);
      url.search = "";
      url.hash = "";
      url.username = "";
      url.password = "";
      return { ...attrs, "url.full": url.href, "url.query": undefined, "url.fragment": undefined };
    },
  });
}

export function Rum() {
  useEffect(() => {
    // Keep SDK initialization single-shot across Strict Mode effects and client navigation.
    initialization ??= initializeRum().catch(() => undefined);
  }, []);
  return null;
}
