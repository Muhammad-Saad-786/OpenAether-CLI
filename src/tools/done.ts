import type { Tool, ToolResult } from "./types.js";

interface Input {
  summary: string;
}

export class DoneTool implements Tool<Input> {
  name = "done";
  description =
    "Signal that the task is complete. The summary must be a ONE-LINE status like 'Created greet.ts' or 'Fixed the type error'. Do NOT put the user-facing answer in the summary — write the answer as a normal assistant message before calling done.";
  sideEffect = "meta" as const;
  parameters = {
    type: "object",
    properties: {
      status: {
        type: "string",
        description:
          "One-line completion status, e.g. 'Listed src' or 'Fixed type error in broken.ts'. Do NOT put the answer to the user's question here — put that in your assistant message before calling done.",
      },
    },
    required: ["status"],
  };

  async execute(input: {
    status?: string;
    summary?: string;
  }): Promise<ToolResult> {
    const status = (input.status ?? input.summary ?? "Task completed").trim();
    return {
      ok: true,
      toolName: "done",
      toolCallId: "",
      summary: status,
      data: { summary: status, status },
    };
  }
}
