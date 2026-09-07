import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

type Input = { pattern: string; path?: string; maxResults?: number };
const ignored = new Set([".git", "node_modules", "dist"]);

async function walk(
  directory: string,
  result: string[] = [],
): Promise<string[]> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath, result);
    else result.push(fullPath);
  }
  return result;
}

function globRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "{{DOUBLE}}")
    .replaceAll("*", "[^/]*")
    .replaceAll("{{DOUBLE}}", ".*")
    .replaceAll("?", "[^/]");
  return new RegExp(`^${escaped}$`, "i");
}

export class GlobTool implements Tool<Input> {
  name = "glob";
  description = "Find files by a glob pattern.";
  parameters = {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob such as src/**/*.ts" },
      path: { type: "string", description: "Directory to search" },
      maxResults: { type: "number" },
    },
    required: ["pattern"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const root = path.resolve(input.path ?? ".");
      const regex = globRegex(input.pattern.replaceAll("\\", "/"));
      const files = (await walk(root))
        .map((file) => path.relative(root, file).replaceAll("\\", "/"))
        .filter((file) => regex.test(file))
        .slice(0, input.maxResults ?? 100);
      return ok(files.join("\n") || "No files found.");
    } catch (error) {
      return fail(error);
    }
  }
}
