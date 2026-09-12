import type { AgentMessage, AgentMemory, AgentTool } from "./types.js";
import { createMemory } from "./types.js";
import type { ToolRegistry } from "../tools/registry.js";
import { MemoryCompressor } from "./memory.js";
import { scanRepo, formatRepoMap, type RepoMap } from "./repoMap.js";

export interface SessionConfig {
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export class AgentSession {
  public readonly messages: AgentMessage[] = [];
  public readonly memory: AgentMemory;
  public readonly tools: ToolRegistry;
  public readonly config: SessionConfig;
  public readonly lockedFiles = new Set<string>();

  private readonly compressor = new MemoryCompressor(8);
  private repoMap: RepoMap | null = null;
  private repoSummary = "";

  constructor(tools: ToolRegistry, config: SessionConfig, goal = "") {
    this.tools = tools;
    this.config = config;
    this.memory = createMemory(goal);
    this.messages.push({
      role: "system",
      content: config.systemPrompt,
    });
  }

  /**
   * Load the repo map once. Safe to call multiple times — subsequent
   * calls are no-ops.
   */
  async initRepoMap(cwd = process.cwd()): Promise<void> {
    if (this.repoMap) return;
    this.repoMap = await scanRepo(cwd);
    this.repoSummary = formatRepoMap(this.repoMap);
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
   *   [system prompt + repo summary + memory] + [compressed history]
   */
  buildRequest(): AgentMessage[] {
    const memorySummary = this.buildMemorySummary();
    const baseSystem = this.config.systemPrompt;
    const parts = [baseSystem, this.repoSummary, memorySummary].filter(Boolean);

    const systemMessage: AgentMessage = {
      role: "system",
      content: parts.join("\n\n"),
    };

    // Compress older messages.
    const compressed = this.compressor.compress([
      systemMessage,
      ...this.messages.slice(1),
    ]);

    //After 10 turns, compressed count bounded by 10 messages, so we can keep the last 10 messages in memory.
    console.error(
      `[session] sending ${compressed.length} messages (total history: ${this.messages.length})`,
    );

    return compressed;
  }

  private buildMemorySummary(): string {
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
    this.lockedFiles.clear();
    this.memory.commandsRun.length = 0;
    this.memory.errors.length = 0;
    this.memory.verification = null;
    this.memory.plan = null;
  }
}
