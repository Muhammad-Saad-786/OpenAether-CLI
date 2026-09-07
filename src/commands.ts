// src/commands.ts
import { ToolRegistry } from "./tools/registry";

export interface Command {
  name: string;
  description: string;
  execute: (args: string[], context: CommandContext) => Promise<void>;
}

export interface CommandContext {
  session: any; // Your session type
  tools: ToolRegistry;
  workingDir: string;
  print: (message: string) => void;
}

// Basic slash commands for REPL
export const commands: Command[] = [
  {
    name: "/help",
    description: "Show available commands",
    execute: async (args, context) => {
      context.print("Available commands:");
      commands.forEach((cmd) => {
        context.print(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
      });
      context.print("");
      context.print("Available tools:");
      context.tools.getAll().forEach((tool) => {
        context.print(`  ${tool.name.padEnd(15)} ${tool.description}`);
      });
    },
  },
  {
    name: "/clear",
    description: "Clear conversation history",
    execute: async (args, context) => {
      context.session.clear();
      context.print("Conversation cleared.");
    },
  },
  {
    name: "/exit",
    description: "Exit the REPL",
    execute: async (args, context) => {
      context.print("Goodbye!");
      process.exit(0);
    },
  },
  {
    name: "/model",
    description: "Show or change current model",
    execute: async (args, context) => {
      if (args.length === 0) {
        context.print(`Current model: ${context.session.model}`);
      } else {
        context.session.model = args[0];
        context.print(`Model changed to: ${args[0]}`);
      }
    },
  },
  {
    name: "/pwd",
    description: "Show current working directory",
    execute: async (args, context) => {
      context.print(context.workingDir);
    },
  },
];

// Parse and execute a command
export async function executeCommand(
  input: string,
  context: CommandContext,
): Promise<boolean> {
  // Check if it's a command (starts with /)
  if (!input.startsWith("/")) {
    return false; // Not a command, treat as regular query
  }

  const parts = input.split(" ");
  const commandName = parts[0];
  const args = parts.slice(1);

  const command = commands.find((cmd) => cmd.name === commandName);

  if (!command) {
    context.print(`Unknown command: ${commandName}`);
    context.print("Type /help for available commands");
    return true;
  }

  try {
    await command.execute(args, context);
  } catch (error) {
    context.print(`Error executing command: ${error}`);
  }

  return true;
}

// Check if input is a command
export function isCommand(input: string): boolean {
  return input.startsWith("/");
}
