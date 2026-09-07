import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function gitContext(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["status", "--short", "--branch"],
      { cwd },
    );
    return stdout.trim() || "not a Git repository";
  } catch {
    return "not a Git repository";
  }
}

export async function buildContext(cwd = process.cwd()): Promise<string> {
  const parts = [
    `Working directory: ${cwd}`,
    `Platform: ${process.platform} (${os.arch()})`,
    `Shell: ${process.env.SHELL ?? process.env.ComSpec ?? "unknown"}`,
    `Git: ${await gitContext(cwd)}`,
    "You are a practical coding assistant. Use tools when they help.",
  ];
  try {
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    parts.push(
      `Directory entries: ${entries
        .slice(0, 100)
        .map((entry) => `${entry.isDirectory() ? "[dir] " : ""}${entry.name}`)
        .join(", ")}`,
    );
  } catch {
    parts.push("Directory entries: unavailable");
  }
  for (const name of ["AGENTS.md", "OPENAETHER.md", "README.md"]) {
    try {
      parts.push(
        `\n--- ${name} ---\n${await fs.readFile(path.join(cwd, name), "utf8")}`,
      );
    } catch {
      /* optional context */
    }
  }
  return parts.join("\n");
}
