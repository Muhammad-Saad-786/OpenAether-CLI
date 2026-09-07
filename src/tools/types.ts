import type { ToolDefinition } from "../provider/types.js";

export type ToolResult = {
  success: boolean;
  content: string;
  error?: string;
};

export type Tool<Input = Record<string, unknown>> = {
  name: string;
  description: string;
  parameters: ToolDefinition["function"]["parameters"];
  execute(input: Input): Promise<ToolResult>;
};

export function ok(content: string): ToolResult {
  return { success: true, content };
}

export function fail(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, content: "", error: message };
}
