import { BashTool } from "./bash.js";
import { FileEditTool } from "./file-edit.js";
import { FileReadTool } from "./file-read.js";
import { GlobTool } from "./glob.js";
import { GrepTool } from "./grep.js";
import { MergeTool } from "./merge.js";
import { FileWriteTool } from "./file-write.js";
import { FileDeleteTool } from "./file-delete.js";
import { DoneTool } from "./done.js";
import { WritePlanTool } from "./write-plan.js";
import type { AnyTool, Tool } from "./types.js";
import { FileMoveTool } from "./file-move.js";
import { ListDirTool } from "./list-dir.js";

export class ToolRegistry {
  private readonly tools = new Map<string, AnyTool>();

  constructor() {
    for (const tool of [
      new FileReadTool(),
      new FileWriteTool(),
      new FileDeleteTool(),
      new FileEditTool(),
      new FileMoveTool(),
      new ListDirTool(),
      new GrepTool(),
      new GlobTool(),
      new BashTool(),
      new MergeTool(),
      new WritePlanTool(),
      new DoneTool(),
    ]) {
      this.register(tool);
    }
  }

  register(tool: AnyTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  getAll(): AnyTool[] {
    return [...this.tools.values()];
  }

  toOpenAIFormat(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getAll().map((tool) => ({
      type: "function" as const,
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
    return result.ok
      ? typeof result.data === "string"
        ? result.data
        : result.summary
      : `Tool error: ${result.error ?? "unknown error"}`;
  }
}

export const toolRegistry = new ToolRegistry();
