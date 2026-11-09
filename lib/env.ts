import { z } from "zod";
const httpsUrl = z.string().url().refine((value) => { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; });
const Schema = z.object({
  OPENAI_API_KEY: z.string().min(1), ELASTICSEARCH_URL: httpsUrl, ELASTICSEARCH_API_KEY: z.string().min(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: httpsUrl.optional(), OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  DASH0_RUM_ENDPOINT: httpsUrl.optional(), DASH0_RUM_TOKEN: z.string().optional(),
  SPEND_CAP_USD: z.coerce.number().finite().nonnegative().default(25),
});
export class ConfigurationError extends Error {
  constructor(keys: string[]) { super("Configuration required: " + [...new Set(keys)].join(", ")); this.name = "ConfigurationError"; }
}
export function serverEnv() {
  const result = Schema.safeParse(Object.fromEntries(Object.entries(process.env).map(([key, value]) => [key, value?.trim() || undefined])));
  if (!result.success) throw new ConfigurationError(result.error.issues.map((issue) => String(issue.path[0])));
  return result.data;
}
export function configured() {
  const has = (key: string) => Boolean(process.env[key]?.trim());
  return { openai: has("OPENAI_API_KEY"), elastic: has("ELASTICSEARCH_URL") && has("ELASTICSEARCH_API_KEY"), dash0: has("OTEL_EXPORTER_OTLP_ENDPOINT") && has("OTEL_EXPORTER_OTLP_HEADERS"), rum: has("DASH0_RUM_ENDPOINT") && has("DASH0_RUM_TOKEN") };
}
