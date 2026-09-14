import type { AgentEvent, AgentToolCall, ToolResult } from "./types.js";
import { DEFAULT_LOOP_OPTIONS, type AgentLoopOptions } from "./types.js";
import type { AgentSession } from "./AgentSession.js";
import { ToolRunner } from "./ToolRunner.js";
import type { ChatProvider } from "../provider/types.js";
import type { Message } from "../provider/types.js";

export class AgentLoop {
  private readonly toolRunner = new ToolRunner();

  constructor(
    private readonly session: AgentSession,
    private readonly provider: ChatProvider,
    private readonly options: AgentLoopOptions = DEFAULT_LOOP_OPTIONS,
    private readonly fallbackProvider?: ChatProvider,
    private readonly fallbackModel?: string,
  ) {}

  async *run(prompt: string): AsyncGenerator<AgentEvent> {
    // Reset per-prompt change tracking.
    this.session.memory.filesWritten.clear();
    this.session.memory.filesDeleted.clear();
    this.session.memory.verification = null;
    this.session.lockedFiles.clear();

    this.session.setGoal(prompt);
    this.session.addUser(prompt);

    let stalledRounds = 0;
    const userAskedForChange =
      /\b(create|add|write|edit|update|modify|fix|rename|move|delete|remove|refactor|implement)\b/i.test(
        prompt,
      );

    for (
      let iteration = 1;
      iteration <= this.options.maxIterations;
      iteration++
    ) {
      yield { type: "iteration_start", iteration };

      // ─── Stay-on-task reminder ───────────────────────────────
      if (iteration > 1 && iteration % 3 === 0) {
        this.session.addToolResult({
          role: "user",
          content:
            `REMINDER: Task is "${prompt}". Stay focused. ` +
            `Do NOT create or modify files unrelated to this task.`,
        });
      }

      const messages = this.session.buildRequest();
      const tools = this.session.tools.toOpenAIFormat();
      const activeProvider: ChatProvider = this.provider;

      let assistantText = "";
      const toolCalls: AgentToolCall[] = [];
      const toolCallMap = new Map<number, AgentToolCall>();

      // ─── Stream the model response ───────────────────────────
      try {
        const stream = activeProvider.stream(
          messages as Message[],
          {
            model: this.session.config.model,
            maxTokens: this.session.config.maxTokens,
            temperature: this.session.config.temperature,
            tools: tools.length ? tools : undefined,
          } as any,
        );

        for await (const chunk of stream) {
          this.consumeChunk(chunk, toolCallMap, (delta) => {
            assistantText += delta;
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        const isRateLimit = activeProvider.isRateLimitError(err);
        if (isRateLimit && this.fallbackProvider) {
          yield {
            type: "error",
            message: "Rate limited — falling back to the other provider…",
          };
          try {
            const fallbackStream = this.fallbackProvider.stream(
              messages as Message[],
              {
                model: this.session.config.model,
                maxTokens: this.session.config.maxTokens,
                temperature: this.session.config.temperature,
                tools: tools.length ? tools : undefined,
              } as any,
            );

            for await (const chunk of fallbackStream) {
              this.consumeChunk(chunk, toolCallMap, (delta) => {
                assistantText += delta;
              });
            }
          } catch (fallbackErr) {
            const fbMsg =
              fallbackErr instanceof Error
                ? fallbackErr.message
                : String(fallbackErr);
            yield { type: "error", message: `Fallback failed: ${fbMsg}` };
            return;
          }
        } else if (
          /Upstream error|Service temporarily overloaded|502|503|overloaded|model not found|invalid model|is not a valid model|no endpoints found/i.test(
            message,
          ) &&
          this.fallbackModel
        ) {
          yield {
            type: "error",
            message: `Upstream provider unavailable. Retrying with ${this.fallbackModel}…`,
          };

          const previous = this.session.config.model;
          (this.session.config as any).model = this.fallbackModel;

          try {
            const retryStream = activeProvider.stream(
              messages as Message[],
              {
                model: this.fallbackModel,
                maxTokens: this.session.config.maxTokens,
                temperature: this.session.config.temperature,
                tools: tools.length ? tools : undefined,
              } as any,
            );

            for await (const chunk of retryStream) {
              this.consumeChunk(chunk, toolCallMap, (delta) => {
                assistantText += delta;
              });
            }
            (this.session.config as any).model = previous;
          } catch (retryErr) {
            (this.session.config as any).model = previous;
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : String(retryErr);
            yield {
              type: "error",
              message: `Fallback model also failed: ${retryMsg}`,
            };
            return;
          }
        } else if (
          /tool_use_failed|not in request.tools|tool call validation|Unknown tool/i.test(
            message,
          )
        ) {
          this.session.addToolResult({
            role: "user",
            content:
              `Your previous response attempted to call a tool that does not exist. ` +
              `Valid tools are: list_dir, read_file, write_file, edit_file, move_file, ` +
              `delete_file, glob, grep, find_symbol, search_symbols, bash, merge_files, ` +
              `write_plan, done. ` +
              `Do not use prefixes like "repo_browser.". Try again with a correct tool name.`,
          });
          yield {
            type: "error",
            message: "Retrying with corrected tool names...",
          };
          continue;
        } else {
          yield { type: "error", message };
          return;
        }
      }

      for (const call of toolCallMap.values()) toolCalls.push(call);

      // ─── Detect leaked JSON in assistant text ────────────────
      if (toolCalls.length === 0 && assistantText.trim()) {
        const leaked = detectLeakedDone(assistantText);
        if (leaked) {
          toolCalls.push({
            id: `call_leaked_${Date.now()}`,
            type: "function",
            function: {
              name: "done",
              arguments: JSON.stringify({ status: leaked.summary }),
            },
          });
          assistantText = leaked.summary;
        }
      }

      // ─── No tool calls ───────────────────────────────────────
      if (toolCalls.length === 0) {
        const content = assistantText.trim();

        const alreadyChanged =
          this.session.memory.filesWritten.size > 0 ||
          this.session.memory.filesDeleted.size > 0;

        if (alreadyChanged) {
          this.session.addAssistant({ role: "assistant", content });
          yield { type: "assistant_message", content };
          yield {
            type: "done",
            summary: content || "Task completed.",
            iterations: iteration,
          };
          return;
        }

        if (iteration === 1 && userAskedForChange) {
          this.session.addAssistant({ role: "assistant", content });
          this.session.addToolResult({
            role: "user",
            content:
              `You replied with text, but the user asked for a change. ` +
              `Use a tool now. For example: write_file with path="index.html" ` +
              `and content='<!DOCTYPE html>...'.`,
          });
          continue;
        }

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

      // ─── Emit tool_call_start events ─────────────────────────
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // ToolRunner reports the parse error
        }
        yield {
          type: "tool_call_start",
          toolCallId: call.id,
          toolName: call.function.name,
          args,
        };
      }

      // ─── Reject writes to already-verified files ─────────────
      const filteredCalls: AgentToolCall[] = [];
      const rejectedResults: ToolResult[] = [];

      for (const call of toolCalls) {
        const isWriteLike =
          call.function.name === "write_file" ||
          call.function.name === "edit_file" ||
          call.function.name === "delete_file";

        if (isWriteLike) {
          let targetPath: string | undefined;
          try {
            const args = JSON.parse(call.function.arguments || "{}");
            targetPath = typeof args.path === "string" ? args.path : undefined;
          } catch {
            // leave for ToolRunner to report
          }

          if (targetPath && this.session.lockedFiles.has(targetPath)) {
            rejectedResults.push({
              ok: false,
              toolName: call.function.name,
              toolCallId: call.id,
              summary: `Refused: ${targetPath} is locked`,
              error:
                `${targetPath} already passed verification and is locked. ` +
                `Do not edit a file you have already fixed. If the task is not ` +
                `complete, re-check the original request.`,
            });
            continue;
          }
        }
        filteredCalls.push(call);
      }

      // ─── Execute tools ───────────────────────────────────────
      const runResults: ToolResult[] = [
        ...(await this.toolRunner.runAll(filteredCalls, this.session.tools)),
        ...rejectedResults,
      ];

      // ─── Record results + emit events ────────────────────────
      for (const result of runResults) {
        this.session.addToolResult({
          role: "tool",
          tool_call_id: result.toolCallId,
          name: result.toolName,
          content: formatToolResultForModel(result),
        });
        await this.recordMemory(result);
        yield { type: "tool_result", result };
      }

      // ─── Malformed tool arguments → ask the model to retry ──
      const isParseFail = (r: ToolResult) =>
        !r.ok &&
        /parse.*argument|invalid.*json|malformed|failed to parse/i.test(
          `${r.error ?? ""} ${r.summary ?? ""}`,
        );

      const malformedDone = runResults.find(
        (r) => r.toolName === "done" && isParseFail(r),
      );
      if (malformedDone) {
        this.session.addToolResult({
          role: "user",
          content:
            `Your done call had malformed JSON. The correct arguments are exactly: ` +
            `{"status":"<one-line summary>"}. Do not wrap in markdown, use double quotes.`,
        });
        yield {
          type: "error",
          message: "done had invalid JSON — asking the model to retry.",
        };
        continue;
      }

      const parseFailures = runResults.filter(isParseFail);
      if (parseFailures.length > 0) {
        this.session.addToolResult({
          role: "user",
          content:
            `Your previous tool call had malformed JSON arguments. ` +
            `Tool arguments must be a single valid JSON object with double-quoted ` +
            `keys and string values, and no trailing commas. ` +
            `Please retry the SAME tool call with valid JSON.`,
        });
        yield {
          type: "error",
          message: "Malformed tool arguments — asking the model to retry.",
        };
        continue;
      }

      // ─── Auto-verify after any successful file change ────────
      const madeFileChanges = runResults.some(
        (r) =>
          r.ok &&
          ["write_file", "edit_file", "move_file", "delete_file"].includes(
            r.toolName,
          ),
      );

      if (madeFileChanges) {
        const verifyCall: AgentToolCall = {
          id: `auto_verify_${iteration}`,
          type: "function",
          function: { name: "run_verification", arguments: "{}" },
        };

        yield {
          type: "tool_call_start",
          toolCallId: verifyCall.id,
          toolName: "run_verification",
          args: {},
        };

        const verifyResults = await this.toolRunner.runAll(
          [verifyCall],
          this.session.tools,
        );

        for (const result of verifyResults) {
          this.session.addToolResult({
            role: "tool",
            tool_call_id: result.toolCallId,
            name: result.toolName,
            content: formatToolResultForModel(result),
          });
          await this.recordMemory(result);
          yield { type: "tool_result", result };
          runResults.push(result);
        }

        const verifyFailed = verifyResults.find((r) => !r.ok);
        if (verifyFailed) {
          this.session.addToolResult({
            role: "user",
            content:
              `Verification failed. Fix the errors shown above using edit_file ` +
              `or write_file, then continue. Do NOT try to run verification ` +
              `yourself — the loop does that automatically after every change.`,
          });
          continue;
        }
      }

      // ─── done() ──────────────────────────────────────────────
      const doneResult = runResults.find((r) => r.toolName === "done");
      if (doneResult) {
        const data = doneResult.data as
          | { summary?: string; status?: string }
          | undefined;
        const summary =
          data?.summary ?? data?.status ?? this.session.memory.goal;
        yield { type: "done", summary, iterations: iteration };
        return;
      }

      // ─── Nudge: only explored, didn't act ────────────────────
      const readOnlyTools = new Set([
        "list_dir",
        "read_file",
        "glob",
        "grep",
        "find_symbol",
        "search_symbols",
      ]);
      const didOnlyRead =
        runResults.length > 0 &&
        runResults.every((r) => readOnlyTools.has(r.toolName));
      if (didOnlyRead && userAskedForChange && iteration < 3) {
        this.session.addToolResult({
          role: "user",
          content:
            `You explored the workspace but have not made any changes yet. ` +
            `The user asked you to: "${prompt}". ` +
            `Now use write_file, edit_file, move_file, or delete_file to complete it.`,
        });
        continue;
      }

      // ─── No-progress detection ───────────────────────────────
      if (userAskedForChange) {
        const writeSucceeded = runResults.some(
          (r) =>
            r.ok &&
            ["write_file", "edit_file", "move_file", "delete_file"].includes(
              r.toolName,
            ),
        );

        if (writeSucceeded) {
          stalledRounds = 0;
        } else {
          stalledRounds++;
        }

        if (stalledRounds >= this.options.maxToolRoundsWithoutProgress) {
          yield {
            type: "done",
            summary: `No progress: stopped after ${stalledRounds} iterations with no file changes.`,
            iterations: iteration,
          };
          return;
        }
      } else {
        const qaCap = this.options.maxQaIterations ?? 5;
        if (iteration >= qaCap) {
          yield {
            type: "done",
            summary: "Answered the question.",
            iterations: iteration,
          };
          return;
        }
      }
    }
  }

  private consumeChunk(
    chunk: any,
    toolCallMap: Map<number, AgentToolCall>,
    onText: (delta: string) => void,
  ): void {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;

    if (delta.content) {
      onText(delta.content);
    }

    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? toolCallMap.size;
      const existing = toolCallMap.get(index);
      if (existing) {
        if (call.function?.name) existing.function.name = call.function.name;
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

  private async recordMemory(result: ToolResult): Promise<void> {
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

      // Refresh the symbol index for changed files.
      if (
        path &&
        ["write_file", "edit_file", "delete_file", "move_file"].includes(
          result.toolName,
        )
      ) {
        await this.session.symbolIndex.refreshFile(path);
      }

      // move_file affects two paths — refresh the destination too.
      if (result.toolName === "move_file") {
        const to = (result.data as { to?: string } | undefined)?.to;
        if (to) {
          await this.session.symbolIndex.refreshFile(to);
        }
      }

      if (result.toolName === "bash") {
        const cmd = (result.data as { command?: string } | undefined)?.command;
        if (cmd) m.commandsRun.push(cmd);
      }
      if (result.toolName === "run_verification") {
        const passed = Boolean(
          (result.data as { passed?: boolean } | undefined)?.passed,
        );
        m.verification = { passed, lastRun: new Date().toISOString() };
        if (passed) {
          for (const f of m.filesWritten) this.session.lockedFiles.add(f);
          m.filesWritten.clear();
          m.filesDeleted.clear();
        }
      }
    } else if (result.error) {
      m.errors.push(result.error);
    }
  }
}

function formatToolResultForModel(result: ToolResult): string {
  if (!result.ok) {
    const errLine = `ERROR: ${result.error ?? result.summary}`;
    if (result.data === undefined) return errLine;
    const dataJson =
      typeof result.data === "string"
        ? result.data
        : JSON.stringify(result.data, null, 2);
    return `${errLine}\n${dataJson}`;
  }
  const payload = result.data !== undefined ? result.data : result.summary;
  return typeof payload === "string"
    ? payload
    : JSON.stringify(payload, null, 2);
}

function detectLeakedDone(text: string): { summary: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.summary === "string") {
      return { summary: obj.summary };
    }
  } catch {
    // not JSON
  }
  return null;
}
