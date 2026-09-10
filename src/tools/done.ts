import type { Tool, ToolResult } from "./types.js";

interface Input {
  summary: string;
}

export class DoneTool implements Tool<Input> {
  name = "done";
  description =
    "Signal that the task is complete. The summary must be a short, natural-language sentence describing what was accomplished (e.g. 'Created greet.ts' or 'Listed src — 12 entries'). Never put JSON in the summary.";
  sideEffect = "meta" as const;
  parameters = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Short summary of what was accomplished.",
      },
    },
    required: ["summary"],
  };

  async execute(input: Input): Promise<ToolResult> {
    const summary = (input?.summary ?? "Task completed").trim();
    return {
      ok: true,
      toolName: "done",
      toolCallId: "",
      summary,
      data: { summary },
    };
  }
}
