import { spawn, type ChildProcess } from "node:child_process";
import { fail, type Tool, type ToolResult } from "./types.js";

const servers = new Map<number, ChildProcess>();

type Input = {
  action: "start" | "stop" | "status";
  command?: string;
  port?: number;
  url?: string;
};

export class DevServerTool implements Tool<Input> {
  name = "dev_server";
  description =
    "Manage a local frontend dev server. Start, stop, or check a server before browser inspection.";
  sideEffect = "exec" as const;
  parameters = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["start", "stop", "status"] },
      command: { type: "string", description: "Command such as npm run dev." },
      port: { type: "number", description: "Port exposed by the server." },
      url: {
        type: "string",
        description: "URL to probe, defaults to localhost:port.",
      },
    },
    required: ["action"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const port = input.port ?? 3000;
      if (input.action === "status") {
        const url = input.url ?? `http://127.0.0.1:${port}`;
        const response = await fetch(url).catch(() => null);
        return {
          ok: Boolean(response?.ok),
          toolName: this.name,
          toolCallId: "",
          summary: response?.ok
            ? `Server is ready at ${url}`
            : `No server responded at ${url}`,
          data: {
            url,
            running: Boolean(response?.ok),
            status: response?.status ?? null,
          },
        };
      }

      if (input.action === "stop") {
        const child = servers.get(port);
        if (!child?.pid)
          return fail(`No OpenAether server is tracked on port ${port}`);
        child.kill();
        servers.delete(port);
        return {
          ok: true,
          toolName: this.name,
          toolCallId: "",
          summary: `Stopped dev server on port ${port}`,
          data: { port },
        };
      }

      if (!input.command?.trim())
        return fail("command is required when action=start");
      if (servers.has(port))
        return fail(`A server is already tracked on port ${port}`);

      const child = spawn(input.command, {
        cwd: process.cwd(),
        shell: true,
        windowsHide: true,
        stdio: "ignore",
      });
      servers.set(port, child);
      const url = input.url ?? `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) {
          servers.delete(port);
          return fail(
            `Dev server exited before becoming ready (code ${child.exitCode})`,
          );
        }
        const response = await fetch(url).catch(() => null);
        if (response?.ok) {
          return {
            ok: true,
            toolName: this.name,
            toolCallId: "",
            summary: `Dev server ready at ${url}`,
            data: { url, port, pid: child.pid },
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return fail(`Dev server did not respond at ${url} within 15 seconds`);
    } catch (error) {
      return fail(error);
    }
  }
}

export function stopTrackedServers(): void {
  for (const child of servers.values()) child.kill();
  servers.clear();
}
