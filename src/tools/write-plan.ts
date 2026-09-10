import type { Tool, ToolResult } from "./types.js";

interface Input {
  goal: string;
  steps: string[];
}

export class WritePlanTool implements Tool<Input> {
  name = "write_plan";
  description =
    "Record a multi-step plan for the current task. Use this BEFORE starting a complex task (implementing a feature, refactoring, multi-file changes). The plan is stored in memory and shown on every subsequent iteration.";
  sideEffect = "meta" as const;
  parameters = {
    type: "object",
    properties: {
      goal: { type: "string", description: "One-line goal of the task." },
      steps: {
        type: "array",
        items: { type: "string" },
        description: "Ordered list of concrete steps.",
      },
    },
    required: ["goal", "steps"],
  };

  async execute(input: Input): Promise<ToolResult> {
    const goal = String(input?.goal ?? "").trim();
    const steps = Array.isArray(input?.steps) ? input.steps.map(String) : [];
    const plan = `Goal: ${goal}\nSteps:\n${steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`;
    return {
      ok: true,
      toolName: "write_plan",
      toolCallId: "",
      summary: `Plan recorded (${steps.length} steps)`,
      data: { goal, steps, plan },
    };
  }
}
