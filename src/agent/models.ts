export interface ModelOption {
  provider: "groq" | "openrouter" | "mistral";
  id: string;
  label: string;
  toolCalling: boolean;
}

export const GROQ_MODELS: ModelOption[] = [
  {
    provider: "groq",
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "qwen/qwen3.6-27b",
    label: "Qwen 3.6 27B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "qwen/qwen3.8-27b",
    label: "Qwen 3.8 27B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    toolCalling: true,
  },
  {
    provider: "groq",
    id: "groq/compound",
    label: "Compound (chat only)",
    toolCalling: false,
  },
  {
    provider: "groq",
    id: "groq/compound-mini",
    label: "Compound Mini (chat only)",
    toolCalling: false,
  },
];

export const OPENROUTER_FREE_MODELS: ModelOption[] = [
  {
    provider: "openrouter",
    id: "nex-agi/nex-n2.5-mini:free",
    label: "Nex AGI: Nex-N2.5-Mini",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "inclusionai/ling-3.0-flash-fin:free",
    label: "inclusionAI: Ling 3.0 Flash",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "liquid/lfm-2.5-embedding-350m:free",
    label: "LiquidAI: LFM2.5 (embedding)",
    toolCalling: false,
  },
  {
    provider: "openrouter",
    id: "dots-studio/dots-3-note-preview:free",
    label: "Dots Studio: Dots3-Note",
    toolCalling: false,
  },
  {
    provider: "openrouter",
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "NVIDIA: Nemotron 3.5 Lightning",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "poolside/laguna-s-2.1:free",
    label: "Poolside: Laguna S 2.1",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "thinkingmachines/inkling:free",
    label: "Thinking Machines: Inkling",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "nvidia/nemotron-3-embed-1b:free",
    label: "NVIDIA: Nemotron 3 Embed 1B",
    toolCalling: false,
  },
  {
    provider: "openrouter",
    id: "cohere/north-mini-code:free",
    label: "Cohere: North Mini Code",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "NVIDIA: Nemotron 3 Ultra",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "google/gemma-4-31b-it:free",
    label: "Google: Gemma 4 31B",
    toolCalling: true,
  },
  {
    provider: "openrouter",
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "NVIDIA: Nemotron 3 Super",
    toolCalling: true,
  },
];

export const MISTRAL_MODELS: ModelOption[] = [
  {
    provider: "mistral",
    id: "codestral-2508",
    label: "Codestral (code)",
    toolCalling: true,
  },
  {
    provider: "mistral",
    id: "ministral-3b-2512",
    label: "Ministral 3B (12.5 RPS)",
    toolCalling: true,
  },
  {
    provider: "mistral",
    id: "ministral-8b-2512",
    label: "Ministral 8B (3.13 RPS)",
    toolCalling: true,
  },
  {
    provider: "mistral",
    id: "ministral-14b-2512",
    label: "Ministral 14B (0.5 RPS)",
    toolCalling: true,
  },
  {
    provider: "mistral",
    id: "labs-leanstral-1-5-1",
    label: "Leanstral 1.5 (5M TPM)",
    toolCalling: true,
  },
  { provider: "mistral", id: "glm-5-2", label: "GLM 5.2", toolCalling: true },
  {
    provider: "mistral",
    id: "zai-glm-5-3",
    label: "Z.ai GLM 5.3",
    toolCalling: true,
  },
];

export const ALL_MODELS: ModelOption[] = [
  ...GROQ_MODELS,
  ...MISTRAL_MODELS,
  ...OPENROUTER_FREE_MODELS,
];
