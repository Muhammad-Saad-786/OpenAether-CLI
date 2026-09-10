import type { ToolResult as AgentToolResult } from "../agent/types.js";

export type ToolResult = AgentToolResult;

export type ToolSideEffect = "read" | "write" | "exec" | "meta";

export type Tool<Input = Record<string, unknown>> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  sideEffect: ToolSideEffect;
  execute(input: Input): Promise<ToolResult>;
};

/**
 * Any tool, regardless of its specific Input type. Used by the registry
 * to store tools with heterogeneous input shapes.
 */
export type AnyTool = Tool<any>;

export function ok(data: unknown, summary?: string): ToolResult {
  return {
    ok: true,
    toolName: "",
    toolCallId: "",
    summary:
      summary ?? (typeof data === "string" ? data : JSON.stringify(data)),
    data,
  };
}

export function fail(error: unknown, summary?: string): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ok: false,
    toolName: "",
    toolCallId: "",
    summary: summary ?? message,
    error: message,
  };
}
