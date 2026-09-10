import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = {
  pattern: string;
  path?: string;
  ignoreCase?: boolean;
  maxResults?: number;
};

const ignored = new Set([".git", "node_modules", "dist", ".next", "build"]);

async function filesIn(dir: string, result: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await filesIn(fullPath, result);
    else result.push(fullPath);
  }
  return result;
}

export class GrepTool implements Tool<Input> {
  name = "grep";
  description =
    "Search files with a regular expression and return matching lines with file and line number.";
  sideEffect = "read" as const;
  parameters = {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression pattern." },
      path: {
        type: "string",
        description: "File or directory to search (default: .)",
      },
      ignoreCase: { type: "boolean" },
      maxResults: {
        type: "number",
        description: "Maximum matches (default 100)",
      },
    },
    required: ["pattern"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const target = workspacePath(input.path ?? ".");
      const stat = await fs.stat(target);
      const candidates = stat.isDirectory() ? await filesIn(target) : [target];
      const expression = new RegExp(input.pattern, input.ignoreCase ? "i" : "");
      const max = input.maxResults ?? 100;
      const matches: string[] = [];

      for (const filePath of candidates) {
        let lines: string[];
        try {
          lines = (await fs.readFile(filePath, "utf8")).split(/\r?\n/);
        } catch {
          continue;
        }
        for (let i = 0; i < lines.length; i++) {
          if (expression.test(lines[i])) {
            matches.push(
              `${path.relative(process.cwd(), filePath).replaceAll("\\", "/")}:${i + 1}: ${lines[i]}`,
            );
            if (matches.length >= max) break;
          }
        }
        if (matches.length >= max) break;
      }

      return {
        ok: true,
        toolName: "grep",
        toolCallId: "",
        summary: `Found ${matches.length} match${matches.length === 1 ? "" : "es"}`,
        data: { pattern: input.pattern, matches },
      };
    } catch (error) {
      return fail(error);
    }
  }
}
