import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentMessage, AgentMemory } from "./types.js";
import { createMemory } from "./types.js";
import { ToolRegistry } from "../tools/registry.js";
import { MemoryCompressor } from "./memory.js";
import { scanRepo, formatRepoMap, type RepoMap } from "./repoMap.js";
import { SymbolIndex } from "./symbolIndex.js";

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
  public readonly symbolIndex: SymbolIndex;
  public readonly lockedFiles = new Set<string>();

  private readonly compressor = new MemoryCompressor(8);
  private repoMap: RepoMap | null = null;
  private repoSummary = "";
  private isGitRepo = false;

  constructor(config: SessionConfig, goal = "", registry?: ToolRegistry) {
    this.config = config;
    this.memory = createMemory(goal);
    this.symbolIndex = new SymbolIndex();
    this.tools = registry ?? new ToolRegistry(this.symbolIndex);
    this.messages.push({
      role: "system",
      content: config.systemPrompt,
    });
  }

  async initRepoMap(cwd = process.cwd()): Promise<void> {
    if (this.repoMap) return;
    this.repoMap = await scanRepo(cwd);
    this.repoSummary = formatRepoMap(this.repoMap);
    await this.symbolIndex.build();

    // Detect whether the workspace is a git repository once. This affects
    // whether `/undo` and diff rendering are available.
    try {
      await fs.access(path.join(cwd, ".git"));
      this.isGitRepo = true;
    } catch {
      this.isGitRepo = false;
    }
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

    const compressed = this.compressor.compress([
      systemMessage,
      ...this.messages.slice(1),
    ]);

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

    if (!this.isGitRepo) {
      parts.push(
        "Workspace: not a git repository. Native diffs and `/undo` are unavailable; " +
          "the agent should describe file changes in text rather than relying on git.",
      );
    }

    if (this.symbolIndex.isBuilt()) {
      const top = this.symbolIndex.topExports(30);
      if (top.length) {
        const lines = top.map(
          (s) => `${s.file}:${s.line} [${s.kind}] ${s.name}`,
        );
        parts.push(`── KEY SYMBOLS ──\n${lines.join("\n")}`);
      }
    }

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
