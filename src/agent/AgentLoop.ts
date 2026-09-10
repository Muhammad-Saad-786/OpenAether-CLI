import type { AgentEvent, AgentToolCall, ToolResult } from "./types.js";
import { DEFAULT_LOOP_OPTIONS, type AgentLoopOptions } from "./types.js";
import type { AgentSession } from "./AgentSession.js";
import { ToolRunner } from "./ToolRunner.js";
import type { ChatProvider } from "../provider/client.js";
import type { Message } from "../provider/types.js";

/**
 * The heart of OpenAether. A single loop:
 *   1. Build request (with memory summary)
 *   2. Stream model response
 *   3. If no tool calls → done
 *   4. Execute tool calls
 *   5. Feed results back → repeat
 *
 * The loop exits on:
 *   - model returns no tool calls (natural answer)
 *   - `done` tool called
 *   - max iterations reached
 *   - no progress after N rounds
 */
export class AgentLoop {
  private readonly toolRunner = new ToolRunner();

  constructor(
    private readonly session: AgentSession,
    private readonly provider: ChatProvider,
    private readonly options: AgentLoopOptions = DEFAULT_LOOP_OPTIONS,
  ) {}

  async *run(prompt: string): AsyncGenerator<AgentEvent> {
    this.session.setGoal(prompt);
    this.session.addUser(prompt);

    let stalledRounds = 0;

    for (
      let iteration = 1;
      iteration <= this.options.maxIterations;
      iteration++
    ) {
      yield { type: "iteration_start", iteration };

      const messages = this.session.buildRequest();
      const tools = this.session.tools.toOpenAIFormat();

      // ─── Stream the model response ───────────────────────────
      let assistantText = "";
      const toolCalls: AgentToolCall[] = [];
      const toolCallMap = new Map<number, AgentToolCall>();

      try {
        const stream = this.provider.stream(
          messages as Message[],
          {
            model: this.session.config.model,
            maxTokens: this.session.config.maxTokens,
            temperature: this.session.config.temperature,
            tools: tools.length ? tools : undefined,
          } as any,
        );

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            assistantText += delta.content;
            yield { type: "assistant_text", delta: delta.content };
          }

          for (const call of delta.tool_calls ?? []) {
            const index = call.index ?? toolCallMap.size;
            const existing = toolCallMap.get(index);
            if (existing) {
              if (call.function?.name)
                existing.function.name = call.function.name;
              if (call.function?.arguments)
                existing.function.arguments += call.function.arguments;
            } else {
              toolCallMap.set(index, {
                id: call.id ?? `call_${index}`,
                type: "function",
                function: {
                  name: call.function?.name ?? "",
                  arguments: call.function?.arguments ?? "",
                },
              });
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        yield { type: "error", message };
        return;
      }

      for (const call of toolCallMap.values()) toolCalls.push(call);

      // ─── No tool calls → natural-language answer ─────────────
      if (toolCalls.length === 0) {
        const content = assistantText.trim();
        this.session.addAssistant({ role: "assistant", content });
        yield { type: "assistant_message", content };
        yield {
          type: "done",
          summary: content || "Completed.",
          iterations: iteration,
        };
        return;
      }

      // ─── Persist assistant message with tool calls ───────────
      const assistantMessage = {
        role: "assistant" as const,
        content: assistantText || null,
        tool_calls: toolCalls,
      };
      this.session.addAssistant(assistantMessage);
      if (assistantText.trim()) {
        yield { type: "assistant_message", content: assistantText.trim() };
      }

      // ─── Execute tools ───────────────────────────────────────
      const results: ToolResult[] = [];
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // leave empty; ToolRunner will report the parse error
        }
        yield {
          type: "tool_call_start",
          toolCallId: call.id,
          toolName: call.function.name,
          args,
        };
      }

      const runResults = await this.toolRunner.runAll(
        toolCalls,
        this.session.tools,
      );
      results.push(...runResults);

      for (const result of runResults) {
        this.session.addToolResult({
          role: "tool",
          tool_call_id: result.toolCallId,
          name: result.toolName,
          content: formatToolResultForModel(result),
        });
        this.recordMemory(result);
        yield { type: "tool_result", result };
      }

      // ─── done() called? ──────────────────────────────────────
      const doneResult = results.find((r) => r.toolName === "done");
      if (doneResult) {
        const summary =
          (doneResult.data as { summary?: string } | undefined)?.summary ??
          this.session.memory.goal;
        yield { type: "done", summary, iterations: iteration };
        return;
      }

      // ─── No-progress detection ───────────────────────────────
      const anySuccess = results.some((r) => r.ok);
      if (!anySuccess) {
        stalledRounds++;
      } else {
        stalledRounds = 0;
      }
      if (stalledRounds >= this.options.maxToolRoundsWithoutProgress) {
        yield {
          type: "done",
          summary: `No progress after ${stalledRounds} failed rounds. Stopping.`,
          iterations: iteration,
        };
        return;
      }
    }

    yield {
      type: "done",
      summary: `Reached maximum iterations (${this.options.maxIterations}).`,
      iterations: this.options.maxIterations,
    };
  }

  private recordMemory(result: ToolResult): void {
    const m = this.session.memory;
    const path = (result.data as { path?: string } | undefined)?.path;
    if (result.ok) {
      if (result.toolName === "read_file" && path) m.filesRead.add(path);
      if (
        (result.toolName === "write_file" || result.toolName === "edit_file") &&
        path
      )
        m.filesWritten.add(path);
      if (result.toolName === "delete_file" && path) m.filesDeleted.add(path);
      if (result.toolName === "bash" && path) m.commandsRun.push(path);
    } else if (result.error) {
      m.errors.push(result.error);
    }
  }
}

function formatToolResultForModel(result: ToolResult): string {
  if (!result.ok) {
    return `ERROR: ${result.error ?? result.summary}`;
  }
  const payload = result.data !== undefined ? result.data : result.summary;
  return typeof payload === "string"
    ? payload
    : JSON.stringify(payload, null, 2);
}
