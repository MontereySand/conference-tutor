import "server-only";
import { context, logs, metrics, SeverityNumber, SpanStatusCode, trace, type Span } from "@opentelemetry/api";

type Metadata = Record<string, string | number | boolean>;
const tracer = trace.getTracer("conference-tutor");
const logger = logs.getLogger("conference-tutor");
const meter = metrics.getMeter("conference-tutor");
const duration = meter.createHistogram("ct.stage.duration_ms", { unit: "ms" });
const cost = meter.createCounter("ct.cost.usd", { unit: "USD" });
const lessons = meter.createCounter("ct.lessons");

// Callers pass metadata only, never question, answer, transcript, profile facts or exception messages.
export async function withSpan<T>(name: string, attrs: Metadata, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
    const started = performance.now();
    const stage = name.replace(/^ct\./, "");
    try {
      return await fn(span);
    } catch (error) {
      const errorType = error instanceof Error ? error.constructor.name : "UnknownError";
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute("error.type", errorType);
      logger.emit({
        eventName: "ct.stage.failed",
        body: "ct.stage.failed",
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        context: context.active(),
        attributes: { stage, "error.type": errorType, "ct.request_id": attrs["ct.request_id"] ?? attrs.requestId ?? span.spanContext().traceId },
      });
      throw error;
    } finally {
      const ms = performance.now() - started;
      span.setAttribute("duration_ms", ms);
      duration.record(ms, { stage, lang: attrs.lang ?? attrs.locale ?? "und" });
      span.end();
    }
  });
}

export function recordCost(kind: string, costUsd: number): void {
  if (Number.isFinite(costUsd) && costUsd >= 0) cost.add(costUsd, { kind });
}

export function recordLesson(outcome: "answered" | "abstained" | "failed" | "aborted", attrs: Metadata): void {
  lessons.add(1, { outcome });
  logger.emit({
    eventName: "ct.lesson.completed",
    body: "ct.lesson.completed",
    severityNumber: outcome === "failed" ? SeverityNumber.ERROR : SeverityNumber.INFO,
    severityText: outcome === "failed" ? "ERROR" : "INFO",
    context: context.active(),
    attributes: { ...attrs, outcome },
  });
}
