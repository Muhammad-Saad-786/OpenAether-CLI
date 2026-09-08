import Groq from "groq-sdk";
import { estimateMessagesTokens, estimateTokens } from "../utils/tokens.js";

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

const GROQ_TPM_LIMIT = 8000;
const GROQ_REQUEST_MARGIN = 128;
const GROQ_MAX_RETRIES = 2;

function retryDelayMs(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const seconds = message.match(/try again in ([\d.]+)s/i)?.[1];
  if (seconds) return Math.ceil(Number(seconds) * 1000) + 250;
  const retryAfter = (error as { headers?: Headers })?.headers?.get?.(
    "retry-after",
  );
  return retryAfter ? Math.ceil(Number(retryAfter) * 1000) + 250 : 2000;
}

function isRetryableRateLimit(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (
    /output tokens per minute|expected output tokens exceed|enforced limit/i.test(
      message,
    )
  ) {
    return false;
  }
  return (
    status === 429 || /ratelimit|rate limit|tokens per minute/i.test(message)
  );
}

function formatGroqError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/organization level|blocked at the organization/i.test(message)) {
    return new Error(
      "Groq rejected this model because its underlying model is blocked for your organization. Choose another Groq model or enable the underlying model in Groq organization settings.",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

function trimGroqHistory(messages: any[], maxInputTokens: number): any[] {
  if (estimateMessagesTokens(messages) <= maxInputTokens) return messages;
  const system = messages.filter((message) => message.role === "system");
  const lastUserIndex = messages.reduce(
    (index, message, currentIndex) =>
      message.role === "user" ? currentIndex : index,
    -1,
  );
  const currentTurn = lastUserIndex >= 0 ? messages.slice(lastUserIndex) : [];
  const compacted = [...system, ...currentTurn];
  return estimateMessagesTokens(compacted) <= maxInputTokens
    ? compacted
    : messages.slice(-4);
}

function getGroqInputLimit(model: string): number {
  if (model.startsWith("groq/compound")) return 70_000;
  if (model.startsWith("qwen/")) return 7_000;
  return 8_000;
}

export function getGroqMaxTokens(
  model: string,
  requested: number,
  messages: any[] = [],
  tools: any[] = [],
): number {
  const publishedLimit = model.startsWith("groq/compound") ? 70000 : 8000;

  if (model.startsWith("groq/compound")) {
    return Math.min(requested || 1000, publishedLimit);
  }

  // Groq's Qwen on-demand tier currently enforces a 1,000-token output budget.
  const enforcedLimit = model.startsWith("qwen/") ? 1000 : publishedLimit;
  const messageTokens = estimateMessagesTokens(messages);
  const toolTokens =
    tools.length > 0 ? estimateTokens(JSON.stringify(tools)) : 0;
  const availableForOutput = Math.max(
    256,
    GROQ_TPM_LIMIT - messageTokens - toolTokens - GROQ_REQUEST_MARGIN,
  );
  return Math.min(requested || 1000, enforcedLimit, availableForOutput);
}

export class GroqProvider {
  private readonly client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
  }

  async *stream(messages: any[], options: any): AsyncGenerator<any> {
    for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
      try {
        const capabilities = getGroqModelCapabilities(options.model);
        if (!capabilities.chatCompletions) {
          throw new Error(
            `Model ${options.model} supports ${capabilities.category}, not coding chat.`,
          );
        }
        const tools = capabilities.toolCalling ? (options.tools ?? []) : [];
        const requestMessages = trimGroqHistory(
          messages,
          getGroqInputLimit(options.model) -
            estimateTokens(JSON.stringify(tools)) -
            256,
        );
        const request = {
          model: normalizeGroqModel(options.model),
          messages: requestMessages,
          max_tokens: getGroqMaxTokens(
            options.model,
            options.maxTokens,
            requestMessages,
            tools,
          ),
          temperature: options.temperature || 0.5,
          stream: true as const,
          ...(capabilities.toolCalling && options.tools
            ? { tools: options.tools }
            : {}),
        };
        const stream = await this.client.chat.completions.create(request);

        for await (const chunk of stream) {
          yield chunk;
        }
        return;
      } catch (error) {
        if (!isRetryableRateLimit(error) || attempt === GROQ_MAX_RETRIES) {
          throw formatGroqError(error);
        }
        const delay = retryDelayMs(error);
        options.onRateLimit?.(delay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async complete(messages: any[], options: any): Promise<any> {
    for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
      try {
        const capabilities = getGroqModelCapabilities(options.model);
        if (!capabilities.chatCompletions) {
          throw new Error(
            `Model ${options.model} supports ${capabilities.category}, not coding chat.`,
          );
        }
        const tools = capabilities.toolCalling ? (options.tools ?? []) : [];
        const requestMessages = trimGroqHistory(
          messages,
          getGroqInputLimit(options.model) -
            estimateTokens(JSON.stringify(tools)) -
            256,
        );
        const request = {
          model: normalizeGroqModel(options.model),
          messages: requestMessages,
          max_tokens: getGroqMaxTokens(
            options.model,
            options.maxTokens,
            requestMessages,
            tools,
          ),
          temperature: options.temperature || 0.5,
          stream: false as const,
          ...(capabilities.toolCalling && options.tools
            ? { tools: options.tools }
            : {}),
        };
        const response = await this.client.chat.completions.create(request);

        return {
          message: {
            role: "assistant",
            content: response.choices[0]?.message?.content || "",
          },
          usage: response.usage,
        };
      } catch (error) {
        if (!isRetryableRateLimit(error) || attempt === GROQ_MAX_RETRIES) {
          throw formatGroqError(error);
        }
        const delay = retryDelayMs(error);
        options.onRateLimit?.(delay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
