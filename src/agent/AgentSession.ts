import type { AgentMessage, AgentMemory, AgentTool } from "./types.js";
import { createMemory } from "./types.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface SessionConfig {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * AgentSession holds the single source of truth for one agent run:
 * - conversation messages
 * - structured memory (goal, files touched, errors)
 * - tool registry
 * - runtime config
 *
 * It exposes a `buildRequest()` that produces the exact message array
 * sent to the provider on each iteration, including the memory summary.
 */
export class AgentSession {
  public readonly messages: AgentMessage[] = [];
  public readonly memory: AgentMemory;
  public readonly tools: ToolRegistry;
  public readonly config: SessionConfig;

  constructor(tools: ToolRegistry, config: SessionConfig, goal = "") {
    this.tools = tools;
    this.config = config;
    this.memory = createMemory(goal);
    this.messages.push({
      role: "system",
      content: config.systemPrompt,
    });
  }

  setGoal(goal: string): void {
    this.memory.goal = goal;
  }

  addUser(content: string): void {
    if (!this.memory.goal) this.memory.goal = content;
    this.messages.push({ role: "user", content });
  }

  addAssistant(message: AgentMessage): void {
    this.messages.push(message);
  }

  addToolResult(message: AgentMessage): void {
    this.messages.push(message);
  }

  /**
   * Build the request sent to the provider on this iteration.
   * Injects a compact memory summary at the end of the system prompt so
   * long conversations stay small.
   */
  buildRequest(): AgentMessage[] {
    const summary = this.memorySummary();
    const messages = this.messages.slice();
    if (summary) {
      messages[0] = {
        role: "system",
        content: `${this.config.systemPrompt}\n\n${summary}`,
      };
    }
    return messages;
  }

  private memorySummary(): string {
    const m = this.memory;
    const parts: string[] = [];
    if (m.goal) parts.push(`Goal: ${m.goal}`);
    if (m.filesRead.size)
      parts.push(`Files read: ${[...m.filesRead].slice(-8).join(", ")}`);
    if (m.filesWritten.size)
      parts.push(`Files written: ${[...m.filesWritten].slice(-8).join(", ")}`);
    if (m.commandsRun.length)
      parts.push(`Commands run: ${m.commandsRun.slice(-5).join(" | ")}`);
    if (m.errors.length)
      parts.push(`Recent errors: ${m.errors.slice(-3).join(" | ")}`);
    if (m.verification)
      parts.push(
        `Verification: ${m.verification.passed ? "passed" : "failed"} (${m.verification.lastRun})`,
      );
    if (m.plan) parts.push(`Plan:\n${m.plan}`);
    return parts.length ? `── MEMORY ──\n${parts.join("\n")}` : "";
  }

  clear(): void {
    const system = this.messages[0];
    this.messages.length = 0;
    if (system) this.messages.push(system);
    this.memory.goal = "";
    this.memory.filesRead.clear();
    this.memory.filesWritten.clear();
    this.memory.filesDeleted.clear();
    this.memory.commandsRun.length = 0;
    this.memory.errors.length = 0;
    this.memory.verification = null;
    this.memory.plan = null;
  }

  /** Returns true if no tool succeeded in the last N rounds. */
  hasRecentProgress(rounds: number): boolean {
    // Look back through the last N assistant+tool pairs for a successful tool call.
    let count = 0;
    for (let i = this.messages.length - 1; i >= 0 && count < rounds; i--) {
      const msg = this.messages[i];
      if (msg.role === "tool" && msg.content) {
        if (!String(msg.content).startsWith("ERROR")) return true;
        count++;
      }
    }
    return false;
  }
}
