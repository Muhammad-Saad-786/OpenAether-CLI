export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: Array<Record<string, unknown>>,
): number {
  return messages.reduce(
    (total, message) => total + estimateTokens(JSON.stringify(message)) + 4,
    2,
  );
}
