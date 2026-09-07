export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function formatProviderError(error: unknown): string {
  if (error instanceof OpenRouterError)
    return `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`;
  return error instanceof Error ? error.message : String(error);
}
