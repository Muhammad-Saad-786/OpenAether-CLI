export interface Config {
  apiKey: string;
  groqApiKey?: string;
  provider?: "openrouter" | "groq";
  siteUrl: string;
  appName: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export function loadConfig(): Config {
  const configuredProvider = process.env.PROVIDER?.toLowerCase();
  const provider: "openrouter" | "groq" =
    configuredProvider === "openrouter" || configuredProvider === "groq"
      ? configuredProvider
      : process.env.GROQ_MODEL ||
          (process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY)
        ? "groq"
        : "openrouter";
  const isGroq = provider === "groq";
  const configuredMaxTokens = Number.parseInt(
    isGroq
      ? process.env.GROQ_MAX_TOKENS || "500"
      : process.env.OPENROUTER_MAX_TOKENS || "4000",
    10,
  );
  const configuredTemperature = Number.parseFloat(
    isGroq
      ? process.env.GROQ_TEMPERATURE || "0.5"
      : process.env.OPENROUTER_TEMPERATURE || "0.5",
  );

  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    provider,
    siteUrl: process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME || "OpenAether CLI",
    model: isGroq
      ? process.env.GROQ_MODEL || "openai/gpt-oss-20b"
      : process.env.OPENROUTER_MODEL || "nex-agi/nex-n2.5-mini:free",
    maxTokens:
      Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0
        ? configuredMaxTokens
        : isGroq
          ? 500
          : 4000,
    temperature: Number.isFinite(configuredTemperature)
      ? configuredTemperature
      : 0.5,
  };
}
export const config = {
  provider: process.env.OPENAETHER_PROVIDER || "openai",
  openaiKey: process.env.OPENAI_API_KEY || "",
  groqKey: process.env.GROQ_API_KEY || "",
  retry: {
    maxAttempts: 5,
    initialDelayMs: 200,
    maxDelayMs: 2000,
  },
};
