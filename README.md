<div align="center">
  <img src="https://github.com/Muhammad-Saad-786/OpenAether-CLI/blob/main/media/openaether-banner.png" alt="OpenAether CLI Banner" width="600">
  
  # OpenAether CLI
  
  **AI-Powered Coding Assistant for Your Terminal**
  
  Free forever. Open source. Built for developers.
  
  [![npm version](https://img.shields.io/npm/v/openaether.svg?style=for-the-badge)](https://www.npmjs.com/package/openaether)
  [![npm downloads](https://img.shields.io/npm/dm/openaether.svg?style=for-the-badge)](https://www.npmjs.com/package/openaether)
  [![GitHub stars](https://img.shields.io/github/stars/Muhammad-Saad-786/openaether-cli.svg?style=for-the-badge)](https://github.com/Muhammad-Saad-786/openaether-cli)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/Muhammad-Saad-786/openaether-cli/pulls)
  
  <p>
    <a href="#installation">Installation</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#features">Features</a> •
    <a href="#commands">Commands</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#free-models">Free Models</a> •
    <a href="#examples">Examples</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## What is OpenAether?

OpenAether is a powerful AI coding assistant like Claude Code, Antigravity and Codex that runs directly in your terminal. It helps you write, edit, and understand code using state-of-the-art AI models - **completely free of cost**.

Think of it as your personal pair programmer that:

- **Reads and writes files** with line numbers and context
- **Searches your codebase** with regex and glob patterns
- **Executes shell commands** directly from the conversation
- **Understands project structure** from AGENTS.md and README.md
- **Streams responses** in real-time with beautiful terminal UI
- **Works with 30+ free AI models** from OpenRouter

Built with developers in mind, OpenAether brings the power of AI coding assistants to everyone without subscription fees.

---

## Why OpenAether?

### Comparison with Other Tools

• Uses your own OpenRouter API key
• Supports multiple AI providers
• Runs entirely in your terminal
• Open source
• Project-aware
• Streaming responses

### Why Choose OpenAether?

1. **Completely Free** - No credit card, no subscription, no hidden fees
2. **Open Source** - Inspect the code, contribute, customize
3. **Model Flexibility** - Switch between 30+ free models instantly
4. **Privacy First** - Your API key, your data, your control
5. **Active Development** - Regular updates and new features

---

## Installation

### Requirements

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **OpenRouter API Key**: Free (get it in 2 minutes)

### Global Installation

```bash
npm install -g openaether
```

### Verify Installation

```bash
openaether --version
```

### Update to Latest Version

```bash
npm update -g openaether

```

### Uninstall

```bash
npm uninstall -g openaether
```

## Quick Start

### Step 1: Get Your Free API Key

1. Visit OpenRouter **[OpenRouter.ai](https://openrouter.ai)**
2. Visit Groq **[console.Groq.com](https://console.groq.com/)**
3. Click **Sign Up** (free account)
4. Navigate to OpenRouter API **[API Keys](https://openrouter.ai/keys)**
5. Navigate to Groq API **[API Keys](https://console.groq.com/keys)**
6. Click **Create Key**
7. Copy your key (starts with `sk-or-v1-` for OpenRouter and `gsk-your-key`for Groq )

### Step 2: Set Your API Keys

#### Windows (PowerShell)

```powershell
$env:OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

#### To make it permanent:

```powershell
[System.Environment]: :SetEnvironmentVariable('OPENROUTER_API_KEY','sk-or-v1-your-key-here','User')
```

#### macOS / Linux (Terminal)

```bash
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

#### To make it permanent, add to ~/.bashrc or ~/.zshrc:

```bash
echo 'export OPENROUTER_API_KEY="sk-or-v1-your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

#### Using .env File (All Platforms)

#### Create a .env file in your project:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=nex-agi/nex-n2.5-mini:free
```

### Step 3: Start Using OpenAether

#### Interactive Mode (Recommended)

```bash
openaether
```

On the first interactive launch, OpenAether opens a key setup menu before the
agent starts. You can enter a Groq key, an OpenRouter key, or both. Use `/save`
to write them to `.env` in the current directory, `/help` to see the menu, or
`/skip` to continue without saving. Key input is masked. The `.env` file is
ignored by Git and is written with private file permissions where supported;
keep it private and never commit it.

#### One-Shot Query

```bash
openaether "What is 2+2?"
```

#### Chat Mode

```bash
openaether --chat
```

#### Print Mode (Non-interactive)

```bash
openaether --print "Explain this code"
```

## ✨ Features

### 🖥 Beautiful Terminal Interface

Use the interactive Ink terminal experience.

- 🎨 Clean full-screen UI
- 📊 Model and provider status
- 💬 Message history
- 🤖 Runtime model switching with `/model <model-id>`

---

## 🧠 AI Models

OpenAether supports models from both OpenRouter and Groq. Set the provider and
default model in `.env`, or switch the active model in the REPL with
`/model <model-id>`.

The OpenRouter free-model selector includes:

- `nex-agi/nex-n2.5-mini:free`
- `inclusionai/ling-3.0-flash-fin:free`
- `liquid/lfm-2.5-embedding-350m:free`
- `dots-studio/dots-3-note-preview:free`
- `nvidia/nemotron-3.5-lightning:free`
- `poolside/laguna-s-2.1:free`
- `thinkingmachines/inkling:free`
- `nvidia/nemotron-3-embed-1b:free`
- `cohere/north-mini-code:free`
- `nvidia/nemotron-3-ultra-550b-a55b:free`
- `google/gemma-4-31b-it:free`
- `nvidia/nemotron-3-super-120b-a12b:free`

Groq models are also supported through the native Groq API. Add a Groq API key
and select a Groq model with `GROQ_MODEL` or `/model <model-id>`:

```env
PROVIDER=groq
GROQ_API_KEY=gsk_your-key-here
GROQ_MODEL=openai/gpt-oss-120b
```

Available Groq model IDs:

| Model ID                       | Best For                                            | Tool Calling        |
| ------------------------------ | --------------------------------------------------- | ------------------- |
| `openai/gpt-oss-120b`          | Complex coding, debugging, and reasoning            | Yes                 |
| `openai/gpt-oss-20b`           | Fast coding and everyday development tasks          | Yes                 |
| `openai/gpt-oss-safeguard-20b` | Safety-focused classification and guarded responses | Check model support |
| `qwen/qwen3.6-27b`             | Coding and technical questions                      | Yes                 |
| `qwen/qwen3.8-27b`             | Coding and general technical work                   | Yes                 |
| `groq/compound`                | General chat and answers                            | No                  |
| `groq/compound-mini`           | Lightweight chat                                    | No                  |

The CLI's file, search, and shell tools require a model that supports tool
calling. Use `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, or a compatible Qwen
model for tool-based coding tasks. Compound and Compound Mini remain available
for fast chat, but they do not receive coding tool definitions.

Switch models anytime using:

```bash
/model <model-id>
```

Example:

```bash
/model nex-agi/nex-n2.5-mini:free
```

---

# 📁 File Operations

OpenAether can work directly with your project.

- Read files with line numbers
- Create new files
- Edit existing files
- Merge multiple files
- Search using regex
- Find files with glob patterns
- Execute shell commands

---

# 📚 Project Context

Automatically understands your project by reading:

```
AGENTS.md
OPENAETHER.md
README.md
```

This gives the AI project-specific knowledge without additional prompts.

---

# ⚡ Streaming Responses

Experience ChatGPT-style streaming directly inside your terminal.

- Token-by-token output
- Instant feedback
- Better UX
- Faster interaction

---

# 💬 Session Management

Keep conversations organized.

- Conversation history
- Context tracking
- Token management
- Session statistics

---

# 🎮 Commands

## Interactive Commands

| Command       | Description            |
| ------------- | ---------------------- |
| `/help`       | Show help              |
| `/model <id>` | Change model           |
| `/status`     | Show session info      |
| `/pwd`        | Show working directory |
| `/clear`      | Clear chat history     |
| `/exit`       | Exit OpenAether        |

---

# ⚙ CLI Arguments

| Argument            | Description            |
| ------------------- | ---------------------- |
| `--chat`            | Start interactive mode |
| `--print`           | Print one response     |
| `--model <id>`      | Select model           |
| `--max-tokens <n>`  | Output token limit     |
| `--temperature <n>` | Sampling temperature   |
| `--system-prompt`   | Custom system prompt   |
| `--version`         | Show version           |
| `--help`            | Show help              |

---

# ⚙ Configuration

OpenAether uses environment variables.

| Variable                 | Required       | Default                      |
| ------------------------ | -------------- | ---------------------------- |
| `OPENROUTER_API_KEY`     | For OpenRouter | —                            |
| `GROQ_API_KEY`           | For Groq       | —                            |
| `PROVIDER`               | No             | Auto-detected                |
| `OPENROUTER_MODEL`       | No             | `nex-agi/nex-n2.5-mini:free` |
| `GROQ_MODEL`             | No             | `openai/gpt-oss-120b`        |
| `OPENROUTER_MAX_TOKENS`  | No             | `4000`                       |
| `GROQ_MAX_TOKENS`        | No             | `5000`                       |
| `OPENROUTER_TEMPERATURE` | No             | `0.5`                        |
| `GROQ_TEMPERATURE`       | No             | `0.5`                        |
| `OPENROUTER_SITE_URL`    | No             | —                            |
| `OPENROUTER_APP_NAME`    | No             | `OpenAether CLI`             |

---

## 📄 Example `.env`

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-your-key

# Model
OPENROUTER_MODEL=nex-agi/nex-n2.5-mini:free
OPENROUTER_MAX_TOKENS=2048
OPENROUTER_TEMPERATURE=0.7

# Or use Groq
# PROVIDER=groq
# GROQ_API_KEY=gsk_your-key-here
# GROQ_MODEL=openai/gpt-oss-120b
# GROQ_MAX_TOKENS=1000
# GROQ_TEMPERATURE=0.5

# Optional Attribution
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=OpenAether CLI
```

---

# 🤖 Free OpenRouter Models

| Model                                    | Provider          |
| ---------------------------------------- | ----------------- |
| `nex-agi/nex-n2.5-mini:free`             | Nex AGI           |
| `inclusionai/ling-3.0-flash-fin:free`    | inclusionAI       |
| `liquid/lfm-2.5-embedding-350m:free`     | LiquidAI          |
| `dots-studio/dots-3-note-preview:free`   | Dots Studio       |
| `nvidia/nemotron-3.5-lightning:free`     | NVIDIA            |
| `poolside/laguna-s-2.1:free`             | Poolside          |
| `thinkingmachines/inkling:free`          | Thinking Machines |
| `nvidia/nemotron-3-embed-1b:free`        | NVIDIA            |
| `cohere/north-mini-code:free`            | Cohere            |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | NVIDIA            |
| `google/gemma-4-31b-it:free`             | Google            |
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA            |

---

# 🎯 Recommended OpenRouter Model

Use `/models` to choose from the active free OpenRouter models, or set
`OPENROUTER_MODEL` directly in `.env`.

---

# 💡 Examples

## 📖 Read Files

**Prompt**

```text
Read package.json and tell me what dependencies are installed.
```

**Response**

```text
Dependencies found:

• chalk
• commander
• dotenv
• ink
• openai
```

---

## 🔍 Search Code

**Prompt**

```text
Find all authentication functions.
```

**Response**

```text
Found:

1. login()
2. logout()
3. verifyToken()
```

---

## ✏ Edit Files

**Prompt**

```text
Add error handling to main().
```

**Generated Patch**

```diff
try {
    // existing code
+} catch (error) {
+   console.error(error);
+   process.exit(1);
}
```

---

## ▶ Run Commands

**Prompt**

```text
Run npm test.
```

**Output**

```text
PASS src/tools/file-read.test.ts
PASS src/tools/file-write.test.ts
PASS src/tools/grep.test.ts

Tests: 3 passed
```

---

## 💻 Generate Code

**Prompt**

```text
Create an email validator in TypeScript.
```

**Response**

```ts
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
```

---

# 🚀 Getting Started

## Clone

```bash
git clone https://github.com/Muhammad-Saad-786/openaether-cli.git
```

---

## Enter Project

```bash
cd openaether-cli
```

---

## Install Dependencies

```bash
npm install
```

---

## Create Environment File

```bash
cp .env.example .env
```

Add your OpenRouter API key.

---

## Start Development

```bash
npm run dev
```

---

# 📦 Build

```bash
npm run build
```

---

# 🧪 Type Check

```bash
npm run typecheck
```

---

# Run Tests

```bash
npm test
```

---

# 🛠 Tech Stack

- TypeScript
- Node.js
- Ink
- OpenRouter
- React for CLI
- Commander
- Chalk

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push your branch
5. Open a Pull Request

---

# ⭐ Support

If you find OpenAether useful, consider giving the repository a ⭐ on GitHub.

It helps others discover the project!

---

<div align="center">
Built by Saad Asim. Licensed under MIT.

</div>
