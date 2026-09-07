import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { Message, ToolUse } from "../provider/types.js";

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
      tool_calls: [...tools.values()],
    };
  })();
}
