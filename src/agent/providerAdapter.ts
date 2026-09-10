import type { Config } from "../config.js";
import { createProvider } from "../provider/client.js";
import type { ChatProvider } from "../provider/client.js";

/**
 * Returns a ChatProvider for the given config. This is the single
 * entry point the AgentLoop uses — it never touches providers directly.
 */
export function getAgentProvider(config: Config): ChatProvider {
  return createProvider(config) as unknown as ChatProvider;
}
