import React, { useState, useRef } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import type { QueryEngine } from "./core/engine.js";
import { toolRegistry } from "./tools/registry.js";
import { cleanMarkdown } from "./utils/markdown.js";
import { GroqProvider } from "./provider/groq.js";
import { createGroqProvider, createProvider } from "./provider/client.js";
import { loadConfig } from "./config.js";
import { parseToolArguments } from "./utils/tool-args.js";
import {
  requestedFilePaths,
  shouldUseTools,
  toolNamesForPrompt,
} from "./core/tool-policy.js";
import { DEFAULT_TOKEN_BUDGET, fitRequestToBudget } from "./core/budget.js";

const GROQ_MODELS = [
  { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b" },
  { label: "GPT-OSS 120B", value: "openai/gpt-oss-120b" },
  { label: "Compound (chat)", value: "groq/compound" },
  { label: "Compound Mini (chat)", value: "groq/compound-mini" },
  { label: "Qwen 3.6 27B", value: "qwen/qwen3.6-27b" },
  { label: "Qwen 3.8 27B", value: "qwen/qwen3.8-27b" },
  { label: "Llama 3.3 70B", value: "llama-3.3-70b-versatile" },
  { label: "Llama 3.1 8B", value: "llama-3.1-8b-instant" },
];

const OPENROUTER_FREE_MODELS = [
  {
    label: "Nex AGI: Nex-N2.5-Mini (Free)",
    value: "nex-agi/nex-n2.5-mini:free",
  },
  {
    label: "inclusionAI: Ling 3.0 Flash Fin (Free)",
    value: "inclusionai/ling-3.0-flash-fin:free",
  },
  {
    label: "LiquidAI: LFM2.5-Embedding-350M (Free)",
    value: "liquid/lfm-2.5-embedding-350m:free",
  },
  {
    label: "Dots Studio: Dots3-Note Preview (Free)",
    value: "dots-studio/dots-3-note-preview:free",
  },
  {
    label: "NVIDIA: Nemotron 3.5 Lightning (Free)",
    value: "nvidia/nemotron-3.5-lightning:free",
  },
  {
    label: "Poolside: Laguna S 2.1 (Free)",
    value: "poolside/laguna-s-2.1:free",
  },
  {
    label: "Thinking Machines: Inkling (Free)",
    value: "thinkingmachines/inkling:free",
  },
  {
    label: "NVIDIA: Nemotron 3 Embed 1B (Free)",
    value: "nvidia/nemotron-3-embed-1b:free",
  },
  {
    label: "Cohere: North Mini Code (Free)",
    value: "cohere/north-mini-code:free",
  },
  {
    label: "NVIDIA: Nemotron 3 Ultra (Free)",
    value: "nvidia/nemotron-3-ultra-550b-a55b:free",
  },
  {
    label: "Google: Gemma 4 31B (Free)",
    value: "google/gemma-4-31b-it:free",
  },
  {
    label: "NVIDIA: Nemotron 3 Super (Free)",
    value: "nvidia/nemotron-3-super-120b-a12b:free",
  },
];

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

const COMMANDS = [
  { name: "/help", description: "Show help" },
  { name: "/models", description: "List models" },
  { name: "/model", description: "Switch model" },
  { name: "/tools", description: "List tools" },
  { name: "/clear", description: "Clear chat" },
  { name: "/status", description: "Session status" },
  { name: "/exit", description: "Exit CLI" },
];

function Header() {
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      <Box borderStyle="double" borderColor="cyan" paddingX={4} paddingY={1}>
        <Text bold color="cyan">
          OpenAether CLI
        </Text>
      </Box>
      <Text dimColor>AI-Powered Coding Assistant</Text>
      <Text dimColor italic>
        Built by Saad Asim
      </Text>
    </Box>
  );
}

function StatusBar({
  model,
  messageCount,
}: {
  model: string;
  messageCount: number;
}) {
  return (
    <Box
      justifyContent="space-between"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginBottom={1}
    >
      <Text color="gray">
        Model: <Text color="green">{model}</Text>
      </Text>
      <Text color="gray">
        Messages: <Text color="green">{messageCount}</Text>
      </Text>
      <Text color="gray">
        Tools: <Text color="green">{toolRegistry.getAll().length}</Text>
      </Text>
    </Box>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text color={isUser ? "green" : "cyan"} bold>
        {isUser ? "You> " : "AI> "}
      </Text>
      {isUser ? (
        <Text>{message.content}</Text>
      ) : (
        <Text>{cleanMarkdown(message.content)}</Text>
      )}
      {message.streaming && <Text color="yellow">▋</Text>}
    </Box>
  );
}

function CommandSuggestions({ input }: { input: string }) {
  if (!input.startsWith("/")) return null;

  const matches = COMMANDS.filter(
    (cmd) => cmd.name.startsWith(input) || cmd.name.includes(input),
  );

  if (matches.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {matches.map((cmd, i) => (
        <Box key={cmd.name}>
          <Text color={i === 0 ? "green" : "white"} bold={i === 0}>
            {cmd.name.padEnd(12)}
          </Text>
          <Text dimColor>{cmd.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

function summarizeAction(
  toolName: string,
  args: Record<string, unknown>,
  result: string,
): string {
  const target = typeof args.path === "string" ? args.path : "";
  if (toolName === "write_file") {
    return `${result.startsWith("Updated") ? "Updated" : "Created"} ${target}`;
  }
  if (toolName === "edit_file") return `Updated ${target}`;
  if (toolName === "delete_file") return `Deleted ${target}`;
  if (toolName === "read_file") return `Read ${target}`;
  if (toolName === "merge_files") {
    const sources = Array.isArray(args.sources) ? args.sources.length : 0;
    return `Merged ${sources} file${sources === 1 ? "" : "s"} into ${String(args.target ?? "target")}`;
  }
  if (toolName === "glob")
    return `Found files matching ${String(args.pattern ?? "pattern")}`;
  if (toolName === "grep")
    return `Searched for ${String(args.pattern ?? "pattern")}`;
  if (toolName === "bash") return `Ran command: ${String(args.command ?? "")}`;
  return `${toolName} completed`;
}

function ModelSelector({
  onSelect,
}: {
  onSelect: (model: string, provider: string) => void;
}) {
  const items = [
    { label: "── Groq Models ──", value: "header-groq" },
    ...GROQ_MODELS.map((m) => ({
      label: `${m.label} (Groq)`,
      value: `groq:${m.value}`,
    })),
    { label: "── OpenRouter Free ──", value: "header-openrouter" },
    ...OPENROUTER_FREE_MODELS.map((m) => ({
      label: m.label,
      value: `openrouter:${m.value}`,
    })),
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      marginBottom={1}
    >
      <Text bold color="yellow">
        Select Model (↑↓ to navigate, Enter to select)
      </Text>
      <SelectInput
        items={items}
        onSelect={(item) => {
          if (!item.value.startsWith("header-")) {
            const separatorIndex = item.value.indexOf(":");
            const provider = item.value.slice(0, separatorIndex);
            const modelId = item.value.slice(separatorIndex + 1);
            onSelect(modelId, provider);
          }
        }}
      />
      <Text dimColor>Press Esc to cancel</Text>
    </Box>
  );
}

function InteractiveRepl({ engine }: { engine: QueryEngine }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<
    "request" | "tools" | "final" | "waiting"
  >("request");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState(engine.options.model);
  const [currentProvider, setCurrentProvider] = useState(
    engine.provider instanceof GroqProvider ? "groq" : "openrouter",
  );
  const [streamingMessage, setStreamingMessage] = useState("");
  const { exit } = useApp();
  const currentModelRef = useRef(currentModel);
  const currentProviderRef = useRef(currentProvider);

  React.useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  React.useEffect(() => {
    currentProviderRef.current = currentProvider;
  }, [currentProvider]);

  useInput((input, key) => {
    if (key.escape && showModelSelector) {
      setShowModelSelector(false);
    }
  });

  const executeCommand = async (cmd: string): Promise<boolean> => {
    const [command, ...args] = cmd.trim().split(/\s+/);

    switch (command.toLowerCase()) {
      case "/help":
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "\nCommands:\n" +
              COMMANDS.map(
                (c) => `  ${c.name.padEnd(12)} ${c.description}`,
              ).join("\n") +
              "\n",
          },
        ]);
        return true;

      case "/models":
        setShowModelSelector(true);
        return true;

      case "/model":
        if (args.length > 0) {
          setCurrentModel(args[0]);
          engine.options.model = args[0];
          currentModelRef.current = args[0];
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Model switched to: ${args[0]}` },
          ]);
        } else {
          setShowModelSelector(true);
        }
        return true;

      case "/tools":
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "\nTools:\n" +
              toolRegistry
                .getAll()
                .map((t) => `  ${t.name.padEnd(15)} ${t.description}`)
                .join("\n") +
              "\n",
          },
        ]);
        return true;

      case "/clear":
        engine.messages = engine.messages.slice(0, 1);
        setMessages([]);
        return true;

      case "/status":
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Model: ${currentModel}\nProvider: ${currentProvider}\nMessages: ${messages.length}\nDir: ${process.cwd()}`,
          },
        ]);
        return true;

      case "/exit":
      case "/quit":
        exit();
        return true;

      default:
        return false;
    }
  };

  const handleSubmit = async (value: string) => {
    if (!value.trim()) return;
    if (await executeCommand(value)) {
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: value }]);
    setInput("");
    setIsLoading(true);
    setLoadingPhase("request");
    setStreamingMessage("");

    try {
      const targetFiles = requestedFilePaths(value);
      const scopedValue = targetFiles.length
        ? `${value}\n\nExecution constraints: work only on these requested file(s): ${targetFiles.join(", ")}. Do not use repository-wide search or inspect OpenAether source files. Read the target file, then perform the requested edit before responding.`
        : value;
      engine.messages.push({ role: "user", content: scopedValue });
      const useTools = shouldUseTools(value);
      const availableToolNames = toolNamesForPrompt(value);

      let isComplete = false;
      let maxIterations = 10;
      let toolsExecuted = false;
      let continuationAttempts = 0;
      const requiresMutation =
        /\b(add|create|edit|update|modify|implement|write|change|fix|remove|delete|generate)\b/i.test(
          value,
        );
      const completedActions: string[] = [];

      while (!isComplete && maxIterations > 0) {
        maxIterations--;
        setLoadingPhase(toolsExecuted ? "final" : "request");

        const request = fitRequestToBudget(
          engine.messages,
          useTools ? toolRegistry.toOpenAIFormat(availableToolNames) : [],
          (engine.options.budget ?? DEFAULT_TOKEN_BUDGET).total,
          Math.min(
            engine.options.maxTokens,
            (engine.options.budget ?? DEFAULT_TOKEN_BUDGET).response,
          ),
        );
        const stream = engine.provider.stream(request.messages, {
          model: currentModel,
          maxTokens: toolsExecuted
            ? Math.min(engine.options.maxTokens, 512)
            : engine.options.maxTokens,
          temperature: engine.options.temperature,
          tools: request.tools,
          onRateLimit: (delayMs: number) => {
            setLoadingPhase("waiting");
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Rate limit reached. Retrying in ${Math.ceil(delayMs / 1000)}s...`,
              },
            ]);
          },
        });

        let fullText = "";
        let toolCalls: any[] = [];
        const toolCallMap = new Map<number, any>();

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;

          // Handle text content
          if (delta?.content) {
            fullText += delta.content;
            setStreamingMessage(fullText);
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index ?? 0;
              if (!toolCallMap.has(index)) {
                toolCallMap.set(index, {
                  id: toolCall.id || `call_${index}`,
                  type: "function",
                  function: {
                    name: toolCall.function?.name || "",
                    arguments: toolCall.function?.arguments || "",
                  },
                });
              } else {
                const existing = toolCallMap.get(index);
                if (toolCall.function?.name) {
                  existing.function.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  existing.function.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }

        toolCalls = Array.from(toolCallMap.values());

        const unsupportedToolCalls = toolCalls.filter(
          (toolCall) => !toolRegistry.get(toolCall.function.name),
        );
        toolCalls = toolCalls.filter((toolCall) =>
          toolRegistry.get(toolCall.function.name),
        );

        if (unsupportedToolCalls.length > 0) {
          const names = unsupportedToolCalls
            .map((toolCall) => toolCall.function.name)
            .join(", ");
          engine.messages.push({
            role: "assistant",
            content: `Unsupported tool requested: ${names}. Use only the tools provided by OpenAether.`,
          });
          if (toolCalls.length === 0) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `I could not use ${names}. I can only use the tools provided by OpenAether. Please retry.`,
              },
            ]);
            isComplete = true;
            break;
          }
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          const changedFile = completedActions.some((action) =>
            /Created|Updated|Edited|Deleted|Wrote/i.test(action),
          );
          if (
            requiresMutation &&
            toolsExecuted &&
            !changedFile &&
            continuationAttempts < 2
          ) {
            continuationAttempts++;
            if (fullText) {
              engine.messages.push({ role: "assistant", content: fullText });
            }
            engine.messages.push({
              role: "user",
              content:
                "Continue the requested implementation now. Inspection is complete; use edit_file or write_file on the specifically requested file. Do not answer with a question or a progress summary until the file is changed.",
            });
            continue;
          }
          if (fullText) {
            engine.messages.push({ role: "assistant", content: fullText });
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullText },
            ]);
          }
          isComplete = true;
          break;
        }

        // Add assistant message with tool calls
        engine.messages.push({
          role: "assistant",
          content: fullText || null,
          tool_calls: toolCalls,
        });

        // Execute tools without adding noisy intermediate messages to the chat.
        setLoadingPhase("tools");
        toolsExecuted = true;

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: any = {};

          try {
            toolArgs = parseToolArguments(toolCall.function.arguments);
          } catch (error) {
            engine.messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Invalid JSON tool arguments. Return only a valid JSON object and try again: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
            continue;
          }

          const tool = toolRegistry.get(toolName);
          if (tool) {
            try {
              const result = await tool.execute(toolArgs);

              engine.messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result.content || result.error || "Tool executed",
              });
              if (result.success && result.content) {
                completedActions.push(
                  summarizeAction(toolName, toolArgs, result.content),
                );
              }
            } catch (error) {
              engine.messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: `Error: ${error}`,
              });
            }
          }
        }
      }

      if (completedActions.length > 0) {
        setMessages((prev) => {
          const finalMessage = prev[prev.length - 1];
          const summary = `Completed:\n${completedActions
            .map((action) => `- ${action}`)
            .join("\n")}`;
          if (finalMessage?.role !== "assistant") {
            return [...prev, { role: "assistant", content: summary }];
          }
          return prev.map((message, index) =>
            index === prev.length - 1
              ? { ...message, content: `${message.content}\n\n${summary}` }
              : message,
          );
        });
      }

      if (maxIterations === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Max iterations reached" },
        ]);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setStreamingMessage("");
      setLoadingPhase("request");
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <StatusBar model={currentModel} messageCount={messages.length} />

      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streamingMessage && (
          <MessageBubble
            message={{
              role: "assistant",
              content: streamingMessage,
              streaming: true,
            }}
          />
        )}
        {isLoading && !streamingMessage && (
          <Box marginBottom={1}>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text dimColor>
              {loadingPhase === "tools"
                ? " Running tools..."
                : loadingPhase === "final"
                  ? " Finishing response..."
                  : loadingPhase === "waiting"
                    ? " Waiting for rate limit..."
                    : " Thinking..."}
            </Text>
          </Box>
        )}
      </Box>

      {showModelSelector && (
        <ModelSelector
          onSelect={(model, provider) => {
            const config = loadConfig();
            if (provider === "groq") {
              if (!config.groqApiKey) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: "GROQ_API_KEY not set. Add it to your .env file.",
                  },
                ]);
                setShowModelSelector(false);
                return;
              }
              engine.provider = createGroqProvider(config.groqApiKey);
            } else {
              engine.provider = createProvider({
                ...config,
                provider: "openrouter",
              });
            }
            setCurrentModel(model);
            setCurrentProvider(provider);
            engine.options.model = model;
            currentModelRef.current = model;
            currentProviderRef.current = provider;
            setShowModelSelector(false);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Model switched to: ${model} (${provider})`,
              },
            ]);
          }}
        />
      )}

      <CommandSuggestions input={input} />

      <Box borderStyle="round" borderColor="green" paddingX={1}>
        <Text color="green" bold>
          {"You> "}
        </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type / for commands"
        />
      </Box>
    </Box>
  );
}

export function startRepl(engine: QueryEngine): void {
  render(<InteractiveRepl engine={engine} />);
}
