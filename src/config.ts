import "dotenv/config";

export type Config = {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  siteUrl: string;
  appName: string;
};

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function loadConfig(): Config {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey)
    throw new Error(
      "OPENROUTER_API_KEY is required. Copy .env.example to .env and set it.",
    );
  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4-turbo",
    maxTokens: numberEnv("OPENROUTER_MAX_TOKENS", 4096),
    temperature: numberEnv("OPENROUTER_TEMPERATURE", 0.2),
    siteUrl: process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME || "OpenAether CLI",
  };
}
