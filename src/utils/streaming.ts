import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { Message, ToolUse } from "../provider/types.js";
import { parseToolArguments } from "./tool-args.js";

export function sanitizeToolCalls(calls: ToolUse[]): ToolUse[] {
  return calls
    .filter((call) => call.function.name.trim().length > 0)
    .map((call, index) => {
      let args = "{}";
      try {
        args = JSON.stringify(parseToolArguments(call.function.arguments));
      } catch {
        // Keep the assistant message valid so the model can repair the call.
      }
      return {
        ...call,
        id: call.id || `call_${index}`,
        function: { ...call.function, arguments: args },
      };
    });
}

export function collectStream(
  stream: AsyncIterable<ChatCompletionChunk>,
  write = process.stdout.write.bind(process.stdout),
): Promise<Message> {
  return (async () => {
    let content = "";
    const tools = new Map<number, ToolUse>();
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        write(delta.content);
      }
      for (const call of delta?.tool_calls ?? []) {
        const current = tools.get(call.index) ?? {
          id: call.id ?? "",
          type: "function",
          function: { name: "", arguments: "" },
        };
        current.id ||= call.id ?? "";
        current.function.name += call.function?.name ?? "";
        current.function.arguments += call.function?.arguments ?? "";
        tools.set(call.index, current);
      }
    }
    if (content) write("\n");
    return {
      role: "assistant",
      content: content || null,
      tool_calls: sanitizeToolCalls([...tools.values()]),
    };
  })();
}
