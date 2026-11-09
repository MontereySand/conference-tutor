import "server-only";
import OpenAI from "openai";
import { serverEnv } from "./env";
let client: OpenAI | undefined;
export function getOpenAI(): OpenAI { return client ??= new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY, maxRetries: 0, timeout: 30000 }); }
