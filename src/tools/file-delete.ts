import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { path: string; confirm?: boolean };

export class FileDeleteTool implements Tool<Input> {
  name = "delete_file";
  description =
    "Delete one file inside the current workspace. Requires confirm=true.";
  sideEffect = "write" as const;

  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      confirm: { type: "boolean", description: "Explicitly confirm deletion" },
    },
    required: ["path", "confirm"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      if (input.confirm !== true) return fail("Deletion requires confirm=true");
      const filePath = workspacePath(input.path);
      const workspaceRoot = path.resolve(process.cwd());
      if (filePath === workspaceRoot)
        return fail("Refusing to delete the workspace");
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return fail("Refusing to delete a directory");
      await fs.unlink(filePath);
      return ok(`Deleted ${filePath}`);
    } catch (error) {
      return fail(error);
    }
  }
}
