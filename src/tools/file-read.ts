import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

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

interface CacheEntry {
  mtimeMs: number;
  content: string;
}

const readCache = new Map<string, CacheEntry>();

export class FileReadTool implements Tool<Input> {
  name = "read_file";
  description =
    "Read a text file with line numbers. Use offset and limit for large files. If the file has not changed since a previous read in this session, the response will say so and repeat the cached content — do not read it again.";
  sideEffect = "read" as const;
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
      const filePath = workspacePath(input.path);
      const stat = await fs.stat(filePath);
      const cached = readCache.get(filePath);

      // Fast path: file unchanged since last read.
      if (cached && cached.mtimeMs === stat.mtimeMs) {
        return {
          ok: true,
          toolName: "read_file",
          toolCallId: "",
          summary: `read_file ${input.path} (unchanged since last read)`,
          data: {
            path: input.path,
            content: cached.content,
            cached: true,
            note: "This file has not changed since the last time you read it. Do not read it again unless you edit it.",
          },
        };
      }

      const buffer = await fs.readFile(filePath);
      if (isBinary(filePath, buffer)) {
        return {
          ok: true,
          toolName: "read_file",
          toolCallId: "",
          summary: `[Binary file: ${input.path}]`,
          data: { path: input.path, binary: true },
        };
      }

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

      // Only cache full-file reads (no offset/limit) to keep it simple.
      if (input.offset === undefined && input.limit === undefined) {
        readCache.set(filePath, { mtimeMs: stat.mtimeMs, content });
      }

      return {
        ok: true,
        toolName: "read_file",
        toolCallId: "",
        summary: `read_file ${input.path} (${lines.length} lines)`,
        data: { path: input.path, content, lines: lines.length },
      };
    } catch (error) {
      return fail(error);
    }
  }
}

export function invalidateReadCache(filePath: string): void {
  readCache.delete(filePath);
}

export function invalidateAllReadCache(): void {
  readCache.clear();
}
