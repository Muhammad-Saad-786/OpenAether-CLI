import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail, type Tool, type ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

type Input = { command: string; timeoutMs?: number };

const BLOCKED = [
  /\brm\s+-rf\s+\/(?!\w)/, // rm -rf / and variants
  /\brm\s+-rf\s+~/, // rm -rf ~
  /\bformat\s+[a-z]:/i, // Windows format
  /\bmkfs\b/i, // mkfs
  /\bdd\s+if=/i, // dd
  /:\(\)\s*\{.*\};:/, // fork bomb
  /\bshutdown\b/i,
  /\breboot\b/i,
  />\s*\/dev\/sd[a-z]/i,
];

export class BashTool implements Tool<Input> {
  name = "bash";
  description =
    "Run a shell command in the workspace. Output is truncated to 8000 characters.";
  sideEffect = "exec" as const;
  parameters = {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute." },
      timeoutMs: {
        type: "number",
        description: "Timeout in ms (default 30000).",
      },
    },
    required: ["command"],
  };

  async execute(input: Input): Promise<ToolResult> {
    const command = input.command?.trim();
    if (!command) return fail("command must not be empty");

    for (const pattern of BLOCKED) {
      if (pattern.test(command)) {
        return fail(
          `Refused to run blocked command: ${command}`,
          "Command blocked by safety policy",
        );
      }
    }

    try {
      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
      const args =
        process.platform === "win32"
          ? ["/d", "/s", "/c", command]
          : ["-lc", command];

      const result = await execFileAsync(shell, args, {
        cwd: process.cwd(),
        timeout: input.timeoutMs ?? 30_000,
        maxBuffer: 2 * 1024 * 1024,
      });

      const combined = `${result.stdout}${result.stderr}`.trim();
      const truncated =
        combined.length > 8000
          ? combined.slice(0, 8000) +
            `\n... [truncated, ${combined.length - 8000} more chars]`
          : combined;

      return {
        ok: true,
        toolName: "bash",
        toolCallId: "",
        summary: combined ? `Ran: ${command}` : `Ran (no output): ${command}`,
        data: {
          command,
          output: truncated || "(no output)",
        },
        meta: { bytes: combined.length },
      };
    } catch (error: unknown) {
      const e = error as { stdout?: string; stderr?: string; message?: string };
      const out = `${e.stdout ?? ""}${e.stderr ?? e.message ?? ""}`.trim();
      return fail(out || "Command failed", `Failed: ${command}`);
    }
  }
}
