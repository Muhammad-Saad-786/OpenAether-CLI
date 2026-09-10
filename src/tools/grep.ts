import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

type Input = {
  pattern: string;
  path?: string;
  ignoreCase?: boolean;
  maxResults?: number;
};
const ignored = new Set([".git", "node_modules", "dist"]);

async function filesIn(
  directory: string,
  result: string[] = [],
): Promise<string[]> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await filesIn(fullPath, result);
    else result.push(fullPath);
  }
  return result;
}

export class GrepTool implements Tool<Input> {
  name = "grep";
  description = "Search text files with a regular expression and line numbers.";
  sideEffect = "read" as const;

  parameters = {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression pattern" },
      path: { type: "string", description: "File or directory to search" },
      ignoreCase: { type: "boolean" },
      maxResults: { type: "number" },
    },
    required: ["pattern"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const target = path.resolve(input.path ?? ".");
      const stat = await fs.stat(target);
      const candidates = stat.isDirectory() ? await filesIn(target) : [target];
      const expression = new RegExp(input.pattern, input.ignoreCase ? "i" : "");
      const matches: string[] = [];
      for (const filePath of candidates) {
        let lines: string[];
        try {
          lines = (await fs.readFile(filePath, "utf8")).split(/\r?\n/);
        } catch {
          continue;
        }
        lines.forEach((line, index) => {
          if (expression.test(line))
            matches.push(
              `${path.relative(process.cwd(), filePath)}:${index + 1}: ${line}`,
            );
        });
        if (matches.length >= (input.maxResults ?? 100)) break;
      }
      return ok(
        matches.slice(0, input.maxResults ?? 100).join("\n") ||
          "No matches found.",
      );
    } catch (error) {
      return fail(error);
    }
  }
}
