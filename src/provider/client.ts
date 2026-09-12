import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import type { Config } from "../config.js";
import type { ChatProvider } from "./types.js";

export type Provider = OpenRouterProvider | GroqProvider;

export type { ChatProvider } from "./types.js";

export function createProvider(config: Config): Provider {
  if (config.provider === "groq" && config.groqApiKey) {
    return new GroqProvider(config.groqApiKey);
  }
  return new OpenRouterProvider(config);
}

export function createGroqProvider(apiKey: string): GroqProvider {
  return new GroqProvider(apiKey);
}

/**
 * Cast a provider to the ChatProvider interface used by AgentLoop.
 * Both GroqProvider and OpenRouterProvider satisfy this shape at runtime;
 * this helper documents that fact in one place.
 */
export function asChatProvider(provider: Provider): ChatProvider {
  return provider as unknown as ChatProvider;
}
