# OpenAether CLI

A minimal coding assistant CLI using the OpenAI SDK against OpenRouter. It is an independent project and does not modify or depend on the existing Anthropic implementation.

## Setup

Requirements: Node.js 18+ and an OpenRouter API key.

```bash
cd openaether-cli
npm install
copy .env.example .env
# Set OPENROUTER_API_KEY in .env
npm start
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

## Configuration

- `OPENROUTER_API_KEY`: required bearer token.
- `OPENROUTER_MODEL`: model ID; defaults to `openai/gpt-4-turbo`.
- `OPENROUTER_MAX_TOKENS`: maximum output tokens.
- `OPENROUTER_TEMPERATURE`: sampling temperature.
- `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME`: OpenRouter attribution headers.

Supported model IDs can be changed without code changes, including:

- `openai/gpt-4-turbo`
- `anthropic/claude-3-opus`
- `meta-llama/llama-3-70b-instruct`
- `google/gemini-pro`

## Features

The CLI supports streaming responses, conversation history, context from `AGENTS.md`, `OPENAETHER.md`, and `README.md`, and function tools for reading, writing, editing, merging, searching, globbing, and running shell commands.

File writes and merges are protected by default. Pass `overwrite: true` in a tool call when replacing an existing destination is intentional. File edits require an exact `oldText` match and reject ambiguous matches unless `replaceAll: true` is provided.

## Validation

```bash
npm run typecheck
npm start
```

## Limitations

Token estimation is approximate because OpenRouter routes to multiple providers. Tool permissions are intentionally minimal: shell commands execute in the current working directory, and file paths are resolved relative to it. The project does not yet implement session persistence, provider-specific token pricing, MCP, OAuth, or remote-control features.
