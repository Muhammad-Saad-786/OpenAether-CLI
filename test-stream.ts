import "dotenv/config";
import { OpenRouterProvider } from "./src/provider/openrouter";
import type { Config } from "./src/config";

async function main() {
  console.log("Testing OpenRouter Streaming...");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY not set");
    process.exit(1);
  }

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
    console.log("Streaming response...\n");

    const stream = provider.stream(
      [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Count from 1 to 5 slowly." },
      ],
      {
        model: config.model,
        maxTokens: 100,
        temperature: 0.7,
        tools: [],
      },
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }

    console.log("\n\n✅ Streaming complete!");
  } catch (error) {
    console.error("❌ API Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
