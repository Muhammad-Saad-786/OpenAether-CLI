import type { Tool, ToolResult } from "./types.js";
import type { SymbolIndex } from "../agent/symbolIndex.js";

type Input = { name: string };

export class FindSymbolTool implements Tool<Input> {
  name = "find_symbol";
  description =
    "Find where a symbol (function, class, type, const) is defined in the workspace. Returns file paths with line numbers. Use this instead of grep when you know the name of the symbol you want to locate.";
  sideEffect = "read" as const;
  parameters = {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Exact symbol name, e.g. 'authenticateToken' or 'UserService'.",
      },
    },
    required: ["name"],
  };

  constructor(private readonly index: SymbolIndex) {}

  async execute(input: Input): Promise<ToolResult> {
    if (!input.name || !input.name.trim()) {
      return {
        ok: false,
        toolName: "find_symbol",
        toolCallId: "",
        summary: "Symbol name is required",
        error: "symbol name is required",
      };
    }

    const matches = this.index.find(input.name.trim());

    if (matches.length === 0) {
      return {
        ok: true,
        toolName: "find_symbol",
        toolCallId: "",
        summary: `No definitions found for '${input.name}'`,
        data: { name: input.name, matches: [] },
      };
    }

    const lines = matches.map(
      (s) => `${s.file}:${s.line}  [${s.kind}]  ${s.signature ?? s.name}`,
    );

    return {
      ok: true,
      toolName: "find_symbol",
      toolCallId: "",
      summary: `Found ${matches.length} definition${matches.length === 1 ? "" : "s"} for '${input.name}'`,
      data: {
        name: input.name,
        matches: matches.map((s) => ({
          file: s.file,
          line: s.line,
          kind: s.kind,
          exported: s.exported,
          signature: s.signature,
        })),
        formatted: lines.join("\n"),
      },
    };
  }
}
