/**
 * Configuration loader.
 *
 * Users only need to provide API keys. Everything else has a sensible
 * default baked in here. Any of these can still be overridden via
 * environment variables — but they don't have to be.
 */

export interface Config {
  apiKey: string;
  groqApiKey?: string;
  provider: "openrouter" | "groq";
  siteUrl: string;
  appName: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

// ─── Defaults ────────────────────────────────────────────────
const DEFAULTS = {
  groqModel: "openai/gpt-oss-120b",
  openrouterModel: "cohere/north-mini-code:free",
  groqMaxTokens: 8000,
  openrouterMaxTokens: 8000,
  groqTemperature: 0.4,
  openrouterTemperature: 0.5,
  siteUrl: "http://localhost:3000",
  appName: "OpenAether CLI",
} as const;

export function loadConfig(): Config {
  const explicitProvider = process.env.PROVIDER?.toLowerCase();
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  // Provider selection:
  //   1. Explicit PROVIDER env var wins.
  //   2. If only one key is present, use that provider.
  //   3. If both are present, prefer Groq (lower latency on free tier).
  //   4. If neither, default to OpenRouter (will fail at request time, but
  //      the setup wizard will have prompted for keys by then).
  let provider: "openrouter" | "groq";
  if (explicitProvider === "groq" || explicitProvider === "openrouter") {
    provider = explicitProvider;
  } else if (hasGroq && !hasOpenRouter) {
    provider = "groq";
  } else if (hasOpenRouter && !hasGroq) {
    provider = "openrouter";
  } else if (hasGroq && hasOpenRouter) {
    provider = "groq";
  } else {
    provider = "openrouter";
  }

  const isGroq = provider === "groq";

  const defaultModel = isGroq ? DEFAULTS.groqModel : DEFAULTS.openrouterModel;
  const defaultMaxTokens = isGroq
    ? DEFAULTS.groqMaxTokens
    : DEFAULTS.openrouterMaxTokens;
  const defaultTemperature = isGroq
    ? DEFAULTS.groqTemperature
    : DEFAULTS.openrouterTemperature;

  const envModel = isGroq
    ? process.env.GROQ_MODEL
    : process.env.OPENROUTER_MODEL;
  const envMaxTokens = isGroq
    ? process.env.GROQ_MAX_TOKENS
    : process.env.OPENROUTER_MAX_TOKENS;
  const envTemperature = isGroq
    ? process.env.GROQ_TEMPERATURE
    : process.env.OPENROUTER_TEMPERATURE;

  const maxTokens = envMaxTokens
    ? Number.parseInt(envMaxTokens, 10)
    : defaultMaxTokens;
  const temperature = envTemperature
    ? Number.parseFloat(envTemperature)
    : defaultTemperature;

  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    provider,
    siteUrl: process.env.OPENROUTER_SITE_URL || DEFAULTS.siteUrl,
    appName: process.env.OPENROUTER_APP_NAME || DEFAULTS.appName,
    model: envModel || defaultModel,
    maxTokens:
      Number.isFinite(maxTokens) && maxTokens > 0
        ? maxTokens
        : defaultMaxTokens,
    temperature: Number.isFinite(temperature)
      ? temperature
      : defaultTemperature,
  };
}
