import Groq from "groq-sdk";
import type {
  CompletionOptions,
  CompletionResult,
  Message,
  ToolUse,
  ProviderCapabilities,
} from "./types.js";

export function normalizeGroqModel(model: string): string {
  return model;
}

export type GroqModelCapabilities = {
  chatCompletions: boolean;
  toolCalling: boolean;
  category: "coding" | "chat" | "audio" | "classification";
};

const GROQ_CAPABILITIES: Record<string, GroqModelCapabilities> = {
  "openai/gpt-oss-120b": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "openai/gpt-oss-20b": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "qwen/qwen3.6-27b": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "qwen/qwen3.8-27b": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "openai/gpt-oss-safeguard-20b": {
    chatCompletions: true,
    toolCalling: true,
    category: "classification",
  },
  "groq/compound": {
    chatCompletions: true,
    toolCalling: false,
    category: "chat",
  },
  "groq/compound-mini": {
    chatCompletions: true,
    toolCalling: false,
    category: "chat",
  },
  "llama-3.3-70b-versatile": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "llama-3.1-8b-instant": {
    chatCompletions: true,
    toolCalling: true,
    category: "coding",
  },
  "whisper-large-v3": {
    chatCompletions: false,
    toolCalling: false,
    category: "audio",
  },
  "whisper-large-v3-turbo": {
    chatCompletions: false,
    toolCalling: false,
    category: "audio",
  },
  "canopylabs/orpheus-arabic-saudi": {
    chatCompletions: false,
    toolCalling: false,
    category: "audio",
  },
  "canopylabs/orpheus-v1-english": {
    chatCompletions: false,
    toolCalling: false,
    category: "audio",
  },
  "meta-llama/llama-prompt-guard-2-22m": {
    chatCompletions: false,
    toolCalling: false,
    category: "classification",
  },
  "meta-llama/llama-prompt-guard-2-86m": {
    chatCompletions: false,
    toolCalling: false,
    category: "classification",
  },
};

export function getGroqModelCapabilities(model: string): GroqModelCapabilities {
  return (
    GROQ_CAPABILITIES[model] ?? {
      chatCompletions: true,
      toolCalling: true,
      category: "coding",
    }
  );
}

function formatGroqError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;

  if (
    status === 429 ||
    /ratelimit|rate limit|tokens per minute/i.test(message)
  ) {
    const wrapped = new Error(
      "Groq rate limit reached (8K tokens/minute on this plan).",
    );
    (wrapped as any).isRateLimit = true;
    return wrapped;
  }
  if (/organization level|blocked at the organization/i.test(message)) {
    return new Error(
      "Groq rejected this model because its underlying model is blocked for your organization.",
    );
  }
  if (
    /tool_use_failed|not in request.tools|tool call validation/i.test(message)
  ) {
    return new Error("Model attempted to call an unknown tool.");
  }
  return error instanceof Error ? error : new Error(message);
}

export class GroqProvider {
  readonly name = "groq";
  private readonly client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  capabilities(model: string): ProviderCapabilities {
    const caps = getGroqModelCapabilities(model);
    return {
      supportsTools: caps.toolCalling,
      contextWindow: 128_000,
      maxOutput: caps.category === "coding" ? 8000 : 4000,
      rateLimits: { rpm: 30, tpm: 8000 },
    };
  }

  isRateLimitError(error: unknown): boolean {
    return Boolean((error as { isRateLimit?: boolean })?.isRateLimit);
  }

  async *stream(
    messages: Message[],
    options: CompletionOptions,
  ): AsyncGenerator<any> {
    try {
      const caps = getGroqModelCapabilities(options.model);
      if (!caps.chatCompletions) {
        throw new Error(
          `Model ${options.model} does not support chat completions.`,
        );
      }

      const request: any = {
        model: normalizeGroqModel(options.model),
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: true,
      };

      if (caps.toolCalling && options.tools?.length) {
        request.tools = options.tools;
        request.tool_choice = "auto";
      }

      const stream = (await this.client.chat.completions.create(
        request,
      )) as unknown as AsyncIterable<any>;

      for await (const chunk of stream) yield chunk;
    } catch (error) {
      throw formatGroqError(error);
    }
  }

  async complete(
    messages: Message[],
    options: CompletionOptions,
  ): Promise<CompletionResult> {
    try {
      const caps = getGroqModelCapabilities(options.model);
      if (!caps.chatCompletions) {
        throw new Error(
          `Model ${options.model} does not support chat completions.`,
        );
      }

      const request: any = {
        model: normalizeGroqModel(options.model),
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false,
      };

      if (caps.toolCalling && options.tools?.length) {
        request.tools = options.tools;
        request.tool_choice = "auto";
      }

      const response = await this.client.chat.completions.create(request);

      return {
        message: {
          role: "assistant",
          content: response.choices[0]?.message?.content || "",
          tool_calls: response.choices[0]?.message?.tool_calls?.map((call) => ({
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
    } catch (error) {
      throw formatGroqError(error);
    }
  }
}
