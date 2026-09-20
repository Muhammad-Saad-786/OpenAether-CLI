import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import { MistralProvider } from "./mistral.js";
import type { Config } from "../config.js";
import type { ChatProvider } from "./types.js";

export type Provider = OpenRouterProvider | GroqProvider | MistralProvider;

export type { ChatProvider } from "./types.js";

export function createProvider(config: Config): Provider {
  if (config.provider === "groq" && config.groqApiKey) {
    return new GroqProvider(config.groqApiKey);
  }
  if (config.provider === "mistral" && config.mistralApiKey) {
    return new MistralProvider(config.mistralApiKey);
  }
  return new OpenRouterProvider(config);
}

export function createGroqProvider(apiKey: string): GroqProvider {
  return new GroqProvider(apiKey);
}

export function createMistralProvider(apiKey: string): MistralProvider {
  return new MistralProvider(apiKey);
}

export function asChatProvider(provider: Provider): ChatProvider {
  return provider as unknown as ChatProvider;
}
