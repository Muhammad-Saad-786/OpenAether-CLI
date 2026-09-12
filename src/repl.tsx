import React, { useState, useRef, useMemo } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import type { Config } from "./config.js";
import { toolRegistry } from "./tools/registry.js";
import { AgentSession } from "./agent/AgentSession.js";
import { AgentLoop } from "./agent/AgentLoop.js";
import { getAgentProvider } from "./agent/providerAdapter.js";
import { SYSTEM_PROMPT } from "./conversation/prompts.js";
import { cleanMarkdown } from "./utils/markdown.js";
import type { AgentEvent } from "./agent/types.js";
import { ALL_MODELS } from "./agent/models.js";
import type { ChatProvider } from "./provider/types.js";
import { renderDiff, diffStats } from "./utils/diff.js";

interface ChatLine {
  kind:
    | "user"
    | "assistant"
    | "tool_call"
    | "tool_ok"
    | "tool_fail"
    | "diff"
    | "info";
  text: string;
}

interface FileChange {
  path: string;
  diff: string;
  created: boolean;
}

function Header({ provider, model }: { provider: string; model: string }) {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={4} paddingY={1}>
        <Text bold color="cyan">
          OpenAether
        </Text>
      </Box>
      <Text dimColor>
        {provider} · {model}
      </Text>
    </Box>
  );
}

function Line({ line }: { line: ChatLine }) {
  switch (line.kind) {
    case "user":
      return (
        <Box marginBottom={1}>
          <Text bold color="green">
            {"You> "}
          </Text>
          <Text>{line.text}</Text>
        </Box>
      );
    case "assistant":
      return (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {"AI> "}
          </Text>
          <Text>{cleanMarkdown(line.text)}</Text>
        </Box>
      );
    case "tool_call":
      return (
        <Box marginLeft={2}>
          <Text color="cyan">{`→ ${line.text}`}</Text>
        </Box>
      );
    case "tool_ok":
      return (
        <Box marginLeft={4}>
          <Text color="green">{`✓ ${line.text}`}</Text>
        </Box>
      );
    case "tool_fail":
      return (
        <Box marginLeft={4}>
          <Text color="red">{`✗ ${line.text}`}</Text>
        </Box>
      );
    case "diff":
      return (
        <Box marginLeft={4} flexDirection="column">
          {line.text.split("\n").map((l, i) => {
            const color = l.startsWith("+ ")
              ? "green"
              : l.startsWith("- ")
                ? "red"
                : l.startsWith("...")
                  ? "gray"
                  : undefined;
            return (
              <Text key={i} color={color}>
                {l}
              </Text>
            );
          })}
        </Box>
      );
    case "info":
      return (
        <Box marginLeft={2}>
          <Text dimColor>{line.text}</Text>
        </Box>
      );
  }
}

function InteractiveRepl({ config }: { config: Config }) {
  const { exit } = useApp();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("idle");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>(config.provider);
  const [activeModel, setActiveModel] = useState<string>(config.model);
  const [repoReady, setRepoReady] = useState(false);
  const abortRef = useRef(false);
  const sessionChanges = useRef<FileChange[]>([]);

  // One session per REPL run, reused across prompts.
  const session = useMemo(
    () =>
      new AgentSession(toolRegistry, {
        systemPrompt: SYSTEM_PROMPT,
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      }),
    [config],
  );

  React.useEffect(() => {
    (async () => {
      await session.initRepoMap(process.cwd());
      setRepoReady(true);
    })();
  }, [session]);

  const provider = useMemo(() => getAgentProvider(config), [config]);
  const initialFallback =
    config.provider === "groq" && config.apiKey
      ? getAgentProvider({ ...config, provider: "openrouter" })
      : config.provider === "openrouter" && config.groqApiKey
        ? getAgentProvider({ ...config, provider: "groq" })
        : undefined;
  const initialFallbackModel =
    config.provider === "groq"
      ? "cohere/north-mini-code:free"
      : "openai/gpt-oss-120b";

  const loopRef = useRef(
    new AgentLoop(
      session,
      provider,
      undefined,
      initialFallback,
      initialFallbackModel,
    ),
  );

  useInput((_input, key) => {
    if (key.escape && busy) abortRef.current = true;
    if (key.escape && showModelPicker) setShowModelPicker(false);
  });

  const switchProvider = (prov: "groq" | "openrouter", modelId: string) => {
    const nextConfig = { ...config, provider: prov, model: modelId } as Config;
    (session.config as any).model = modelId;

    const nextProvider = getAgentProvider(nextConfig);

    let fallbackProvider: ChatProvider | undefined;
    let fallbackModel: string | undefined;

    if (prov === "groq" && config.apiKey) {
      fallbackProvider = getAgentProvider({
        ...config,
        provider: "openrouter",
      });
      fallbackModel = "cohere/north-mini-code:free";
    } else if (prov === "openrouter" && config.groqApiKey) {
      fallbackProvider = getAgentProvider({ ...config, provider: "groq" });
      fallbackModel = "openai/gpt-oss-120b";
    }

    loopRef.current = new AgentLoop(
      session,
      nextProvider,
      undefined,
      fallbackProvider,
      fallbackModel,
    );

    setActiveProvider(prov);
    setActiveModel(modelId);
    setLines((prev) => [
      ...prev,
      { kind: "info", text: `Switched to ${prov} · ${modelId}` },
    ]);
  };

  const undoLastChange = () => {
    const last = sessionChanges.current.pop();
    if (!last) {
      setLines((prev) => [...prev, { kind: "info", text: "Nothing to undo." }]);
      return;
    }

    try {
      if (last.created) {
        // The agent created this file — remove it.
        if (existsSync(last.path)) {
          unlinkSync(last.path);
          setLines((prev) => [
            ...prev,
            {
              kind: "info",
              text: `Removed ${last.path} (was created by the agent).`,
            },
          ]);
        } else {
          setLines((prev) => [
            ...prev,
            { kind: "info", text: `${last.path} already removed.` },
          ]);
        }
      } else {
        // The agent modified an existing file — restore via git.
        execSync(`git checkout -- "${last.path}"`, { cwd: process.cwd() });
        setLines((prev) => [
          ...prev,
          {
            kind: "info",
            text: `Reverted ${last.path} to last git revision.`,
          },
        ]);
      }
    } catch (err) {
      setLines((prev) => [
        ...prev,
        {
          kind: "tool_fail",
          text: `Could not undo ${last.path}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ]);
    }
  };

  const runPrompt = async (prompt: string) => {
    abortRef.current = false;
    setBusy(true);
    setStatus("thinking");

    let assistantBuffer = "";
    let assistantFlushed = false;

    const flushAssistant = () => {
      if (assistantBuffer.trim()) {
        const text = assistantBuffer.trim();
        setLines((prev) => [...prev, { kind: "assistant", text }]);
      }
      assistantBuffer = "";
      assistantFlushed = true;
    };

    try {
      for await (const event of loopRef.current.run(prompt)) {
        if (abortRef.current) {
          setLines((prev) => [...prev, { kind: "info", text: "aborted" }]);
          break;
        }

        switch (event.type) {
          case "iteration_start":
            if (event.iteration > 1) setStatus(`iteration ${event.iteration}`);
            break;

          case "assistant_text":
            assistantBuffer += event.delta;
            setStatus("responding");
            break;

          case "assistant_message":
            if (assistantBuffer.trim()) {
              setLines((prev) => [
                ...prev,
                { kind: "assistant", text: assistantBuffer.trim() },
              ]);
              assistantBuffer = "";
              assistantFlushed = true;
            }
            break;

          case "tool_call_start": {
            if (assistantBuffer.trim()) flushAssistant();
            const args = Object.entries(event.args)
              .map(
                ([k, v]) =>
                  `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`,
              )
              .join(" ");
            setLines((prev) => [
              ...prev,
              { kind: "tool_call", text: `${event.toolName} ${args}`.trim() },
            ]);
            setStatus(`running ${event.toolName}`);
            break;
          }

          case "tool_result": {
            const r = event.result;
            setLines((prev) => [
              ...prev,
              r.ok
                ? { kind: "tool_ok", text: r.summary }
                : { kind: "tool_fail", text: r.error ?? r.summary },
            ]);

            // Track file changes for /diff and /undo.
            const isWriteLike =
              r.toolName === "write_file" ||
              r.toolName === "edit_file" ||
              r.toolName === "delete_file";

            if (r.ok && isWriteLike) {
              const data = r.data as
                | { path?: string; created?: boolean }
                | undefined;
              const path = data?.path ?? "";
              const created = Boolean(data?.created);

              // Use meta.diff if present; otherwise synthesize from the file.
              let diff = r.meta?.diff ?? "";
              if (!diff && path) {
                try {
                  const content = readFileSync(path, "utf8");
                  diff = content
                    .split("\n")
                    .map((line) => `+ ${line}`)
                    .join("\n");
                } catch {
                  diff = "";
                }
              }

              if (diff) {
                const rendered = renderDiff(diff, { maxLines: 30 });
                if (rendered) {
                  setLines((prev) => [
                    ...prev,
                    { kind: "diff", text: rendered },
                  ]);
                }
                sessionChanges.current.push({ path, diff, created });

                const stats = diffStats(diff);
                if (stats.added || stats.removed) {
                  setLines((prev) => [
                    ...prev,
                    {
                      kind: "info",
                      text: `   +${stats.added} -${stats.removed}`,
                    },
                  ]);
                }
              }
            }
            break;
          }

          case "error":
            setLines((prev) => [
              ...prev,
              { kind: "tool_fail", text: event.message },
            ]);
            break;

          case "done":
            if (!assistantFlushed && assistantBuffer.trim()) flushAssistant();
            setLines((prev) => [
              ...prev,
              {
                kind: "info",
                text: `done — ${event.summary} (${event.iterations} iterations)`,
              },
            ]);
            break;
        }
      }
    } catch (error) {
      setLines((prev) => [
        ...prev,
        {
          kind: "tool_fail",
          text: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setBusy(false);
      setStatus("idle");
    }
  };

  const handleCommand = (cmd: string): boolean => {
    const trimmed = cmd.trim();

    if (trimmed === "/exit" || trimmed === "/quit") {
      exit();
      return true;
    }

    if (trimmed === "/help") {
      setLines((prev) => [
        ...prev,
        {
          kind: "info",
          text: "Commands: /help /clear /model /status /diff /undo /exit",
        },
      ]);
      return true;
    }

    if (trimmed === "/model") {
      setShowModelPicker(true);
      return true;
    }

    if (trimmed === "/clear") {
      session.clear();
      sessionChanges.current = [];
      setLines([]);
      return true;
    }

    if (trimmed === "/status") {
      setLines((prev) => [
        ...prev,
        {
          kind: "info",
          text: `provider=${activeProvider} model=${activeModel} status=${status} repoReady=${repoReady}`,
        },
      ]);
      return true;
    }

    if (trimmed === "/diff") {
      if (sessionChanges.current.length === 0) {
        setLines((prev) => [
          ...prev,
          { kind: "info", text: "No changes recorded in this session." },
        ]);
      } else {
        setLines((prev) => {
          const next = [...prev];
          for (const entry of sessionChanges.current) {
            next.push({
              kind: "info",
              text: `── ${entry.path || "(unknown path)"}${entry.created ? " (created)" : ""} ──`,
            });
            next.push({
              kind: "diff",
              text: renderDiff(entry.diff, { maxLines: 200 }),
            });
          }
          return next;
        });
      }
      return true;
    }

    if (trimmed === "/undo") {
      undoLastChange();
      return true;
    }

    return false;
  };

  const handleSubmit = async (value: string) => {
    if (busy) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setInput("");
    if (handleCommand(trimmed)) return;
    setLines((prev) => [...prev, { kind: "user", text: trimmed }]);
    await runPrompt(trimmed);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header provider={activeProvider} model={activeModel} />

      <Box flexDirection="column" flexGrow={1}>
        {lines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
        {busy && (
          <Box marginTop={1}>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> {status}</Text>
          </Box>
        )}
      </Box>

      {showModelPicker && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          padding={1}
          marginY={1}
        >
          <Text bold color="yellow">
            Select model
          </Text>
          <SelectInput
            items={ALL_MODELS.map((m) => ({
              label: `${m.label}  (${m.provider})${m.toolCalling ? "" : " [chat only]"}`,
              value: `${m.provider}:${m.id}`,
            }))}
            onSelect={(item) => {
              const sep = String(item.value).indexOf(":");
              const prov = String(item.value).slice(0, sep) as
                | "groq"
                | "openrouter";
              const id = String(item.value).slice(sep + 1);
              switchProvider(prov, id);
              setShowModelPicker(false);
            }}
          />
          <Text dimColor>Esc to cancel</Text>
        </Box>
      )}

      <Box
        borderStyle="round"
        borderColor={busy ? "gray" : "green"}
        paddingX={1}
      >
        <Text color={busy ? "gray" : "green"} bold>
          {busy ? "..." : "You> "}
        </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={busy ? "waiting..." : "ask anything, or /help"}
        />
      </Box>
    </Box>
  );
}

export function startRepl(config: Config): void {
  render(<InteractiveRepl config={config} />);
}
