import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { from: string; to: string; overwrite?: boolean };

export class FileMoveTool implements Tool<Input> {
  name = "move_file";
  description = "Move or rename a file inside the workspace.";
  sideEffect = "write" as const;
  parameters = {
    type: "object",
    properties: {
      from: { type: "string", description: "Source path." },
      to: { type: "string", description: "Destination path." },
      overwrite: {
        type: "boolean",
        description: "Overwrite destination if it exists.",
      },
    },
    required: ["from", "to"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const src = workspacePath(input.from);
      const dest = workspacePath(input.to);

      const destExists = await fs
        .stat(dest)
        .then(() => true)
        .catch(() => false);

      if (destExists && input.overwrite !== true) {
        return fail(
          `Destination ${input.to} exists. Set overwrite=true to replace it.`,
          `Refused: ${input.to} exists`,
        );
      }

      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.rename(src, dest);

      return {
        ok: true,
        toolName: "move_file",
        toolCallId: "",
        summary: `Moved ${input.from} → ${input.to}`,
        data: { from: input.from, to: input.to },
        meta: { filesAffected: [input.from, input.to] },
      };
    } catch (error) {
      return fail(error);
    }
  }
}
