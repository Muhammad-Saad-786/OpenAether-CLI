import type { ToolDefinition } from "../provider/types.js";
import { BashTool } from "./bash.js";
import { FileEditTool } from "./file-edit.js";
import { FileReadTool } from "./file-read.js";
import { GlobTool } from "./glob.js";
import { GrepTool } from "./grep.js";
import { MergeTool } from "./merge.js";
import { FileWriteTool } from "./file-write.js";
import type { Tool } from "./types.js";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  constructor() {
    for (const tool of [
      new FileReadTool(),
      new FileWriteTool(),
      new FileEditTool(),
      new GrepTool(),
      new GlobTool(),
      new BashTool(),
      new MergeTool(),
    ]) {
      this.register(tool);
    }
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return [...this.tools.values()];
  }

  toOpenAIFormat(): any[] {
    return this.getAll().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async execute(name: string, input: Record<string, unknown>): Promise<string> {
    const tool = this.get(name);
    if (!tool) return `Unknown tool: ${name}`;
    const result = await tool.execute(input);
    return result.success
      ? result.content
      : `Tool error: ${result.error ?? "unknown error"}`;
  }
}

export const toolRegistry = new ToolRegistry();
export const toolDefinitions = toolRegistry.toOpenAIFormat();
export const executeTool = (name: string, args: Record<string, unknown>) =>
  toolRegistry.execute(name, args);
