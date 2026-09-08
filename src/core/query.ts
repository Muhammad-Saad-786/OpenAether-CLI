import type { OpenRouterProvider } from "../provider/openrouter.js";
import type { Message } from "../provider/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import { collectStream } from "../utils/streaming.js";
import { parseToolArguments } from "../utils/tool-args.js";

export type QueryOptions = {
  model: string;
  maxTokens: number;
  temperature: number;
  maxRounds?: number;
};

export async function query(
  messages: Message[],
  provider: OpenRouterProvider,
  tools: ToolRegistry,
  options: QueryOptions,
): Promise<Message> {
  for (let round = 0; round < (options.maxRounds ?? 8); round++) {
    const assistant = await collectStream(
      provider.stream(messages, {
        ...options,
        stream: true,
        tools: tools.toOpenAIFormat(),
      }),
    );
    messages.push(assistant);
    if (!assistant.tool_calls?.length) return assistant;
    for (const call of assistant.tool_calls) {
      let result: string;
      try {
        result = await tools.execute(
          call.function.name,
          parseToolArguments(call.function.arguments),
        );
      } catch (error) {
        result = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: result,
      });
    }
  }
  throw new Error("Maximum tool-call rounds exceeded");
}
