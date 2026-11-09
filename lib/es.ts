import "server-only";
import { Client } from "@elastic/elasticsearch";
import { serverEnv } from "./env";
let client: Client | undefined;
export function getElastic(): Client {
  if (!client) { const env = serverEnv(); client = new Client({ node: env.ELASTICSEARCH_URL, auth: { apiKey: env.ELASTICSEARCH_API_KEY }, maxRetries: 0, requestTimeout: 15000 }); }
  return client;
}
