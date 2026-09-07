import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

type Input = { path: string; offset?: number; limit?: number };
const binaryExtensions = new Set([
  ".7z",
  ".bin",
  ".class",
  ".dll",
  ".exe",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".png",
  ".so",
  ".zip",
]);

function isBinary(filePath: string, buffer: Buffer): boolean {
  if (binaryExtensions.has(path.extname(filePath).toLowerCase())) return true;
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

export class FileReadTool implements Tool<Input> {
  name = "read_file";
  description =
    "Read a text file with line numbers. Use offset and limit for large files.";
  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      offset: { type: "number", description: "One-based line to start from" },
      limit: { type: "number", description: "Maximum number of lines" },
    },
    required: ["path"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const filePath = path.resolve(input.path);
      const buffer = await fs.readFile(filePath);
      if (isBinary(filePath, buffer)) return ok(`[Binary file: ${filePath}]`);
      const lines = buffer
        .toString("utf8")
        .replaceAll("\r\n", "\n")
        .split("\n");
      const start = Math.max(0, (input.offset ?? 1) - 1);
      const end =
        input.limit === undefined
          ? lines.length
          : start + Math.max(0, input.limit);
      const content = lines
        .slice(start, end)
        .map((line, index) => `${start + index + 1}\t${line}`)
        .join("\n");
      return ok(content);
    } catch (error) {
      return fail(error);
    }
  }
}
