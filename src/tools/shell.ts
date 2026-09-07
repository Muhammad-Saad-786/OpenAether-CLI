import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export async function runShell(command: string): Promise<string> {
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", command]
      : ["-lc", command];
  const result = await exec(shell, args, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024,
  });
  return `${result.stdout}${result.stderr}`.trim();
}
