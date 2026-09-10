import React, { useState, useRef, useMemo } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { Config } from "./config.js";
import { toolRegistry } from "./tools/registry.js";
import { AgentSession } from "./agent/AgentSession.js";
import { AgentLoop } from "./agent/AgentLoop.js";
import { getAgentProvider } from "./agent/providerAdapter.js";
import { SYSTEM_PROMPT } from "./conversation/prompts.js";
import { cleanMarkdown } from "./utils/markdown.js";
import type { AgentEvent } from "./agent/types.js";

interface ChatLine {
  kind: "user" | "assistant" | "tool_call" | "tool_ok" | "tool_fail" | "info";
  text: string;
}

function Header() {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={4} paddingY={1}>
        <Text bold color="cyan">
          OpenAether
        </Text>
      </Box>
      <Text dimColor>Autonomous coding agent</Text>
    </Box>
  );
}

function Line({ line }: { line: ChatLine }) {
  switch (line.kind) {
    case "user":
      return (
        <Box marginBottom={1}>
          <Text bold color="green">
            {"You> "}{" "}
          </Text>
          <Text>{line.text}</Text>
        </Box>
      );
    case "assistant":
      return (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {"AI> "}{" "}
          </Text>
          <Text>{cleanMarkdown(line.text)}</Text>
        </Box>
      );
    case "tool_call":
      return (
        <Box marginLeft={2}>
          <Text color="cyan">→ {line.text}</Text>
        </Box>
      );
    case "tool_ok":
      return (
        <Box marginLeft={4}>
          <Text color="green">✓ {line.text}</Text>
        </Box>
      );
    case "tool_fail":
      return (
        <Box marginLeft={4}>
          <Text color="red">✗ {line.text}</Text>
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
  const abortRef = useRef(false);

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

  const provider = useMemo(() => getAgentProvider(config), [config]);
  const loop = useMemo(
    () => new AgentLoop(session, provider),
    [session, provider],
  );

  useInput((_input, key) => {
    if (key.escape && busy) abortRef.current = true;
  });

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
      for await (const event of loop.run(prompt)) {
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
              { kind: "info", text: `done (${event.iterations} iterations)` },
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
          text: "Commands: /help /clear /status /exit",
        },
      ]);
      return true;
    }
    if (trimmed === "/clear") {
      session.clear();
      setLines([]);
      return true;
    }
    if (trimmed === "/status") {
      setLines((prev) => [
        ...prev,
        {
          kind: "info",
          text: `provider=${config.provider} model=${session.config.model} status=${status}`,
        },
      ]);
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
      <Header />

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
