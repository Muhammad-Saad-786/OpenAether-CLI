import Groq from "groq-sdk";

export function normalizeGroqModel(model: string): string {
  return model;
}

function supportsToolCalling(model: string): boolean {
  return model !== "groq/compound" && model !== "groq/compound-mini";
}

function getGroqMaxTokens(model: string, requested: number): number {
  const publishedLimit =
    model === "groq/compound" || model === "groq/compound-mini" ? 70000 : 8000;

  // Groq's current on-demand tier can enforce a lower per-request limit.
  const enforcedLimit = model.startsWith("qwen/") ? 1000 : publishedLimit;
  return Math.min(requested || 1000, enforcedLimit);
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
      const request = {
        model: normalizeGroqModel(options.model),
        messages: messages.filter((m: any) => m.role !== "system"),
        max_tokens: getGroqMaxTokens(options.model, options.maxTokens),
        temperature: options.temperature || 0.5,
        stream: true as const,
        ...(supportsToolCalling(options.model) && options.tools
          ? { tools: options.tools }
          : {}),
      };
      const stream = await this.client.chat.completions.create(request);

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error("Groq Stream Error:", error);
      throw error;
    }
  }

  async complete(messages: any[], options: any): Promise<any> {
    try {
      const request = {
        model: normalizeGroqModel(options.model),
        messages: messages.filter((m: any) => m.role !== "system"),
        max_tokens: getGroqMaxTokens(options.model, options.maxTokens),
        temperature: options.temperature || 0.5,
        stream: false as const,
        ...(supportsToolCalling(options.model) && options.tools
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
      console.error("Groq API Error:", error);
      throw error;
    }
  }
}
