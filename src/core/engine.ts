import type { OpenRouterProvider } from "../provider/openrouter.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Message, ToolUse } from "../provider/types.js";
import chalk from "chalk";
import { parseToolArguments } from "../utils/tool-args.js";

export interface QueryEngineOptions {
  model: string;
  maxTokens: number;
  temperature: number;
}

export class QueryEngine {
  public messages: Message[];
  public options: QueryEngineOptions;
  public provider: any; // OpenRouterProvider | GroqProvider;
  private tools: ToolRegistry;

  constructor(
    provider: any, // OpenRouterProvider | GroqProvider,
    tools: ToolRegistry,
    options: QueryEngineOptions,
    initialMessages: Message[] = [],
  ) {
    this.provider = provider;
    this.tools = tools;
    this.options = options;
    this.messages = initialMessages;
  }

  async submit(prompt: string): Promise<void> {
    this.messages.push({ role: "user", content: prompt });

    try {
      for (let round = 0; round < 10; round++) {
        const stream = this.provider.stream(this.messages, {
          model: this.options.model,
          maxTokens: this.options.maxTokens,
          temperature: this.options.temperature,
          tools:
            round > 0
              ? this.tools.toOpenAIFormat()
              : this.tools.toOpenAIFormat(),
        });

        let fullResponse = "";
        const toolCalls = new Map<number, ToolUse>();
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullResponse += delta.content;
            process.stdout.write(chalk.green(delta.content));
          }
          for (const part of delta?.tool_calls ?? []) {
            const index = part.index ?? toolCalls.size;
            const existing = toolCalls.get(index);
            if (!existing) {
              toolCalls.set(index, {
                id: part.id || `call_${index}`,
                type: "function",
                function: {
                  name: part.function?.name || "",
                  arguments: part.function?.arguments || "",
                },
              });
            } else {
              existing.function.name ||= part.function?.name || "";
              existing.function.arguments += part.function?.arguments || "";
            }
          }
        }

        const calls = [...toolCalls.values()];
        if (!calls.length) {
          if (fullResponse)
            this.messages.push({ role: "assistant", content: fullResponse });
          console.log("\n");
          return;
        }

        this.messages.push({
          role: "assistant",
          content: fullResponse || null,
          tool_calls: calls,
        });
        for (const call of calls) {
          let args: Record<string, unknown>;
          try {
            args = parseToolArguments(call.function.arguments);
          } catch {
            args = {};
          }
          const result = await this.tools.execute(call.function.name, args);
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: result,
          });
        }
      }
      throw new Error("Maximum tool-call rounds exceeded");
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : String(error),
      );
      this.messages.pop();
    }
  }
}
