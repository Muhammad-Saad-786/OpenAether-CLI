import type { Config } from "../config.js";
import { OpenRouterProvider } from "./openrouter.js";

export function createProvider(config: Config): OpenRouterProvider {
  return new OpenRouterProvider(config);
}
