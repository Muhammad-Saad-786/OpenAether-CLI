import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import type { Config } from "../config.js";

export type Provider = OpenRouterProvider | GroqProvider;

export function createProvider(config: Config): Provider {
  if (config.provider === "groq" && config.groqApiKey) {
    return new GroqProvider(config.groqApiKey);
  }
  return new OpenRouterProvider(config);
}

export function createGroqProvider(apiKey: string): GroqProvider {
  return new GroqProvider(apiKey);
}
