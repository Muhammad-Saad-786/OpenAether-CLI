#!/usr/bin/env node
import { Command } from "commander";
import { buildContext } from "./conversation/context.js";
import { SYSTEM_PROMPT } from "./conversation/prompts.js";
import { QueryEngine } from "./core/engine.js";
import { loadConfig } from "./config.js";
import { createProvider } from "./provider/client.js";
import { startRepl } from "./repl.js";
import { toolRegistry } from "./tools/registry.js";
import { formatProviderError } from "./utils/errors.js";
import { loadSavedEnvironment, runFirstRunSetup } from "./setup.js";
import { runAgent } from "./core/agent.js";
import { createBudget } from "./core/budget.js";

export async function startCli(argv = process.argv): Promise<void> {
  loadSavedEnvironment();
  await runFirstRunSetup();
  const config = loadConfig();
  const program = new Command()
    .name("openaether")
    .description("OpenAether, an OpenRouter-powered coding assistant")
    .version("0.1.0")
    .argument("[prompt]", "Prompt to send")
    .option("-p, --print", "Print one response and exit")
    .option("-c, --chat", "Start interactive chat mode")
    .option("-m, --model <model>", "Model ID", config.model)
    .option(
      "--max-tokens <number>",
      "Maximum output tokens",
      String(config.maxTokens),
    )
    .option(
      "--temperature <number>",
      "Sampling temperature",
      String(config.temperature),
    )
    .option("--system-prompt <prompt>", "Override the default system prompt")
    .action(async (prompt, options) => {
      const provider = createProvider(config);
      const isGroq = config.provider === "groq";

      // For Groq, use minimal system prompt to save tokens
      const systemPrompt = options.systemPrompt
        ? options.systemPrompt
        : isGroq
          ? SYSTEM_PROMPT
          : `${SYSTEM_PROMPT}\n\n${await buildContext()}`;

      const engine = new QueryEngine(
        provider as any,
        toolRegistry,
        {
          model: options.model,
          maxTokens: Number(options.maxTokens),
          temperature: Number(options.temperature),
          budget: createBudget(),
        },
        [{ role: "system", content: systemPrompt }],
      );

      if (options.chat || (!prompt && !options.print)) {
        await startRepl(engine);
        return;
      }
      if (options.print && !prompt) {
        throw new Error("--print requires a prompt");
      }
      if (prompt) {
        const result = await runAgent(engine, prompt, createBudget());
        console.log(
          `\n${result.verification.passed ? "Completed" : "Stopped after verification failures"}. ` +
            `Project: ${result.project.framework}/${result.project.language}. ` +
            `Budget: ${result.budget.used}/${result.budget.total} tokens.`,
        );
        console.log(
          `Current Budget\n  Context      ${result.budget.context}\n  Prompt       ${result.budget.prompt}\n  History      ${result.budget.history}\n  Response     ${result.budget.response}\n  Total        ${result.budget.total}\n\nGit diff:\n${result.diff}`,
        );
      }
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    throw new Error(formatProviderError(error), { cause: error });
  }
}

if (
  process.argv[1]?.endsWith("cli.ts") ||
  process.argv[1]?.endsWith("cli.js")
) {
  startCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
