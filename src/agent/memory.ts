import type { AgentMessage } from "./types.js";

/**
 * Rolling summary of old messages. Keeps context small even after
 * many iterations by compressing tool calls and assistant replies
 * into a compact log.
 */
export class MemoryCompressor {
  private readonly keepLast: number;

  constructor(keepLast = 8) {
    this.keepLast = keepLast;
  }

  /**
   * Takes a full message array and returns a compressed version:
   *   [system] + [synthetic summary] + [last N messages]
   *
   * The system message is preserved verbatim. Old messages are
   * summarized into a single line each.
   */
  compress(messages: AgentMessage[]): AgentMessage[] {
    if (messages.length <= this.keepLast + 1) {
      return messages; // nothing to compress
    }

    const system = messages[0];
    const rest = messages.slice(1);

    // Keep the last N messages verbatim.
    const recent = rest.slice(-this.keepLast);
    const old = rest.slice(0, rest.length - this.keepLast);

    const summary = this.summarize(old);
    if (!summary) {
      return [system, ...recent];
    }

    const summaryMessage: AgentMessage = {
      role: "system",
      content: `── SESSION HISTORY (compressed) ──\n${summary}`,
    };

    return [system, summaryMessage, ...recent];
  }

  private summarize(messages: AgentMessage[]): string {
    const lines: string[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        const text = String(msg.content ?? "").trim();
        if (text) lines.push(`USER: ${truncate(text, 120)}`);
      } else if (msg.role === "assistant") {
        if (msg.tool_calls?.length) {
          const names = msg.tool_calls.map((c) => c.function.name).join(", ");
          lines.push(`ASSISTANT called: ${names}`);
        }
        const text = String(msg.content ?? "").trim();
        if (text) lines.push(`ASSISTANT: ${truncate(text, 120)}`);
      } else if (msg.role === "tool") {
        const text = String(msg.content ?? "").trim();
        lines.push(`TOOL(${msg.name ?? "?"}): ${truncate(text, 100)}`);
      }
    }

    return lines.join("\n");
  }
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 3) + "..." : oneLine;
}
