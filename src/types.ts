// Re-export unified types from the new agent module.
export type {
  AgentMessage as Message,
  AgentToolCall as ToolUse,
  ToolResult,
  AgentTool,
  AgentMemory,
  AgentEvent,
} from "./agent/types.js";

export { createMemory } from "./agent/types.js";

// Legacy TaskType / Plan / ExecutionContext — kept for old code paths
// during migration. Remove once the old pipeline is deleted.
export enum TaskType {
  SIMPLE_CHAT = "SIMPLE_CHAT",
  SIMPLE_CODE = "SIMPLE_CODE",
  REPOSITORY_EDIT = "REPOSITORY_EDIT",
  PROJECT_TASK = "PROJECT_TASK",
}

export interface PlanStep {
  tool: string;
  args?: Record<string, any>;
  reason?: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
  response?: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; details?: string }>;
}

export interface ExecutionContext {
  cwd: string;
}
