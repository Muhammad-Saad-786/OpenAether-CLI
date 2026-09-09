import Groq from "groq-sdk";

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

function formatGroqError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;

  if (
    status === 429 ||
    /ratelimit|rate limit|tokens per minute/i.test(message)
  ) {
    return new Error(
      "Groq rate limit reached (8K tokens/minute for this model). Wait 60 seconds or reduce request size.",
    );
  }
  if (/organization level|blocked at the organization/i.test(message)) {
    return new Error(
      "Groq rejected this model because its underlying model is blocked for your organization.",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

export function getGroqMaxTokens(model: string, requested: number): number {
  const publishedLimit = model.startsWith("groq/compound") ? 70000 : 8000;
  if (model.startsWith("groq/compound")) {
    return Math.min(requested || 500, publishedLimit);
  }
  const enforcedLimit = model.startsWith("qwen/") ? 1000 : 500;
  return Math.min(requested || 500, enforcedLimit);
}

export class GroqProvider {
  private readonly client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({
      apiKey: apiKey,
    });
  }

  async *stream(messages: any[], options: any): AsyncGenerator<any> {
    try {
      const capabilities = getGroqModelCapabilities(options.model);
      if (!capabilities.chatCompletions) {
        throw new Error(
          `Model ${options.model} supports ${capabilities.category}, not coding chat.`,
        );
      }

      // Limit messages to last 4 to reduce token usage
      const limitedMessages = messages.slice(-4);

      // Limit max_tokens to 500 for Groq
      const maxTokens = Math.min(options.maxTokens || 500, 500);

      const request: any = {
        model: normalizeGroqModel(options.model),
        messages: limitedMessages,
        max_tokens: maxTokens,
        temperature: options.temperature || 0.5,
        stream: true,
      };

      // Only include tools for tool-capable models
      if (
        capabilities.toolCalling &&
        options.tools &&
        options.tools.length > 0
      ) {
        request.tools = options.tools;
        request.tool_choice = "auto";
      }

      const stream = (await this.client.chat.completions.create(
        request,
      )) as unknown as AsyncIterable<any>;

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      throw formatGroqError(error);
    }
  }

  async complete(messages: any[], options: any): Promise<any> {
    try {
      const capabilities = getGroqModelCapabilities(options.model);
      if (!capabilities.chatCompletions) {
        throw new Error(
          `Model ${options.model} supports ${capabilities.category}, not coding chat.`,
        );
      }

      const limitedMessages = messages.slice(-4);
      const maxTokens = Math.min(options.maxTokens || 500, 500);

      const request: any = {
        model: normalizeGroqModel(options.model),
        messages: limitedMessages,
        max_tokens: maxTokens,
        temperature: options.temperature || 0.5,
        stream: false,
      };

      if (
        capabilities.toolCalling &&
        options.tools &&
        options.tools.length > 0
      ) {
        request.tools = options.tools;
        request.tool_choice = "auto";
      }

      const response = await this.client.chat.completions.create(request);

      return {
        message: {
          role: "assistant",
          content: response.choices[0]?.message?.content || "",
        },
        usage: response.usage,
      };
    } catch (error) {
      throw formatGroqError(error);
    }
  }
}
