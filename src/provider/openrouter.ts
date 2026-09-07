import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { Config } from "../config.js";
import type {
  CompletionOptions,
  CompletionResult,
  Message,
  ToolDefinition,
  ToolUse,
} from "./types.js";

export class OpenRouterProvider {
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
      stream: true,
    });
    for await (const chunk of stream) yield chunk;
  }
}
