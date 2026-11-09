export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() && process.env.OTEL_EXPORTER_OTLP_HEADERS?.trim()) {
    const { initializeTelemetry } = await import("./instrumentation.node");
    await initializeTelemetry();
  }
}
