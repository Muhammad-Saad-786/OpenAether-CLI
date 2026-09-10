import chalk from "chalk";
import type { Config } from "../config.js";
import { toolRegistry } from "../tools/registry.js";
import { AgentSession } from "./AgentSession.js";
import { AgentLoop } from "./AgentLoop.js";
import { getAgentProvider } from "./providerAdapter.js";
import { SYSTEM_PROMPT } from "../conversation/prompts.js";
import type { AgentEvent } from "./types.js";

export async function runAgentHeadless(
  config: Config,
  prompt: string,
): Promise<void> {
  const session = new AgentSession(
    toolRegistry,
    {
      systemPrompt: SYSTEM_PROMPT,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    },
    prompt,
  );

  const provider = getAgentProvider(config);
  const loop = new AgentLoop(session, provider);

  for await (const event of loop.run(prompt)) {
    renderEvent(event);
  }
}

function renderEvent(event: AgentEvent): void {
  switch (event.type) {
    case "iteration_start":
      if (event.iteration > 1) {
        console.log(chalk.gray(`\n── iteration ${event.iteration} ──`));
      }
      break;

    case "assistant_text":
      process.stdout.write(event.delta);
      break;

    case "assistant_message":
      process.stdout.write("\n");
      break;

    case "tool_call_start":
      console.log(
        chalk.cyan(`\n→ ${event.toolName}`) +
          chalk.gray(` ${formatArgs(event.args)}`),
      );
      break;

    case "tool_result": {
      const r = event.result;
      if (r.ok) {
        console.log(chalk.green(`  ✓ ${r.summary}`));
      } else {
        console.log(chalk.red(`  ✗ ${r.error ?? r.summary}`));
      }
      break;
    }

    case "error":
      console.error(chalk.red(`Error: ${event.message}`));
      break;

    case "done":
      console.log(chalk.gray(`\n── done (${event.iterations} iterations) ──`));
      break;
  }
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (!entries.length) return "";
  return entries
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      const short = s.length > 60 ? s.slice(0, 57) + "..." : s;
      return `${k}=${short}`;
    })
    .join(" ");
}
