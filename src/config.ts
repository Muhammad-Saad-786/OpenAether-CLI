export interface Config {
  apiKey: string;
  groqApiKey?: string;
  mistralApiKey?: string;
  provider: "openrouter" | "groq" | "mistral";
  siteUrl: string;
  appName: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

const DEFAULTS = {
  groqModel: "openai/gpt-oss-120b",
  openrouterModel: "cohere/north-mini-code:free",
  mistralModel: "mistral-medium-3-5",
  groqMaxTokens: 8000,
  openrouterMaxTokens: 8000,
  mistralMaxTokens: 8000,
  groqTemperature: 0.3,
  openrouterTemperature: 0.4,
  mistralTemperature: 0.3,
  siteUrl: "http://localhost:3000",
  appName: "OpenAether CLI",
} as const;

export function loadConfig(): Config {
  const explicitProvider = process.env.PROVIDER?.toLowerCase();
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasMistral = Boolean(process.env.MISTRAL_API_KEY);

  let provider: "openrouter" | "groq" | "mistral";
  if (
    explicitProvider === "groq" ||
    explicitProvider === "openrouter" ||
    explicitProvider === "mistral"
  ) {
    provider = explicitProvider;
  } else if (hasMistral && !hasGroq && !hasOpenRouter) {
    provider = "mistral";
  } else if (hasGroq) {
    provider = "groq";
  } else if (hasOpenRouter) {
    provider = "openrouter";
  } else {
    provider = "mistral";
  }

  const defaults = {
    groq: {
      model: DEFAULTS.groqModel,
      maxTokens: DEFAULTS.groqMaxTokens,
      temperature: DEFAULTS.groqTemperature,
      envModel: process.env.GROQ_MODEL,
      envMaxTokens: process.env.GROQ_MAX_TOKENS,
      envTemperature: process.env.GROQ_TEMPERATURE,
    },
    openrouter: {
      model: DEFAULTS.openrouterModel,
      maxTokens: DEFAULTS.openrouterMaxTokens,
      temperature: DEFAULTS.openrouterTemperature,
      envModel: process.env.OPENROUTER_MODEL,
      envMaxTokens: process.env.OPENROUTER_MAX_TOKENS,
      envTemperature: process.env.OPENROUTER_TEMPERATURE,
    },
    mistral: {
      model: DEFAULTS.mistralModel,
      maxTokens: DEFAULTS.mistralMaxTokens,
      temperature: DEFAULTS.mistralTemperature,
      envModel: process.env.MISTRAL_MODEL,
      envMaxTokens: process.env.MISTRAL_MAX_TOKENS,
      envTemperature: process.env.MISTRAL_TEMPERATURE,
    },
  }[provider];

  const maxTokens = defaults.envMaxTokens
    ? Number.parseInt(defaults.envMaxTokens, 10)
    : defaults.maxTokens;
  const temperature = defaults.envTemperature
    ? Number.parseFloat(defaults.envTemperature)
    : defaults.temperature;

  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    mistralApiKey: process.env.MISTRAL_API_KEY || "",
    provider,
    siteUrl: process.env.OPENROUTER_SITE_URL || DEFAULTS.siteUrl,
    appName: process.env.OPENROUTER_APP_NAME || DEFAULTS.appName,
    model: defaults.envModel || defaults.model,
    maxTokens:
      Number.isFinite(maxTokens) && maxTokens > 0
        ? maxTokens
        : defaults.maxTokens,
    temperature: Number.isFinite(temperature)
      ? temperature
      : defaults.temperature,
  };
}
