export interface Config {
  apiKey: string;
  groqApiKey?: string;
  provider?: "openrouter" | "groq";
  siteUrl: string;
  appName: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export function loadConfig(): Config {
  const provider =
    (process.env.PROVIDER as "openrouter" | "groq" | undefined) ||
    (process.env.GROQ_MODEL ||
    (process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY)
      ? "groq"
      : "openrouter");

  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    provider,
    siteUrl: process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME || "OpenAether CLI",
    model:
      process.env.OPENROUTER_MODEL ||
      process.env.GROQ_MODEL ||
      (provider === "groq"
        ? "groq/compound-mini"
        : "qwen/qwen-2.5-7b-instruct:free"),
    maxTokens: parseInt(
      process.env.OPENROUTER_MAX_TOKENS ||
        process.env.GROQ_MAX_TOKENS ||
        "4000",
    ),
    temperature: parseFloat(
      process.env.OPENROUTER_TEMPERATURE ||
        process.env.GROQ_TEMPERATURE ||
        "0.5",
    ),
  };
}
