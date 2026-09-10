import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { path?: string };

export class ListDirTool implements Tool<Input> {
  name = "list_dir";
  description =
    "List files and directories at a path. Directories are suffixed with /. After calling this, include the entries in your final response to the user.";
  sideEffect = "read" as const;
  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path (default: .)" },
    },
    required: [],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const dir = workspacePath(input.path ?? ".");
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const listing = entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort();

      return {
        ok: true,
        toolName: "list_dir",
        toolCallId: "",
        summary: `Listed ${listing.length} entr${listing.length === 1 ? "y" : "ies"} in ${input.path ?? "."}`,
        data: { path: input.path ?? ".", entries: listing },
      };
    } catch (error) {
      return fail(error);
    }
  }
}
