import "dotenv/config";
import { OpenRouterProvider } from "./src/provider/openrouter";
import type { Config } from "./src/config";

async function main() {
  console.log("Testing OpenRouter API...");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY not set");
    console.error(
      "Set it in .env file or: export OPENROUTER_API_KEY=your_key_here",
    );
    process.exit(1);
  }

  // Create config object
  const config: Config = {
    apiKey: apiKey,
    siteUrl: process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
    appName: process.env.OPENROUTER_APP_NAME || "OpenAether CLI",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo",
    maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || "4096"),
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || "0.7"),
  };

  const provider = new OpenRouterProvider(config);

  try {
    console.log("Sending test message...");
    console.log("Model:", config.model);

    const result = await provider.complete(
      [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello in exactly 3 words." },
      ],
      {
        model: config.model,
        maxTokens: 50,
        temperature: 0.7,
        tools: [],
      },
    );

    console.log("✅ API Response:", result.message.content);
    console.log("Usage:", result.usage);
  } catch (error) {
    console.error("❌ API Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
