import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

type Input = { path: string; confirm?: boolean };

export class FileDeleteTool implements Tool<Input> {
  name = "delete_file";
  description =
    "Delete one file inside the current workspace. Requires confirm=true.";
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
      const workspaceRoot = path.resolve(process.cwd());
      const filePath = path.resolve(input.path);
      if (
        filePath === workspaceRoot ||
        !filePath.startsWith(`${workspaceRoot}${path.sep}`)
      ) {
        return fail("Refusing to delete outside the current workspace");
      }
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) return fail("Refusing to delete a directory");
      await fs.unlink(filePath);
      return ok(`Deleted ${filePath}`);
    } catch (error) {
      return fail(error);
    }
  }
}
