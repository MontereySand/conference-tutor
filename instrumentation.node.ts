import type { Attributes, SpanContext } from "@opentelemetry/api";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace";
import type { LogRecordExporter, ReadableLogRecord } from "@opentelemetry/sdk-logs";

const numericKeys: Record<string, true> = {
  duration_ms: true, "ct.duration_ms": true, "ct.cost_usd": true,
  "ct.input_tokens": true, "ct.output_tokens": true,
  "http.status_code": true, "http.response.status_code": true,
};
const enumValues: Record<string, readonly string[]> = {
  lang: ["en", "es", "und"],
  locale: ["en", "es", "und"],
  stage: ["validate", "retrieve", "generate", "decide"],
  kind: ["intent", "practice", "library", "lesson", "decision", "transcription", "narration", "translation"],
  mode: ["keyword", "semantic", "hybrid", "rerank"],
  outcome: ["answered", "abstained", "failed", "aborted"],
  "ct.profile_mode": ["general", "profile"],
  "ct.requested_tier": ["fast", "default", "auto", "flex", "priority"],
  "ct.served_tier": ["fast", "default", "auto", "flex", "priority", "unknown"],
  "ct.intent": ["new_question", "analogy_unhelpful", "simpler", "deeper", "disagreement"],
  "http.method": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"],
  "http.request.method": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"],
};
const routes: Record<string, true> = {
  "/": true, "/login": true, "/watch/[sourceId]": true,
  "/api/ask": true, "/api/check": true, "/api/search": true, "/api/access": true,
  "/api/health": true, "/api/rum-config": true, "/api/dev/timing": true,
};
const stages: Record<string, true> = { "ct.retrieve": true, "ct.generate": true, "ct.decide": true };

// Drop URL/target attributes entirely: even a query-free path can identify private inputs.
export function telemetryAttributes(input: Attributes): Attributes {
  const output: Attributes = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.hasOwn(numericKeys, key) && typeof value === "number" && Number.isFinite(value) && value >= 0) output[key] = value;
    else if (key === "ct.citation_valid" && typeof value === "boolean") output[key] = value;
    else if (typeof value === "string") {
      if (Object.hasOwn(enumValues, key) && enumValues[key].includes(value)) output[key] = value;
      else if ((key === "http.route" || key === "next.route") && Object.hasOwn(routes, value)) output[key] = value;
      else if (key === "model" && /^gpt-[a-z0-9.-]{1,60}$/.test(value)) output[key] = value;
      else if (key === "error.type" && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)) output[key] = value;
      else if (["ct.request_id", "request.id", "requestId"].includes(key) && /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) output[key] = value;
    }
  }
  return output;
}

function traceContext(value: SpanContext): SpanContext {
  return { traceId: value.traceId, spanId: value.spanId, traceFlags: value.traceFlags };
}

export function telemetrySpan(span: ReadableSpan): ReadableSpan {
  const attributes = telemetryAttributes(span.attributes);
  const route = attributes["http.route"] ?? attributes["next.route"];
  const method = attributes["http.request.method"] ?? attributes["http.method"];
  return {
    name: Object.hasOwn(stages, span.name) ? span.name : route ? `${method ?? "HTTP"} ${route}` : "http.request",
    attributes,
    kind: span.kind,
    spanContext: () => traceContext(span.spanContext()),
    parentSpanContext: span.parentSpanContext ? traceContext(span.parentSpanContext) : undefined,
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    ended: span.ended,
    status: { code: span.status.code },
    // Exception messages, stacks, link attributes and framework span names can contain input.
    events: [],
    links: [],
    resource: span.resource,
    instrumentationScope: { name: span.instrumentationScope.name, version: span.instrumentationScope.version },
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}

export function telemetryLog(record: ReadableLogRecord): ReadableLogRecord {
  const eventName = record.eventName === "ct.stage.failed" ? "ct.stage.failed" : "ct.lesson.completed";
  return {
    hrTime: record.hrTime,
    hrTimeObserved: record.hrTimeObserved,
    spanContext: record.spanContext ? traceContext(record.spanContext) : undefined,
    severityNumber: record.severityNumber,
    eventName,
    body: eventName,
    attributes: telemetryAttributes(record.attributes),
    resource: record.resource,
    instrumentationScope: { name: "conference-tutor" },
    droppedAttributesCount: record.droppedAttributesCount,
  };
}

export async function initializeTelemetry() {
  try {
    const url = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT!);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("Invalid endpoint");
  } catch { console.warn("Telemetry disabled: invalid OTLP endpoint"); return; }
  process.env.OTEL_LOG_LEVEL = "none";
  process.env.OTEL_PROPAGATORS = "tracecontext";
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf";
  process.env.OTEL_METRICS_EXPORTER = "otlp";
  process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = "http,undici";
  const [
    { NodeSDK }, { getNodeAutoInstrumentations }, { BatchSpanProcessor },
    { BatchLogRecordProcessor }, { OTLPTraceExporter }, { OTLPLogExporter },
    { resourceFromAttributes },
  ] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/auto-instrumentations-node"),
    import("@opentelemetry/sdk-trace"),
    import("@opentelemetry/sdk-logs"),
    import("@opentelemetry/exporter-trace-otlp-proto"),
    import("@opentelemetry/exporter-logs-otlp-proto"),
    import("@opentelemetry/resources"),
  ]);
  const traceExporter = new OTLPTraceExporter();
  const logExporter = new OTLPLogExporter();
  const filteredTraces: SpanExporter = {
    export: (spans, callback) => traceExporter.export(spans.map(telemetrySpan), callback),
    shutdown: () => traceExporter.shutdown(),
    forceFlush: () => traceExporter.forceFlush(),
  };
  const filteredLogs: LogRecordExporter = {
    export: (records, callback) => logExporter.export(records.filter((record) =>
      record.instrumentationScope.name === "conference-tutor" &&
      (record.eventName === "ct.stage.failed" || record.eventName === "ct.lesson.completed")
    ).map(telemetryLog), callback),
    shutdown: () => logExporter.shutdown(),
    forceFlush: () => logExporter.forceFlush(),
  };
  const sdk = new NodeSDK({
    autoDetectResources: false,
    resource: resourceFromAttributes({ "service.name": "conference-tutor" }),
    instrumentations: getNodeAutoInstrumentations(),
    spanProcessors: [new BatchSpanProcessor({ exporter: filteredTraces })],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: filteredLogs })],
    views: [{ instrumentName: "*", attributesProcessors: [{ process: telemetryAttributes }] }],
  });
  sdk.start();
  const shutdown = () => { void sdk.shutdown().catch(() => console.warn("Telemetry shutdown failed")); };
  process.once("SIGTERM", shutdown);
  process.once("beforeExit", shutdown);
}
