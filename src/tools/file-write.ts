import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = {
  path: string;
  content: string;
  overwrite?: boolean;
  force?: boolean;
};

const BANNED_DIRECTIVES = [
  { pattern: /@ts-nocheck/, name: "@ts-nocheck" },
  { pattern: /@ts-ignore/, name: "@ts-ignore" },
  { pattern: /@ts-expect-error/, name: "@ts-expect-error" },
  { pattern: /\/\*\s*eslint-disable\s*\*\//, name: "blanket eslint-disable" },
];

function findBannedDirective(content: string): string | null {
  for (const { pattern, name } of BANNED_DIRECTIVES) {
    if (pattern.test(content)) return name;
  }
  return null;
}

export class FileWriteTool implements Tool<Input> {
  name = "write_file";
  description =
    "Create a new text file or replace an existing one. Set overwrite=true to replace an existing file. " +
    "IMPORTANT: by default this tool rejects content containing @ts-ignore, @ts-nocheck, @ts-expect-error, or blanket eslint-disable. " +
    "If the user EXPLICITLY asks for these directives, pass force=true to allow them. " +
    "Never use force=true to work around your own mistakes — fix the code instead.";
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
      force: {
        type: "boolean",
        description:
          "Set to true ONLY if the user explicitly requested a suppressed directive. Otherwise leave unset.",
      },
    },
    required: ["path", "content"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      // 1. Banned-directive check — BEFORE touching the filesystem.
      if (input.force !== true) {
        const banned = findBannedDirective(input.content);
        if (banned) {
          return fail(
            `Refused to write ${input.path}: content contains banned directive "${banned}". ` +
              `Fix the underlying problem instead of suppressing it. ` +
              `If the user explicitly asked for this directive, set force=true.`,
            `Banned directive: ${banned}`,
          );
        }
      }

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
