export type Role = "system" | "user" | "assistant" | "tool";

export type Message = {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolUse[];
};

export type ToolUse = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type CompletionOptions = {
  model: string;
  maxTokens: number;
  temperature: number;
  stream?: boolean;
  tools?: ToolDefinition[];
};

export type CompletionResult = {
  message: Message;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};
export interface ProviderCapabilities {
  supportsTools: boolean;
  contextWindow: number;
  maxOutput: number;
  rateLimits?: {
    rpm?: number;
    tpm?: number;
    rpd?: number;
  };
}

export interface ChatProvider {
  readonly name: string;
  stream(messages: Message[], options: CompletionOptions): AsyncGenerator<any>;
  complete(
    messages: Message[],
    options: CompletionOptions,
  ): Promise<CompletionResult>;
  capabilities(model: string): ProviderCapabilities;
  isRateLimitError(error: unknown): boolean;
}
