import type { OpenRouterProvider } from "../provider/openrouter.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Message, CompletionOptions } from "../provider/types.js";
import chalk from "chalk";

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
      const stream = this.provider.stream(this.messages, {
        model: this.options.model,
        maxTokens: this.options.maxTokens,
        temperature: this.options.temperature,
        tools: this.tools.toOpenAIFormat(),
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          process.stdout.write(chalk.green(content));
        }
      }

      if (fullResponse) {
        this.messages.push({ role: "assistant", content: fullResponse });
      }
      console.log("\n");
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : String(error),
      );
      this.messages.pop();
    }
  }
}
