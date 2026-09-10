import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { path: string; content: string; overwrite?: boolean };

export class FileWriteTool implements Tool<Input> {
  name = "write_file";
  description =
    "Create a text file or overwrite an existing file when explicitly allowed.";
  sideEffect = "write" as const;

  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      content: { type: "string", description: "Complete file content" },
      overwrite: {
        type: "boolean",
        description: "Allow replacing an existing file (default: false)",
      },
    },
    required: ["path", "content"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const filePath = workspacePath(input.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const existed = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      if (existed && input.overwrite !== true) {
        return fail("File already exists; set overwrite=true to replace it");
      }
      await fs.writeFile(filePath, input.content, "utf8");
      return ok(`${existed ? "Updated" : "Created"} ${filePath}`);
    } catch (error) {
      return fail(error);
    }
  }
}
