export async function initializeTelemetry() {
  try {
    const url = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT!);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid endpoint");
  } catch { console.warn("Telemetry disabled: invalid OTLP endpoint"); return; }
  process.env.OTEL_SERVICE_NAME ??= "conference-tutor";
  process.env.OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf";
  process.env.OTEL_TRACES_EXPORTER = "otlp";
  process.env.OTEL_METRICS_EXPORTER = "otlp";
  process.env.OTEL_LOGS_EXPORTER = "otlp";
  process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = "http,undici";
  process.env.OTEL_NODE_RESOURCE_DETECTORS = "env";
  await import("@opentelemetry/auto-instrumentations-node/register");
}
