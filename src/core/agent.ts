import chalk from "chalk";
import type { QueryEngine } from "./engine.js";
import { getBudgetSnapshot, type TokenBudgetAllocation } from "./budget.js";
import {
  formatProjectMap,
  inspectProject,
  type ProjectMap,
} from "./project.js";
import {
  formatVerification,
  verifyProject,
  type VerificationResult,
} from "./verifier.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AgentRunResult {
  project: ProjectMap;
  verification: VerificationResult;
  budget: ReturnType<typeof getBudgetSnapshot>;
  plan: string;
  diff: string;
}

export async function runAgent(
  engine: QueryEngine,
  task: string,
  budget: TokenBudgetAllocation,
  cwd = process.cwd(),
): Promise<AgentRunResult> {
  const project = await inspectProject(cwd);
  const context = formatProjectMap(project);
  const plan = await engine.submit(
    `Plan this coding task in no more than five concise steps. Do not edit files yet.\n\nTask: ${task}\n\n${context}`,
  );
  console.log(chalk.cyan("\nPlan:"), plan.trim());

  let verification: VerificationResult = { passed: false, checks: [] };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const instruction =
      attempt === 1
        ? `Implement the task below. Inspect relevant files first, use the available tools to make the changes, and keep working until the implementation is complete.\n\nTask: ${task}\nPlan:\n${plan}`
        : `Verification failed. Fix the implementation using the tool results below, then re-run or reason through the affected checks.\n\n${formatVerification(verification)}`;
    await engine.submit(instruction);
    const refreshedProject = await inspectProject(cwd);
    verification = await verifyProject(refreshedProject, cwd);
    console.log(
      `\nVerification attempt ${attempt}:\n${formatVerification(verification)}`,
    );
    if (verification.passed) break;
  }

  return {
    project,
    verification,
    budget: getBudgetSnapshot(context, task, engine.messages, budget),
    plan,
    diff: await getDiff(cwd),
  };
}

async function getDiff(cwd: string): Promise<string> {
  try {
    const result = await execFileAsync("git", ["diff", "--stat"], { cwd });
    return result.stdout.trim() || "No Git diff available.";
  } catch {
    return "No Git diff available.";
  }
}
