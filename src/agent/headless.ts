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

  await session.initRepoMap(process.cwd());

  const primary = getAgentProvider(config);

  // Build a fallback provider + fallback model when the other provider
  // has a key available. This protects against rate limits and upstream
  // outages on free-tier models.
  let fallbackProvider = undefined;
  let fallbackModel = undefined;

  if (config.provider === "groq" && config.apiKey) {
    fallbackProvider = getAgentProvider({ ...config, provider: "openrouter" });
    fallbackModel = "cohere/north-mini-code:free";
  } else if (config.provider === "openrouter" && config.groqApiKey) {
    fallbackProvider = getAgentProvider({ ...config, provider: "groq" });
    fallbackModel = "openai/gpt-oss-120b";
  }

  const loop = new AgentLoop(
    session,
    primary,
    undefined,
    fallbackProvider,
    fallbackModel,
  );

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
      console.log(
        chalk.gray(
          `\n── done: ${event.summary} (${event.iterations} iterations) ──`,
        ),
      );
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
