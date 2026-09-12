import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { Config } from "../config.js";
import type {
  CompletionOptions,
  CompletionResult,
  Message,
  ProviderCapabilities,
  ToolUse,
} from "./types.js";

const KNOWN_MODELS: Record<
  string,
  { contextWindow: number; maxOutput: number; tools: boolean }
> = {
  "nex-agi/nex-n2.5-mini:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "inclusionai/ling-3.0-flash-fin:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "liquid/lfm-2.5-embedding-350m:free": {
    contextWindow: 8000,
    maxOutput: 2000,
    tools: false,
  },
  "dots-studio/dots-3-note-preview:free": {
    contextWindow: 16_000,
    maxOutput: 4000,
    tools: false,
  },
  "nvidia/nemotron-3.5-lightning:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "poolside/laguna-s-2.1:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "thinkingmachines/inkling:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "nvidia/nemotron-3-embed-1b:free": {
    contextWindow: 8000,
    maxOutput: 2000,
    tools: false,
  },
  "cohere/north-mini-code:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "nvidia/nemotron-3-ultra-550b-a55b:free": {
    contextWindow: 128_000,
    maxOutput: 8000,
    tools: true,
  },
  "google/gemma-4-31b-it:free": {
    contextWindow: 32_000,
    maxOutput: 4000,
    tools: true,
  },
  "nvidia/nemotron-3-super-120b-a12b:free": {
    contextWindow: 128_000,
    maxOutput: 8000,
    tools: true,
  },
};

export class OpenRouterProvider {
  readonly name = "openrouter";
  private readonly client: OpenAI;

  constructor(config: Config) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      defaultHeaders: {
        "HTTP-Referer": config.siteUrl,
        "X-Title": config.appName,
      },
    });
  }

  capabilities(model: string): ProviderCapabilities {
    const known = KNOWN_MODELS[model];
    return {
      supportsTools: known?.tools ?? true,
      contextWindow: known?.contextWindow ?? 32_000,
      maxOutput: known?.maxOutput ?? 4000,
      rateLimits: { rpm: 20, tpm: 200_000 },
    };
  }

  isRateLimitError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    return status === 429;
  }

  async complete(
    messages: Message[],
    options: CompletionOptions,
  ): Promise<CompletionResult> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: messages as never,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools as never,
      ...(options.tools?.length ? { tool_choice: "auto" as const } : {}),
      stream: false,
    });
    const choice = response.choices[0];
    return {
      message: {
        role: "assistant",
        content: choice?.message.content ?? null,
        tool_calls: choice?.message.tool_calls?.map((call) => ({
          id: call.id,
          type: "function",
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })) as ToolUse[] | undefined,
      },
      usage: response.usage,
    };
  }

  async *stream(
    messages: Message[],
    options: CompletionOptions,
  ): AsyncGenerator<ChatCompletionChunk> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: messages as never,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools as never,
      ...(options.tools?.length ? { tool_choice: "auto" as const } : {}),
      stream: true,
    });
    for await (const chunk of stream) yield chunk;
  }
}
