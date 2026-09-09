import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectMap } from "./project.js";

const execFileAsync = promisify(execFile);

export interface VerificationResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; output: string }>;
}

function commandFor(script: string): string {
  return script === "install"
    ? "npm install --ignore-scripts --no-audit --no-fund"
    : `npm run ${script} --if-present`;
}

export async function verifyProject(
  project: ProjectMap,
  cwd = project.cwd,
): Promise<VerificationResult> {
  const scripts = project.packageScripts.length
    ? ["install", "build", "test", "lint"].filter(
        (script) =>
          script === "install" || project.packageScripts.includes(script),
      )
    : [];
  if (!scripts.length) {
    return {
      passed: true,
      checks: [
        {
          name: "verification",
          passed: true,
          output: "No build, test, or lint scripts configured.",
        },
      ],
    };
  }

  const checks: VerificationResult["checks"] = [];
  for (const script of scripts) {
    try {
      const result = await execFileAsync(
        process.platform === "win32" ? "cmd.exe" : "/bin/sh",
        process.platform === "win32"
          ? ["/d", "/s", "/c", commandFor(script)]
          : ["-lc", commandFor(script)],
        { cwd, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      );
      checks.push({
        name: script,
        passed: true,
        output: `${result.stdout}${result.stderr}`.trim(),
      });
    } catch (error) {
      const failed = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      checks.push({
        name: script,
        passed: false,
        output:
          `${failed.stdout ?? ""}${failed.stderr ?? failed.message ?? ""}`.trim(),
      });
      break;
    }
  }
  return { passed: checks.every((check) => check.passed), checks };
}

export function formatVerification(result: VerificationResult): string {
  return result.checks
    .map(
      (check) =>
        `${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.output}`,
    )
    .join("\n");
}
