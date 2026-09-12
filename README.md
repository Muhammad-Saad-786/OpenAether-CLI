<div align="center">
  <img src="https://github.com/Muhammad-Saad-786/OpenAether-CLI/blob/main/media/openaether-banner.png" alt="OpenAether CLI Banner" width="600">

# OpenAether CLI

**An autonomous coding agent for your terminal.**

Free forever. Open source. Runs on Groq and OpenRouter.

[![npm version](https://img.shields.io/npm/v/openaether.svg?style=for-the-badge)](https://www.npmjs.com/package/openaether)
[![npm downloads](https://img.shields.io/npm/dm/openaether.svg?style=for-the-badge)](https://www.npmjs.com/package/openaether)
[![GitHub stars](https://img.shields.io/github/stars/Muhammad-Saad-786/openaether-cli.svg?style=for-the-badge)](https://github.com/Muhammad-Saad-786/openaether-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

  <p>
    <a href="#installation">Installation</a> ·
    <a href="#quick-start">Quick Start</a> ·
    <a href="#how-it-works">How It Works</a> ·
    <a href="#features">Features</a> ·
    <a href="#commands">Commands</a> ·
    <a href="#models">Models</a> ·
    <a href="#configuration">Configuration</a>
  </p>
</div>

---

## What Is OpenAether?

OpenAether is an autonomous coding agent that runs in your terminal. You ask it to do something, such as "create a greeting component", "fix the type error in `auth.ts`", or "refactor this function", and it **does it**, streaming every tool call and file edit as it works.

Unlike a chatbot that happens to have file access, OpenAether is built as a proper agent:

- **It runs a real loop**: reads files, makes edits, checks its work, fixes failures, and only finishes when the task is complete.
- **It verifies its own changes**: after editing, it runs `typecheck`, `lint`, `build`, and `test`, then fixes any failures before declaring the task complete.
- **It shows you everything**: every file read, every diff, and every verification result streams to the terminal.
- **It works with free models**: there is no subscription. Bring your own Groq or OpenRouter key; both are free to create.

Built for developers who want the power of Claude Code, Cursor, or Antigravity without the price tag.

---

## Why OpenAether?

- **Completely free**: no subscription and no credit card. Free API keys are available from Groq and OpenRouter.
- **Real agent loop**: not a chatbot. It reads, edits, verifies, and retries.
- **Live diffs**: every write shows you exactly what changed.
- **Verification built in**: the agent runs typecheck, lint, build, and test, then fixes failures.
- **Undo support**: `/undo` reverts the last change, and `/diff` shows the full session.
- **Provider flexibility**: swap between Groq and OpenRouter mid-session with `/model`.
- **Open source**: MIT licensed.

---

## Installation

**Requirements:** Node.js 18+ and a free API key from Groq or OpenRouter.

```bash
npm install -g openaether
```

Verify the installation:

```bash
openaether --version
```

Update OpenAether:

```bash
npm update -g openaether
```

Uninstall OpenAether:

```bash
npm uninstall -g openaether
```

## Quick Start

### 1. Get a free API key

You only need one:

- [Groq](https://console.groq.com/keys) (recommended)
- [OpenRouter](https://openrouter.ai/keys)

Both are free to create.

### 2. Run OpenAether

```bash
openaether
```

On first launch, OpenAether asks you to paste your key. It saves the key to a `.env` file in the current directory and never asks again. The key input is masked.

No model selection, token tuning, or configuration files are required. OpenAether picks sensible defaults based on which key you provide.

### One-shot mode

```bash
openaether "create a hello.ts file that prints 'hi'"
openaether --print "explain src/agent/AgentLoop.ts"
```

## How It Works

OpenAether runs a single, real agent loop:

1. You type a prompt.
2. The agent decides what to do.
3. It calls tools to read files, write files, and run commands.
4. Each tool result goes back into the loop.
5. If it made code changes, it runs verification.
6. If verification fails, it fixes the errors and re-verifies.
7. It calls `done` with a one-line summary.

### What you see in the terminal

```text
You> create src/greet.ts with a function that returns "hi"

→ write_file path=src/greet.ts content=export function greet()...
✓ Created src/greet.ts + export function greet() { return "hi"; }
+1 -0

→ run_verification
✓ All checks passed (2): typecheck, build

→ done status=Created src/greet.ts
done — Created src/greet.ts (3 iterations)
```

Every file read, diff, and verification result is visible. If something fails, you see it and the agent fixes it.

## Features

### Real agent loop

- Multi-step reasoning with tool calls
- Automatic retry on verification failure
- No-progress detection
- Rate-limit and upstream-error fallbacks

### Live verification

- Runs `tsc --noEmit`, lint, build, and test after every code change
- Reports the exact files that failed
- Fixes errors and re-verifies until clean

### Live diffs

- Every file write shows a colored diff
- `+N -M` stats are shown for each change
- `/diff` replays every change in the session

### Safety net

- `/undo` reverts the last change; created files are deleted and edits are git-reverted
- File locking prevents the agent from touching a file again after it passes verification in the same task
- Banned-directive protection refuses to write `@ts-ignore`, `@ts-nocheck`, or blanket `eslint-disable`

### Model freedom

- Switch provider and model mid-session with `/model`
- Use Groq for fast responses or OpenRouter for access to 30+ free models
- Automatic fallback when a provider is rate-limited or unavailable

### Project awareness

- Reads `AGENTS.md`, `OPENAETHER.md`, and `README.md` at startup
- Builds a repository summary so it does not have to explore every time
- Compresses old messages so long sessions stay cheap

## Commands

### Interactive REPL commands

| Command   | Description                             |
| --------- | --------------------------------------- |
| `/help`   | Show all commands                       |
| `/model`  | Open the model picker                   |
| `/status` | Show provider, model, and session state |
| `/diff`   | Show every change made this session     |
| `/undo`   | Revert the last change                  |
| `/clear`  | Reset conversation history              |
| `/exit`   | Exit OpenAether                         |

### CLI flags

| Flag           | Description                             |
| -------------- | --------------------------------------- |
| `[prompt]`     | One-shot mode: run this prompt and exit |
| `--chat`       | Start interactive mode                  |
| `--print`      | Print one response and exit             |
| `--model <id>` | Override the model for this run         |
| `--version`    | Show version                            |
| `--help`       | Show help                               |

## Models

OpenAether ships with sensible defaults. You do not need to configure anything; just provide an API key.

### Defaults

| Provider   | Default model                 | Why                                      |
| ---------- | ----------------------------- | ---------------------------------------- |
| Groq       | `openai/gpt-oss-120b`         | Best balance of speed and tool-calling   |
| OpenRouter | `cohere/north-mini-code:free` | Reliable, tuned for code, no rate limits |

If both keys are present, Groq is used by default for lower latency. If only one key is present, that provider is used.

### Switching models

In the REPL, run `/model` and pick from the list. Or set a model directly:

```text
/model openai/gpt-oss-20b
```

### Groq models

| Model                     | Best for                     | Tool calling |
| ------------------------- | ---------------------------- | ------------ |
| `openai/gpt-oss-120b`     | Complex coding and reasoning | Yes          |
| `openai/gpt-oss-20b`      | Fast coding                  | Yes          |
| `qwen/qwen3.6-27b`        | Coding and explanations      | Yes          |
| `qwen/qwen3.8-27b`        | Coding and explanations      | Yes          |
| `llama-3.3-70b-versatile` | General                      | Yes          |
| `llama-3.1-8b-instant`    | Fast general use             | Yes          |
| `groq/compound`           | Chat only                    | No           |
| `groq/compound-mini`      | Chat only                    | No           |

### OpenRouter free models

| Model                                    | Tool calling |
| ---------------------------------------- | ------------ |
| `cohere/north-mini-code:free`            | Yes          |
| `nex-agi/nex-n2.5-mini:free`             | Yes          |
| `inclusionai/ling-3.0-flash-fin:free`    | Yes          |
| `nvidia/nemotron-3.5-lightning:free`     | Yes          |
| `poolside/laguna-s-2.1:free`             | Yes          |
| `thinkingmachines/inkling:free`          | Yes          |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Yes          |
| `google/gemma-4-31b-it:free`             | Yes          |
| `nvidia/nemotron-3-super-120b-a12b:free` | Yes          |
| `dots-studio/dots-3-note-preview:free`   | No           |
| `nvidia/nemotron-3-embed-1b:free`        | No           |

> **Note:** Models without tool calling can chat but cannot read or write files. The model picker shows `[chat only]` next to them.

## Configuration

You only need one thing: an API key.

OpenAether writes it to a `.env` file in the current directory on first launch. That is the entire configuration.

```env
GROQ_API_KEY=gsk_your-key-here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

You only need one key. If both are present, Groq is used by default.

### Optional overrides

Power users can override any default with environment variables. These are not required and most users never need to change them.

| Variable                 | Purpose                       | Default                       |
| ------------------------ | ----------------------------- | ----------------------------- |
| `PROVIDER`               | Force a specific provider     | Auto-detected                 |
| `GROQ_MODEL`             | Override the Groq model       | `openai/gpt-oss-120b`         |
| `OPENROUTER_MODEL`       | Override the OpenRouter model | `cohere/north-mini-code:free` |
| `GROQ_MAX_TOKENS`        | Override the output cap       | `8000`                        |
| `OPENROUTER_MAX_TOKENS`  | Override the output cap       | `8000`                        |
| `GROQ_TEMPERATURE`       | Override sampling             | `0.4`                         |
| `OPENROUTER_TEMPERATURE` | Override sampling             | `0.5`                         |

For example, to use a different Groq model:

```bash
GROQ_MODEL=llama-3.3-70b-versatile openaether
```

Or set it in `.env`:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

## Examples

### Create a file

```text
You> create src/utils/greet.ts with a function that returns "hello"
```

The agent writes the file, runs verification, and confirms.

### Fix a bug

```text
You> read sum.ts and list the specific bugs
You> now fix them
```

The agent reads, identifies the issue, edits, verifies, and confirms.

### Refactor

```text
You> rename the function greetUser to welcomeUser everywhere
```

The agent uses grep to find every usage, edits each file, verifies, and reports.

### Ask about the project

```text
You> what kind of project is this?
You> what's in src?
You> explain src/agent/AgentLoop.ts
```

The agent answers from the repository summary or reads specific files.

## Development

Clone and install:

```bash
git clone https://github.com/Muhammad-Saad-786/openaether-cli.git
cd openaether-cli
npm install
cp .env.example .env
```

Add your key to `.env`, then start the development CLI:

```bash
npm run dev
```

Type check:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

## Tech Stack

- TypeScript
- Node.js
- Ink (React for terminals)
- Groq SDK
- OpenAI SDK for OpenRouter compatibility
- Commander
- Chalk

## Contributing

Contributions are welcome:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a pull request.

## Verification

Run the type check:

```bash
rm -f .env.bak
npx tsc --noEmit
```

To test the fresh setup path:

```bash
# Clear the environment so we test the fresh setup path.
unset GROQ_API_KEY OPENROUTER_API_KEY
rm -f .env

npx tsx src/cli.ts --chat
```

Expected behavior:

1. The setup wizard prompts for a key.
2. You paste a key, and it saves to `.env`.
3. The agent starts immediately with the correct default model.

Then type:

```text
You> create src/hello.ts with a function that returns "hi"
```

## License

MIT © Saad Asim

<div align="center">
  If you find OpenAether useful, please ⭐ the repository.
  <br>
  <a href="#openaether-cli">Back to top</a>
</div>
