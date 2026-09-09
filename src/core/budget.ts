import type { Message } from "../provider/types.js";
import { estimateMessagesTokens, estimateTokens } from "../utils/tokens.js";

export interface TokenBudgetAllocation {
  context: number;
  prompt: number;
  history: number;
  response: number;
  total: number;
}

export const DEFAULT_TOKEN_BUDGET: TokenBudgetAllocation = {
  context: 900,
  prompt: 300,
  history: 400,
  response: 800,
  total: 2400,
};

export interface BudgetSnapshot extends TokenBudgetAllocation {
  used: number;
  remaining: number;
}

export function createBudget(
  overrides: Partial<TokenBudgetAllocation> = {},
): TokenBudgetAllocation {
  const budget = { ...DEFAULT_TOKEN_BUDGET, ...overrides };
  return { ...budget, total: budget.total || 2400 };
}

export function trimToTokenBudget(text: string, limit: number): string {
  if (estimateTokens(text) <= limit) return text;
  return `${text.slice(0, Math.max(0, limit * 4 - 24))}\n[truncated]`;
}

export function fitMessagesToBudget(
  messages: Message[],
  historyLimit: number,
): Message[] {
  if (!messages.length) return [];

  const system = messages[0];
  const latest = messages[messages.length - 1];
  const systemBudget = Math.min(600, Math.floor(historyLimit * 0.4));
  const latestBudget = Math.min(500, Math.floor(historyLimit * 0.4));
  const systemMessage = {
    ...system,
    content: trimToTokenBudget(String(system.content ?? ""), systemBudget),
  };
  const latestMessage = {
    ...latest,
    content: trimToTokenBudget(String(latest.content ?? ""), latestBudget),
  };

  if (messages.length === 1) return [systemMessage];
  const recent: Message[] = [];
  let used = estimateMessagesTokens([
    systemMessage as unknown as Record<string, unknown>,
    latestMessage as unknown as Record<string, unknown>,
  ]);
  for (let index = messages.length - 2; index > 0; index--) {
    const message = messages[index];
    const remaining = Math.max(0, historyLimit - used);
    if (!remaining) break;
    const messageBudget = Math.min(220, Math.floor(remaining * 0.8));
    const compactMessage = {
      ...message,
      content: trimToTokenBudget(String(message.content ?? ""), messageBudget),
    };
    const cost = estimateMessagesTokens([
      compactMessage as unknown as Record<string, unknown>,
    ]);
    if (used + cost > historyLimit) break;
    recent.unshift(compactMessage);
    used += cost;
  }
  return latest === system
    ? [systemMessage]
    : [systemMessage, ...recent, latestMessage];
}

export function fitRequestToBudget(
  messages: Message[],
  tools: unknown[],
  totalBudget: number,
  responseBudget: number,
): { messages: Message[]; tools: unknown[] } {
  const toolCost = estimateTokens(JSON.stringify(tools));
  const messageBudget = Math.max(
    700,
    totalBudget - responseBudget - Math.min(toolCost, 700),
  );
  return {
    messages: fitMessagesToBudget(messages, messageBudget),
    tools,
  };
}

export function getBudgetSnapshot(
  context: string,
  prompt: string,
  messages: Message[],
  budget: TokenBudgetAllocation = DEFAULT_TOKEN_BUDGET,
): BudgetSnapshot {
  const used =
    estimateTokens(context) +
    estimateTokens(prompt) +
    estimateMessagesTokens(
      messages as unknown as Array<Record<string, unknown>>,
    );
  return { ...budget, used, remaining: Math.max(0, budget.total - used) };
}
