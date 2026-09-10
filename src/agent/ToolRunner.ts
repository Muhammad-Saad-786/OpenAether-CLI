import type { AgentTool, AgentToolCall, ToolResult } from "./types.js";
import type { ToolRegistry } from "../tools/registry.js";
import { parseToolArguments } from "../utils/tool-args.js";

/**
 * ToolRunner executes an array of tool calls produced by the model.
 *
 * Concurrency rules:
 *  - side-effect tools (write, exec, meta) run sequentially
 *  - read-only tools run in parallel
 *
 * Every tool execution is wrapped in try/catch and always returns a
 * structured ToolResult — never throws.
 */
export class ToolRunner {
  async runAll(
    calls: AgentToolCall[],
    registry: ToolRegistry,
  ): Promise<ToolResult[]> {
    if (calls.length === 0) return [];

    const results: ToolResult[] = [];

    // Group consecutive read-only calls so they can run in parallel.
    let i = 0;
    while (i < calls.length) {
      const call = calls[i];
      const tool = registry.get(call.function.name);

      if (!tool) {
        results.push(
          this.errorResult(call, `Unknown tool: ${call.function.name}`),
        );
        i++;
        continue;
      }

      if (isReadOnly(tool)) {
        // Collect the run of read-only calls.
        const batch: AgentToolCall[] = [];
        while (i < calls.length) {
          const next = calls[i];
          const nextTool = registry.get(next.function.name);
          if (!nextTool || !isReadOnly(nextTool)) break;
          batch.push(next);
          i++;
        }
        const batchResults = await Promise.all(
          batch.map((c) => this.runOne(c, registry)),
        );
        results.push(...batchResults);
      } else {
        // Write/exec/meta: run one at a time.
        results.push(await this.runOne(call, registry));
        i++;
      }
    }

    return results;
  }

  private async runOne(
    call: AgentToolCall,
    registry: ToolRegistry,
  ): Promise<ToolResult> {
    const tool = registry.get(call.function.name);
    if (!tool)
      return this.errorResult(call, `Unknown tool: ${call.function.name}`);

    const started = Date.now();
    let args: Record<string, unknown>;
    try {
      args = parseToolArguments(call.function.arguments);
    } catch (err) {
      return {
        ok: false,
        toolName: call.function.name,
        toolCallId: call.id,
        summary: `Invalid arguments for ${call.function.name}`,
        error: err instanceof Error ? err.message : String(err),
        meta: { durationMs: Date.now() - started },
      };
    }

    try {
      const raw = await tool.execute(args);
      return {
        ...raw,
        toolName: call.function.name,
        toolCallId: call.id,
        meta: { durationMs: Date.now() - started, ...(raw.meta ?? {}) },
      };
    } catch (err) {
      return {
        ok: false,
        toolName: call.function.name,
        toolCallId: call.id,
        summary: `${call.function.name} failed`,
        error: err instanceof Error ? err.message : String(err),
        meta: { durationMs: Date.now() - started },
      };
    }
  }

  private errorResult(call: AgentToolCall, message: string): ToolResult {
    return {
      ok: false,
      toolName: call.function.name,
      toolCallId: call.id,
      summary: message,
      error: message,
    };
  }
}

function isReadOnly(tool: AgentTool): boolean {
  return tool.sideEffect === "read";
}
