import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = { pattern: string; path?: string; maxResults?: number };

const ignored = new Set([".git", "node_modules", "dist", ".next", "build"]);

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
  description =
    "Find files by a glob pattern such as 'src/**/*.ts'. Returns paths relative to the workspace root.";
  sideEffect = "read" as const;
  parameters = {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob such as src/**/*.ts" },
      path: { type: "string", description: "Directory to search (default: .)" },
      maxResults: {
        type: "number",
        description: "Maximum results (default 100)",
      },
    },
    required: ["pattern"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const root = workspacePath(input.path ?? ".");
      const regex = globRegex(input.pattern.replaceAll("\\", "/"));
      const files = (await walk(root))
        .map((file) => path.relative(process.cwd(), file).replaceAll("\\", "/"))
        .filter((file) => regex.test(file))
        .slice(0, input.maxResults ?? 100);

      return {
        ok: true,
        toolName: "glob",
        toolCallId: "",
        summary: `Found ${files.length} file${files.length === 1 ? "" : "s"}`,
        data: { pattern: input.pattern, files },
      };
    } catch (error) {
      return fail(error);
    }
  }
}
