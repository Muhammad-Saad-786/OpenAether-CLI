import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

type CheckName = "typecheck" | "lint" | "build" | "test";
type Input = { only?: CheckName[]; cwd?: string };

interface CheckResult {
  name: CheckName;
  command: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

export class VerificationTool implements Tool<Input> {
  name = "run_verification";
  description =
    "Run the project's verification pipeline (typecheck, lint, build, test). Call this BEFORE done whenever you have made code changes. Returns structured pass/fail per check with the exact errors.";
  sideEffect = "exec" as const;
  parameters = {
    type: "object",
    properties: {
      only: {
        type: "array",
        items: {
          type: "string",
          enum: ["typecheck", "lint", "build", "test"],
        },
        description:
          "Optional subset of checks to run. Defaults to all available.",
      },
    },
    required: [],
  };

  async execute(input: Input): Promise<ToolResult> {
    const cwd = input.cwd ?? process.cwd();

    // ─── Detect available checks ──────────────────────────────
    const scripts = await readPackageScripts(cwd);
    const hasTsconfig = await fileExists(path.join(cwd, "tsconfig.json"));

    const plan: Array<{ name: CheckName; command: string }> = [];

    if (hasTsconfig) {
      plan.push({
        name: "typecheck",
        command: "npx --no-install tsc --noEmit",
      });
    } else if (scripts.typecheck) {
      plan.push({ name: "typecheck", command: "npm run typecheck" });
    }

    if (scripts.lint) {
      plan.push({ name: "lint", command: "npm run lint" });
    }
    if (scripts.build) {
      plan.push({ name: "build", command: "npm run build" });
    }
    if (scripts.test) {
      plan.push({ name: "test", command: "npm test -- --runInBand" });
    }

    const requested = input.only?.length
      ? plan.filter((p) => input.only!.includes(p.name))
      : plan;

    if (!requested.length) {
      return {
        ok: true,
        toolName: "run_verification",
        toolCallId: "",
        summary: "No verification checks configured for this project.",
        data: { checks: [] },
      };
    }

    // ─── Run checks ───────────────────────────────────────────
    const results: CheckResult[] = [];
    for (const step of requested) {
      const start = Date.now();
      let passed = true;
      let output = "";

      try {
        const isWindows = process.platform === "win32";
        const shell = isWindows ? "cmd.exe" : "/bin/sh";
        const args = isWindows
          ? ["/d", "/s", "/c", step.command]
          : ["-lc", step.command];

        const { stdout, stderr } = await execFileAsync(shell, args, {
          cwd,
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
        });

        output = `${stdout}${stderr}`.trim() || "(no output)";
      } catch (error) {
        passed = false;
        const e = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        output = `${e.stdout ?? ""}${e.stderr ?? e.message ?? ""}`.trim();
      }

      results.push({
        name: step.name,
        command: step.command,
        passed,
        output: truncate(output, 4000),
        durationMs: Date.now() - start,
      });

      // Stop on first failure — downstream checks can't meaningfully pass
      // if an earlier one failed (build won't pass if typecheck fails).
      if (!passed) break;
    }

    const allPassed = results.every((r) => r.passed);
    const failureCount = results.filter((r) => !r.passed).length;

    const failingFiles = allPassed
      ? []
      : results.flatMap((r) => extractFailingFiles(r.output));

    const summary = allPassed
      ? `All checks passed (${results.length}): ${results.map((r) => r.name).join(", ")}`
      : (() => {
          const unique = [...new Set(failingFiles)];
          if (unique.length > 0) {
            return `${failureCount} of ${results.length} checks failed — files: ${unique.slice(0, 5).join(", ")}${unique.length > 5 ? ` (+${unique.length - 5} more)` : ""}`;
          }
          const firstFail = results.find((r) => !r.passed);
          const snippet = (firstFail?.output ?? "")
            .split("\n")
            .slice(0, 3)
            .join(" / ");
          return `${failureCount} of ${results.length} checks failed — ${snippet || "see errors"}`;
        })();
    return {
      ok: allPassed,
      toolName: "run_verification",
      toolCallId: "",
      summary,
      data: {
        passed: allPassed,
        checks: results,
      },
      error: allPassed ? undefined : summary,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPackageScripts(
  cwd: string,
): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

async function getChangedTsFiles(cwd: string): Promise<string[]> {
  try {
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const args = isWindows
      ? ["/d", "/s", "/c", "git status --porcelain"]
      : ["-lc", "git status --porcelain"];

    const { stdout } = await execFileAsync(shell, args, { cwd });
    return stdout
      .split("\n")
      .map((line) => line.slice(3).trim())
      .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"));
  } catch {
    return [];
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n... [truncated ${s.length - max} chars]`;
}

function extractFailingFiles(output: string): string[] {
  const files = new Set<string>();
  // tsc: src/foo.ts(12,5): error TS1234: ...
  const tscRe = /^([^\s(]+)\(\d+,\d+\):\s*error/gm;
  // eslint: /path/to/foo.ts\n  12:5  error  ...
  const eslintRe = /^\s*(\S+\.(?:ts|tsx|js|jsx|mjs|cjs))\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = tscRe.exec(output)) !== null) files.add(m[1]);
  while ((m = eslintRe.exec(output)) !== null) {
    // only keep paths that look like file paths (contain / or \)
    if (m[1].includes("/") || m[1].includes("\\")) files.add(m[1]);
  }
  return [...files];
}
