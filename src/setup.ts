import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config as loadDotenv } from "dotenv";

const envPath = path.join(process.cwd(), ".env");

function hasApiKeys(): boolean {
  return Boolean(process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY);
}

function readSecret(prompt: string): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    const reader = createInterface({ input, output });
    return reader.question(prompt).finally(() => reader.close());
  }

  return new Promise((resolve, reject) => {
    let value = "";
    output.write(prompt);
    input.setRawMode?.(true);
    input.resume();

    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Setup cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          output.write("*");
        }
      }
    };

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    input.on("data", onData);
  });
}

async function saveKeys(groqKey: string, openRouterKey: string): Promise<void> {
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  const values = new Map<string, string>();
  for (const line of existing.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  if (groqKey) values.set("GROQ_API_KEY", groqKey);
  if (openRouterKey) values.set("OPENROUTER_API_KEY", openRouterKey);
  const content = `${[...values.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
  await fs.writeFile(envPath, content, { mode: 0o600 });
  await fs.chmod(envPath, 0o600).catch(() => undefined);
  loadDotenv({ path: envPath, override: true });
}

export function loadSavedEnvironment(): void {
  loadDotenv({ path: envPath, override: false });
}

export async function runFirstRunSetup(): Promise<void> {
  if (hasApiKeys() || !input.isTTY || !output.isTTY) return;

  let groqKey = "";
  let openRouterKey = "";
  output.write(
    "\nOpenAether setup\n" +
      "Paste your API keys. Everything else (model, temperature, tokens) is\n" +
      "auto-configured. You only need one key, but both work.\n" +
      "Your keys are saved to a .env file in this folder. Never commit it.\n\n",
  );

  while (true) {
    const reader = createInterface({ input, output });
    const command = (
      await reader.question(
        "[1] Enter Groq key  [2] Enter OpenRouter key  [s] Save  [q] Skip: ",
      )
    )
      .trim()
      .toLowerCase();
    reader.close();

    if (command === "1" || command === "groq") {
      groqKey = await readSecret("Groq API key: ");
    } else if (command === "2" || command === "openrouter") {
      openRouterKey = await readSecret("OpenRouter API key: ");
    } else if (command === "/" || command === "/help") {
      output.write(
        "Commands: 1 Groq, 2 OpenRouter, /save save keys, /skip continue without saving, /help show this menu\n",
      );
    } else if (command === "s" || command === "/save" || command === "save") {
      if (!groqKey && !openRouterKey) {
        output.write("Enter at least one key before saving.\n");
        continue;
      }
      await saveKeys(groqKey, openRouterKey);
      output.write(
        `Saved to ${envPath}.\n` +
          `OpenAether will use Groq by default if you provided both keys.\n`,
      );
      return;
    } else if (command === "q" || command === "/skip" || command === "skip") {
      output.write("Continuing without saving keys.\n");
      return;
    }
  }
}
