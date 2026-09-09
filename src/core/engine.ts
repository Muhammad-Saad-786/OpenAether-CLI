import type { OpenRouterProvider } from "../provider/openrouter.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Message, ToolUse } from "../provider/types.js";
import chalk from "chalk";
import { parseToolArguments } from "../utils/tool-args.js";
import {
  requestedFilePaths,
  shouldUseTools,
  toolNamesForPrompt,
} from "./tool-policy.js";
import {
  DEFAULT_TOKEN_BUDGET,
  fitRequestToBudget,
  type TokenBudgetAllocation,
} from "./budget.js";

export interface QueryEngineOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  budget?: TokenBudgetAllocation;
}

export class QueryEngine {
  public messages: Message[];
  public options: QueryEngineOptions;
  public provider: any;
  private tools: ToolRegistry;

  constructor(
    provider: any,
    tools: ToolRegistry,
    options: QueryEngineOptions,
    initialMessages: Message[] = [],
  ) {
    this.provider = provider;
    this.tools = tools;
    this.options = options;
    this.messages = initialMessages;
  }

  async submit(prompt: string, rateLimitAttempt = 0): Promise<string> {
    const targetFiles = requestedFilePaths(prompt);
    const scopedPrompt = targetFiles.length
      ? `${prompt}\n\nExecution constraints: work only on these requested file(s): ${targetFiles.join(", ")}. Do not use repository-wide search or inspect OpenAether source files. Read the target file, then perform the requested edit before responding.`
      : prompt;
    this.messages.push({ role: "user", content: scopedPrompt });
    const useTools = shouldUseTools(prompt);
    const availableToolNames = toolNamesForPrompt(prompt);
    const requiresMutation =
      /\b(add|create|edit|update|modify|implement|write|change|fix|remove|delete|generate)\b/i.test(
        prompt,
      ) && !/do not edit|do not change|plan .* only/i.test(prompt);
    let mutationCompleted = false;
    let continuationAttempts = 0;

    try {
      for (let round = 0; round < 10; round++) {
        const budget = this.options.budget ?? DEFAULT_TOKEN_BUDGET;
        const request = fitRequestToBudget(
          this.messages,
          useTools ? this.tools.toOpenAIFormat(availableToolNames) : [],
          budget.total,
          Math.min(this.options.maxTokens, budget.response),
        );

        const stream = this.provider.stream(request.messages, {
          model: this.options.model,
          maxTokens: Math.min(this.options.maxTokens, budget.response),
          temperature: this.options.temperature,
          tools: request.tools,
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
            const index = part.index ?? 0;
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
              if (part.function?.name) {
                existing.function.name = part.function.name;
              }
              if (part.function?.arguments) {
                existing.function.arguments += part.function.arguments;
              }
            }
          }
        }

        const calls = [...toolCalls.values()];

        const supportedCalls = calls.filter((call) =>
          this.tools.get(call.function.name),
        );
        const unsupportedCalls = calls.filter(
          (call) => !this.tools.get(call.function.name),
        );

        if (unsupportedCalls.length) {
          const names = unsupportedCalls
            .map((call) => call.function.name)
            .join(", ");
          if (!supportedCalls.length) {
            this.messages.push({
              role: "assistant",
              content: `I cannot use unsupported tool ${names}. Use only the tools provided in this request.`,
            });
            console.log("\n");
            return `Unsupported tool requested: ${names}`;
          }
        }

        if (!supportedCalls.length) {
          if (
            requiresMutation &&
            !mutationCompleted &&
            continuationAttempts < 2
          ) {
            continuationAttempts++;
            if (fullResponse) {
              this.messages.push({ role: "assistant", content: fullResponse });
            }
            this.messages.push({
              role: "user",
              content:
                "Continue the requested implementation now. Inspection is complete; use edit_file or write_file on the specifically requested file. Do not answer with a question or a progress summary until the file is changed.",
            });
            continue;
          }
          if (fullResponse) {
            this.messages.push({ role: "assistant", content: fullResponse });
          }
          console.log("\n");
          return fullResponse;
        }

        this.messages.push({
          role: "assistant",
          content: fullResponse || null,
          tool_calls: supportedCalls.map((call) => ({
            ...call,
            function: {
              ...call.function,
              arguments: normalizeToolArguments(call.function.arguments),
            },
          })),
        });

        for (const call of supportedCalls) {
          let args: Record<string, unknown>;
          try {
            args = parseToolArguments(call.function.arguments);
          } catch (error) {
            this.messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: `Invalid JSON tool arguments. Return only a valid JSON object and try again: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
            continue;
          }

          try {
            const result = await this.tools.execute(call.function.name, args);
            if (
              ["write_file", "edit_file", "delete_file"].includes(
                call.function.name,
              )
            ) {
              mutationCompleted = true;
            }
            this.messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: result,
            });
          } catch (error) {
            this.messages.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: `Tool error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
          }
        }
      }
      throw new Error("Maximum tool-call rounds exceeded");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Friendly rate limit message
      if (/rate limit|429|tokens per minute/i.test(message)) {
        console.error(
          chalk.yellow(
            "\n⚠️  Rate limit reached. Waiting 60 seconds before retry...\n",
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
        console.error(chalk.green("✅ Retry now!\n"));
        if (rateLimitAttempt < 2) {
          return this.submit(prompt, rateLimitAttempt + 1);
        }
      } else {
        console.error(chalk.red("Error:"), message);
      }

      // Remove failed user message
      this.messages.pop();
      return `Error: ${message}`;
    }
  }
}

function normalizeToolArguments(raw: string): string {
  try {
    parseToolArguments(raw);
    return raw;
  } catch {
    return "{}";
  }
}
