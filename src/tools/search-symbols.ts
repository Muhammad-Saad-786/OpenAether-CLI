import type { Tool, ToolResult } from "./types.js";
import type { SymbolIndex } from "../agent/symbolIndex.js";

type Input = { pattern: string; maxResults?: number };

export class SearchSymbolsTool implements Tool<Input> {
  name = "search_symbols";
  description =
    "Search the symbol index with a regular expression. Returns every symbol whose name matches. Use this for pattern-based discovery, e.g. 'auth.*' or '^User'.";
  sideEffect = "read" as const;
  parameters = {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Regular expression, case-insensitive, e.g. 'auth.*'.",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results (default 50).",
      },
    },
    required: ["pattern"],
  };

  constructor(private readonly index: SymbolIndex) {}

  async execute(input: Input): Promise<ToolResult> {
    if (!input.pattern) {
      return {
        ok: false,
        toolName: "search_symbols",
        toolCallId: "",
        summary: "Pattern is required",
        error: "pattern is required",
      };
    }

    const matches = this.index.search(input.pattern, input.maxResults ?? 50);

    if (matches.length === 0) {
      return {
        ok: true,
        toolName: "search_symbols",
        toolCallId: "",
        summary: `No symbols match '${input.pattern}'`,
        data: { pattern: input.pattern, matches: [] },
      };
    }

    const lines = matches.map(
      (s) => `${s.file}:${s.line}  [${s.kind}]  ${s.name}`,
    );

    return {
      ok: true,
      toolName: "search_symbols",
      toolCallId: "",
      summary: `Found ${matches.length} symbol${matches.length === 1 ? "" : "s"} matching '${input.pattern}'`,
      data: {
        pattern: input.pattern,
        matches: matches.map((s) => ({
          name: s.name,
          file: s.file,
          line: s.line,
          kind: s.kind,
        })),
        formatted: lines.join("\n"),
      },
    };
  }
}
