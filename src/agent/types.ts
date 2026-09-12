import type { ToolDefinition } from "../provider/types.js";

// ─────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────

export type AgentRole = "system" | "user" | "assistant" | "tool";

export interface AgentToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AgentMessage {
  role: AgentRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: AgentToolCall[];
}

// ─────────────────────────────────────────────────────────────
// Tool results
// ─────────────────────────────────────────────────────────────

export interface ToolResult {
  ok: boolean;
  toolName: string;
  toolCallId: string;
  summary: string; // short, human-readable
  data?: unknown; // structured payload
  error?: string; // when ok=false
  meta?: {
    durationMs?: number;
    bytes?: number;
    filesAffected?: string[];
    diff?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Tools (single source of truth)
// ─────────────────────────────────────────────────────────────

export interface AgentTool<Input = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: ToolDefinition["function"]["parameters"];
  /** Tools that only read state can run in parallel */
  sideEffect: "read" | "write" | "exec" | "meta";
  execute(input: Input): Promise<ToolResult>;
}

// ─────────────────────────────────────────────────────────────
// Memory
// ─────────────────────────────────────────────────────────────

export interface AgentMemory {
  goal: string;
  filesRead: Set<string>;
  filesWritten: Set<string>;
  filesDeleted: Set<string>;
  commandsRun: string[];
  errors: string[];
  verification: { passed: boolean; lastRun: string } | null;
  plan: string | null;
}

export function createMemory(goal: string): AgentMemory {
  return {
    goal,
    filesRead: new Set(),
    filesWritten: new Set(),
    filesDeleted: new Set(),
    commandsRun: [],
    errors: [],
    verification: null,
    plan: null,
  };
}

// ─────────────────────────────────────────────────────────────
// Events (agent → UI)
// ─────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "iteration_start"; iteration: number }
  | { type: "assistant_text"; delta: string }
  | { type: "assistant_message"; content: string }
  | {
      type: "tool_call_start";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; result: ToolResult }
  | { type: "error"; message: string }
  | { type: "done"; summary: string; iterations: number };

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

export interface AgentLoopOptions {
  maxIterations: number;
  maxToolRoundsWithoutProgress: number;
  verbose: boolean;
}

export const DEFAULT_LOOP_OPTIONS: AgentLoopOptions = {
  maxIterations: 25,
  maxToolRoundsWithoutProgress: 5,
  verbose: false,
};
