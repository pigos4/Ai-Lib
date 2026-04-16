import type { LibraryConfig, ProviderConfig, ProviderId } from "./types.js";

import { AIError } from "./errors.js";

const DEFAULT_PROVIDER_ORDER: ProviderId[] = [
  "gemini",
  "openai",
  "claude",
  "ollamaCloud",
  "ollamaLocal",
];

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): LibraryConfig {
  const timeoutMs = Number(env.AI_REQUEST_TIMEOUT_MS ?? "30000");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new AIError({
      message: "AI_REQUEST_TIMEOUT_MS must be a positive number",
      code: "configuration",
    });
  }

  const providerOrder = parseProviderOrder(env.AI_PROVIDER_ORDER);

  const providers: Record<ProviderId, ProviderConfig> = {
    openai: {
      enabled: Boolean(env.OPENAI_API_KEY),
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com",
      models: parseList(env.OPENAI_MODELS, ["gpt-4.1-mini", "gpt-4o-mini"]),
    },
    gemini: {
      enabled: Boolean(env.GEMINI_API_KEY),
      apiKey: env.GEMINI_API_KEY,
      baseUrl:
        env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
      models: parseList(env.GEMINI_MODELS, [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
      ]),
    },
    claude: {
      enabled: Boolean(env.ANTHROPIC_API_KEY),
      apiKey: env.ANTHROPIC_API_KEY,
      baseUrl: env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
      models: parseList(env.ANTHROPIC_MODELS, [
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
      ]),
    },
    ollamaCloud: {
      enabled: Boolean(env.OLLAMA_CLOUD_BASE_URL),
      apiKey: env.OLLAMA_CLOUD_API_KEY,
      baseUrl: env.OLLAMA_CLOUD_BASE_URL ?? "",
      models: parseList(env.OLLAMA_CLOUD_MODELS, []),
    },
    ollamaLocal: {
      enabled: Boolean(env.OLLAMA_LOCAL_BASE_URL),
      baseUrl: env.OLLAMA_LOCAL_BASE_URL ?? "http://localhost:11434",
      models: parseList(env.OLLAMA_LOCAL_MODELS, ["llama3.2"]),
    },
  };

  return {
    timeoutMs,
    providerOrder,
    providers,
  };
}

function parseProviderOrder(raw: string | undefined): ProviderId[] {
  if (!raw) {
    return DEFAULT_PROVIDER_ORDER;
  }

  const mapped = parseList(raw, []).map((value) => value as ProviderId);

  for (const provider of mapped) {
    if (!DEFAULT_PROVIDER_ORDER.includes(provider)) {
      throw new AIError({
        message: `Unknown provider in AI_PROVIDER_ORDER: ${provider}`,
        code: "configuration",
      });
    }
  }

  return mapped;
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) {
    return fallback;
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}
