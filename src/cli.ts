#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { startRepl } from "./repl.js";
import { formatProviderError } from "./utils/errors.js";
import { loadSavedEnvironment, runFirstRunSetup } from "./setup.js";
import { runAgentHeadless } from "./agent/headless.js";

export async function startCli(argv = process.argv): Promise<void> {
  loadSavedEnvironment();
  await runFirstRunSetup();
  const config = loadConfig();

  const program = new Command()
    .name("openaether")
    .description("OpenAether — an autonomous coding agent")
    .version("4.0.0")
    .argument("[prompt]", "Prompt to send (one-shot mode)")
    .option("-p, --print", "Print one response and exit (one-shot mode)")
    .option("-c, --chat", "Start interactive chat mode (default)")
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
    .action(async (prompt, options) => {
      const runtimeConfig = {
        ...config,
        model: options.model,
        maxTokens: Number(options.maxTokens),
        temperature: Number(options.temperature),
      };

      // Default to chat mode if nothing specified
      const wantOneShot = Boolean(prompt) || options.print;

      if (!wantOneShot) {
        await startRepl(runtimeConfig);
        return;
      }

      if (options.print && !prompt) {
        throw new Error("--print requires a prompt");
      }

      await runAgentHeadless(runtimeConfig, prompt);
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
