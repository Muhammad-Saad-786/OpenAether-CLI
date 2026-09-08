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

export async function startCli(argv = process.argv): Promise<void> {
  const config = loadConfig();
  const program = new Command()
    .name("openaether")
    .description("OpenAether, an OpenRouter-powered coding assistant")
    .version("0.1.0")
    .argument("[prompt]", "Prompt to send")
    .option("-p, --print", "Print one response and exit")
    .option("-c, --chat", "Start interactive chat mode")
    .option("-m, --model <model>", "OpenRouter model ID", config.model)
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
      const systemPrompt =
        options.systemPrompt ?? `${SYSTEM_PROMPT}\n\n${await buildContext()}`;
      const engine = new QueryEngine(
        provider as any,
        toolRegistry,
        {
          model: options.model,
          maxTokens: Number(options.maxTokens),
          temperature: Number(options.temperature),
        },
        [{ role: "system", content: systemPrompt }],
      );

      if (options.chat || !prompt) {
        await startRepl(engine);
        return;
      }
      if (prompt) {
        await engine.submit(prompt);
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
