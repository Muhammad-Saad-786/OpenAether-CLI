import type { Tool, ToolResult } from "./types.js";

interface Input {
  summary: string;
}

export class DoneTool implements Tool<Input> {
  name = "done";
  description =
    "Call this when the user's request has been fully completed. Provide a short summary of what was done. This is the ONLY way to signal completion.";
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
