import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);
type Input = { command: string; timeoutMs?: number };

export class BashTool implements Tool<Input> {
  name = "bash";
  description = "Execute a shell command in the working directory.";
  sideEffect = "exec" as const;

  parameters = {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
      timeoutMs: { type: "number", description: "Timeout in milliseconds" },
    },
    required: ["command"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
      const args =
        process.platform === "win32"
          ? ["/d", "/s", "/c", input.command]
          : ["-lc", input.command];
      const result = await execFileAsync(shell, args, {
        cwd: process.cwd(),
        timeout: input.timeoutMs ?? 30_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return ok(
        `${result.stdout}${result.stderr}`.trim() ||
          "(command completed without output)",
      );
    } catch (error) {
      return fail(error);
    }
  }
}
