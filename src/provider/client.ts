import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import type { Config } from "../config.js";
import type { CompletionOptions, CompletionResult, Message } from "./types.js";

export type Provider = OpenRouterProvider | GroqProvider;

export interface ChatProvider {
  complete(
    messages: Message[],
    options: CompletionOptions,
  ): Promise<CompletionResult>;
  stream(messages: Message[], options: CompletionOptions): AsyncGenerator<any>;
}

export function createProvider(config: Config): Provider {
  if (config.provider === "groq" && config.groqApiKey) {
    return new GroqProvider(config.groqApiKey);
  }
  return new OpenRouterProvider(config);
}

export function createGroqProvider(apiKey: string): GroqProvider {
  return new GroqProvider(apiKey);
}
