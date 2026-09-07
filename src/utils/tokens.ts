export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(
  messages: Array<{ content: string | null }>,
): number {
  return messages.reduce(
    (total, message) => total + estimateTokens(message.content ?? "") + 4,
    2,
  );
}
