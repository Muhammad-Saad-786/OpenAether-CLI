import React, { useState } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import type { QueryEngine } from "./core/engine.js";
import { toolRegistry } from "./tools/registry.js";
import { cleanMarkdown } from "./utils/markdown.ts";

const FREE_MODELS = [
  // Meta Llama Models
  {
    label: "Llama 3.2 3B (Free)",
    value: "meta-llama/llama-3.2-3b-instruct:free",
  },
  {
    label: "Llama 3.2 1B (Free)",
    value: "meta-llama/llama-3.2-1b-instruct:free",
  },
  {
    label: "Llama 3.1 8B (Free)",
    value: "meta-llama/llama-3.1-8b-instruct:free",
  },
  {
    label: "Llama 3.1 70B (Free)",
    value: "meta-llama/llama-3.1-70b-instruct:free",
  },
  {
    label: "Llama 3.1 405B (Free)",
    value: "meta-llama/llama-3.1-405b-instruct:free",
  },
  {
    label: "Llama 3 8B (Free)",
    value: "meta-llama/llama-3-8b-instruct:free",
  },
  {
    label: "Llama 3 70B (Free)",
    value: "meta-llama/llama-3-70b-instruct:free",
  },

  // Google Gemini Models
  {
    label: "Gemini Flash 1.5 (Free)",
    value: "google/gemini-flash-1.5:free",
  },
  {
    label: "Gemini Flash 1.5 8B (Free)",
    value: "google/gemini-flash-1.5-8b:free",
  },
  {
    label: "Gemini Flash 2.0 (Free)",
    value: "google/gemini-flash-2.0:free",
  },
  {
    label: "Gemini Pro 2.0 (Free)",
    value: "google/gemini-pro-2.0:free",
  },

  // Qwen Models
  {
    label: "Qwen 2.5 7B (Free)",
    value: "qwen/qwen-2.5-7b-instruct:free",
  },
  {
    label: "Qwen 2.5 14B (Free)",
    value: "qwen/qwen-2.5-14b-instruct:free",
  },
  {
    label: "Qwen 2.5 72B (Free)",
    value: "qwen/qwen-2.5-72b-instruct:free",
  },
  {
    label: "Qwen 2.5 Coder 32B (Free)",
    value: "qwen/qwen-2.5-coder-32b-instruct:free",
  },
  {
    label: "Qwen 3 8B (Free)",
    value: "qwen/qwen-3-8b:free",
  },
  {
    label: "Qwen 3 14B (Free)",
    value: "qwen/qwen-3-14b:free",
  },
  {
    label: "Qwen 3 30B (Free)",
    value: "qwen/qwen-3-30b-a3b:free",
  },
  {
    label: "Qwen 3 Coder (Free)",
    value: "qwen/qwen-3-coder:free",
  },

  // Mistral Models
  {
    label: "Mistral 7B (Free)",
    value: "mistralai/mistral-7b-instruct:free",
  },
  {
    label: "Mistral 8B (Free)",
    value: "mistralai/mistral-8b-instruct:free",
  },
  {
    label: "Mistral Small 3 (Free)",
    value: "mistralai/mistral-small-3-instruct:free",
  },

  // Microsoft Phi Models
  {
    label: "Phi-3 Mini (Free)",
    value: "microsoft/phi-3-mini-128k-instruct:free",
  },
  {
    label: "Phi-3 Medium (Free)",
    value: "microsoft/phi-3-medium-128k-instruct:free",
  },
  {
    label: "Phi-3.5 Mini (Free)",
    value: "microsoft/phi-3.5-mini-instruct:free",
  },

  // DeepSeek Models
  {
    label: "DeepSeek Coder (Free)",
    value: "deepseek/deepseek-coder:free",
  },
  {
    label: "DeepSeek R1 (Free)",
    value: "deepseek/deepseek-r1:free",
  },
  {
    label: "DeepSeek V3 (Free)",
    value: "deepseek/deepseek-v3:free",
  },

  // MiniMax Models
  {
    label: "MiniMax M3 (Free)",
    value: "minimax/minimax-m3:free",
  },
  {
    label: "MiniMax M2 (Free)",
    value: "minimax/minimax-m2:free",
  },
  {
    label: "MiniMax M1 (Free)",
    value: "minimax/minimax-m1:free",
  },

  // NVIDIA Models
  {
    label: "NVIDIA Nemotron 70B (Free)",
    value: "nvidia/llama-3.1-nemotron-70b-instruct:free",
  },
  {
    label: "NVIDIA Nemotron 8B (Free)",
    value: "nvidia/llama-3.1-nemotron-8b-instruct:free",
  },
  {
    label: "NVIDIA Nemotron Super 120B (Free)",
    value: "nvidia/nemotron-3-super-120b-a12b:free",
  },

  // Cohere Models
  {
    label: "Cohere Command R (Free)",
    value: "cohere/command-r:free",
  },
  {
    label: "Cohere Command R7B (Free)",
    value: "cohere/command-r7b:free",
  },

  // xAI Models
  {
    label: "Grok 3 Mini (Free)",
    value: "x-ai/grok-3-mini:free",
  },
  {
    label: "Grok 3 Beta (Free)",
    value: "x-ai/grok-3-beta:free",
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
  { name: "/free", description: "Free models" },
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
    <Box marginBottom={1}>
      <Text color={isUser ? "green" : "cyan"} bold>
        {isUser ? "You> " : "AI> "}
      </Text>
      <Text>{cleanMarkdown(message.content)}</Text>
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

function ModelSelector({ onSelect }: { onSelect: (model: string) => void }) {
  const items = [
    { label: "── Free Models ──", value: "header-free" },
    ...FREE_MODELS,
    { label: "── Paid Models ──", value: "header-paid" },
    { label: "GPT-4 Turbo", value: "openai/gpt-4-turbo" },
    { label: "GPT-4o", value: "openai/gpt-4o" },
    { label: "Claude 3 Opus", value: "anthropic/claude-3-opus" },
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
            onSelect(item.value);
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
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState(engine.options.model);
  const [streamingMessage, setStreamingMessage] = useState("");
  const { exit } = useApp();
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
      case "/free":
        setShowModelSelector(true);
        return true;

      case "/model":
        if (args.length > 0) {
          setCurrentModel(args[0]);
          engine.options.model = args[0];
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
            content: `Model: ${currentModel}\nMessages: ${messages.length}\nDir: ${process.cwd()}`,
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
    setStreamingMessage("");

    try {
      engine.messages.push({ role: "user", content: value });

      let isComplete = false;
      let maxIterations = 10;

      while (!isComplete && maxIterations > 0) {
        maxIterations--;

        const stream = engine.provider.stream(engine.messages, {
          model: currentModel,
          maxTokens: engine.options.maxTokens,
          temperature: engine.options.temperature,
          tools: toolRegistry.toOpenAIFormat(), // Pass tools
        });

        let fullText = "";
        let toolCalls: any[] = [];
        const toolCallMap = new Map<number, any>();

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          // Handle text content
          if (delta?.content) {
            fullText += delta.content;
            setStreamingMessage(fullText);
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              const index = toolCall.index;
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

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
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

        // Execute tools
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `🔧 Executing tools...` },
        ]);

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: any = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            toolArgs = {};
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

              // Show tool result to user
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `✅ ${toolName}: ${(result.content || "").substring(0, 200)}`,
                },
              ]);
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

      if (maxIterations === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Max iterations reached" },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingMessage("");
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
            <Text dimColor> Thinking...</Text>
          </Box>
        )}
      </Box>

      {showModelSelector && (
        <ModelSelector
          onSelect={(model) => {
            setCurrentModel(model);
            engine.options.model = model;
            setShowModelSelector(false);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Model switched to: ${model}` },
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
