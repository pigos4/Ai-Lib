import type {
  AIMessageResponse,
  ProviderAdapter,
  ProviderConfig,
  ProviderId,
} from "../types.js";

import { AIError } from "../errors.js";
import { postJson } from "../http.js";

export class OllamaAdapter implements ProviderAdapter {
  readonly id: ProviderId;

  constructor(
    id: "ollamaCloud" | "ollamaLocal",
    private readonly config: ProviderConfig,
  ) {
    this.id = id;
  }

  isConfigured(): boolean {
    return this.config.enabled && Boolean(this.config.baseUrl);
  }

  models(): string[] {
    return this.config.models;
  }

  async sendMessage(input: {
    message: string;
    model: string;
    timeoutMs: number;
  }): Promise<AIMessageResponse> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const data = (await postJson({
      provider: this.id,
      model: input.model,
      timeoutMs: input.timeoutMs,
      url: buildOllamaChatUrl(this.config.baseUrl),
      headers,
      body: {
        model: input.model,
        messages: [{ role: "user", content: input.message }],
        stream: false,
      },
    })) as {
      message?: { content?: string };
    };

    const content = data.message?.content;
    if (!content) {
      throw new AIError({
        message: "Ollama response does not include message content",
        code: "provider_unavailable",
        provider: this.id,
        model: input.model,
        retryable: true,
      });
    }

    return {
      provider: this.id,
      model: input.model,
      content,
    };
  }
}

function buildOllamaChatUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  if (normalizedBaseUrl.endsWith("/api")) {
    return `${normalizedBaseUrl}/chat`;
  }

  return `${normalizedBaseUrl}/api/chat`;
}
