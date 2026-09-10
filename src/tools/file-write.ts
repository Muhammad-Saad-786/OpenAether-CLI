import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { path: string; content: string; overwrite?: boolean };

export class FileWriteTool implements Tool<Input> {
  name = "write_file";
  description =
    "Create a new text file, or replace an existing one. Set overwrite=true only when the file already exists and you intend to replace it.";
  sideEffect = "write" as const;
  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path to the file." },
      content: { type: "string", description: "Complete file content." },
      overwrite: {
        type: "boolean",
        description:
          "Must be true to replace an existing file. Ignored for new files.",
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
        return fail(
          `File already exists at ${input.path}. Set overwrite=true to replace it.`,
          `Refused: ${input.path} exists`,
        );
      }

      const previous = existed ? await fs.readFile(filePath, "utf8") : "";
      await fs.writeFile(filePath, input.content, "utf8");

      const diff = existed ? makeDiff(previous, input.content) : undefined;

      return {
        ok: true,
        toolName: "write_file",
        toolCallId: "",
        summary: `${existed ? "Updated" : "Created"} ${input.path} (${input.content.length} bytes)`,
        data: {
          path: input.path,
          absolutePath: filePath,
          bytes: input.content.length,
          created: !existed,
        },
        meta: {
          bytes: input.content.length,
          filesAffected: [input.path],
          diff,
        },
      };
    } catch (error) {
      return fail(error);
    }
  }
}

function makeDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const out: string[] = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) continue;
    if (b !== undefined) out.push(`- ${b}`);
    if (a !== undefined) out.push(`+ ${a}`);
  }
  return out.join("\n");
}
