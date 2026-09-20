import OpenAI from "openai";
import type {
  CompletionOptions,
  CompletionResult,
  Message,
  ProviderCapabilities,
  ToolUse,
} from "./types.js";

/**
 * Mistral model catalog. Base URL is OpenAI-compatible; we use the OpenAI
 * SDK directly.
 *
 * IMPORTANT: Mistral's API strictly validates the Chat Completions schema
 * and rejects unknown fields with a bare 400. Other providers (Groq,
 * OpenRouter) tolerate extras. We sanitize messages before sending.
 */
const KNOWN_MODELS: Record<
  string,
  { contextWindow: number; maxOutput: number; tools: boolean; label: string }
> = {
  "codestral-2508": {
    contextWindow: 128_000,
    maxOutput: 8_000,
    tools: true,
    label: "Codestral 2508 (code)",
  },

  "ministral-3b-2512": {
    contextWindow: 256_000,
    maxOutput: 8_000,
    tools: true,
    label: "Ministral 3B (12.5 RPS)",
  },
  "ministral-8b-2512": {
    contextWindow: 256_000,
    maxOutput: 8_000,
    tools: true,
    label: "Ministral 8B (3.13 RPS)",
  },
  "ministral-14b-2512": {
    contextWindow: 256_000,
    maxOutput: 8_000,
    tools: true,
    label: "Ministral 14B (0.5 RPS, 937K TPM)",
  },

  // Huge TPM candidates
  "labs-leanstral-1-5-1": {
    contextWindow: 128_000,
    maxOutput: 8_000,
    tools: true,
    label: "Leanstral 1.5 (5M TPM)",
  },

  // Third-party
  "glm-5-2": {
    contextWindow: 128_000,
    maxOutput: 8_000,
    tools: true,
    label: "GLM 5.2",
  },
  "zai-glm-5-3": {
    contextWindow: 128_000,
    maxOutput: 8_000,
    tools: true,
    label: "Z.ai GLM 5.3",
  },
};

const DEFAULT_MODEL = "mistral-medium-3-5";

/**
 * Mistral strictly validates messages against the OpenAI tool-call schema.
 * It rejects:
 *   - assistant messages whose tool_calls have extra fields
 *   - tool messages missing name or tool_call_id
 *   - null content on assistant messages that carry tool_calls
 *
 * We normalize every outgoing message to satisfy Mistral's validator.
 */
function sanitizeMessagesForMistral(messages: Message[]): Message[] {
  const sanitized: Message[] = [];

  for (const msg of messages) {
    // System / user: pass through unchanged.
    if (msg.role === "system" || msg.role === "user") {
      sanitized.push({
        role: msg.role,
        content: msg.content ?? "",
      });
      continue;
    }

    // Assistant: sanitize tool_calls if present.
    if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        sanitized.push({
          role: "assistant",
          // Mistral requires a string, even when tool_calls are present.
          content: msg.content ?? "",
          tool_calls: msg.tool_calls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          })),
        });
      } else {
        sanitized.push({
          role: "assistant",
          content: msg.content ?? "",
        });
      }
      continue;
    }

    // Tool: Mistral requires both tool_call_id and name.
    if (msg.role === "tool") {
      sanitized.push({
        role: "tool",
        content: msg.content ?? "",
        tool_call_id: msg.tool_call_id ?? "",
        // Mistral expects `name` on tool results to match the tool.
        name: msg.name ?? "",
      });
      continue;
    }
  }

  return sanitized;
}

/**
 * Mistral rejects messages where the assistant message has tool_calls but
 * the immediately following tool messages reference different IDs. We
 * ensure orphaned tool results are dropped.
 */
function dropOrphanedToolResults(messages: Message[]): Message[] {
  const knownCallIds = new Set<string>();
  const result: Message[] = [];

  for (const msg of messages) {
    if (msg.role === "assistant" && msg.tool_calls?.length) {
      for (const call of msg.tool_calls) knownCallIds.add(call.id);
      result.push(msg);
      continue;
    }
    if (msg.role === "tool") {
      if (msg.tool_call_id && knownCallIds.has(msg.tool_call_id)) {
        result.push(msg);
      }
      // Drop orphaned tool results — Mistral returns 400 on these.
      continue;
    }
    result.push(msg);
  }

  return result;
}

export class MistralProvider {
  readonly name = "mistral";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: "https://api.mistral.ai/v1",
      apiKey,
    });
  }

  capabilities(model: string): ProviderCapabilities {
    const known = KNOWN_MODELS[model];
    return {
      supportsTools: known?.tools ?? true,
      contextWindow: known?.contextWindow ?? 128_000,
      maxOutput: known?.maxOutput ?? 8_000,
      rateLimits: { rpm: 60, tpm: 500_000 },
    };
  }

  isRateLimitError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    if (status === 429) return true;
    const msg = error instanceof Error ? error.message : String(error);
    return /rate.?limit|429|too many requests/i.test(msg);
  }

  private prepareMessages(messages: Message[]): Message[] {
    return sanitizeMessagesForMistral(dropOrphanedToolResults(messages));
  }

  async complete(
    messages: Message[],
    options: CompletionOptions,
  ): Promise<CompletionResult> {
    const safeMessages = this.prepareMessages(messages);

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: safeMessages as never,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      ...(options.tools?.length
        ? {
            tools: options.tools as never,
            tool_choice: "auto" as const,
          }
        : {}),
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
  ): AsyncGenerator<any> {
    const safeMessages = this.prepareMessages(messages);

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: safeMessages as never,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      ...(options.tools?.length
        ? {
            tools: options.tools as never,
            tool_choice: "auto" as const,
          }
        : {}),
      stream: true,
    });

    for await (const chunk of stream) yield chunk;
  }
}

export function mistralDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function mistralKnownModels(): string[] {
  return Object.keys(KNOWN_MODELS);
}
