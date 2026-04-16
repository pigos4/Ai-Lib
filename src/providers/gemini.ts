import type {
  AIMessageResponse,
  ProviderAdapter,
  ProviderConfig,
} from "../types.js";

import { AIError } from "../errors.js";
import { postJson } from "../http.js";

export class GeminiAdapter implements ProviderAdapter {
  readonly id = "gemini" as const;

  constructor(private readonly config: ProviderConfig) {}

  isConfigured(): boolean {
    return (
      this.config.enabled &&
      Boolean(this.config.apiKey) &&
      Boolean(this.config.baseUrl)
    );
  }

  models(): string[] {
    return this.config.models;
  }

  async sendMessage(input: {
    message: string;
    model: string;
    timeoutMs: number;
  }): Promise<AIMessageResponse> {
    if (!this.config.apiKey) {
      throw new AIError({
        message: "Missing GEMINI_API_KEY",
        code: "configuration",
        provider: this.id,
      });
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const data = (await postJson({
      provider: this.id,
      model: input.model,
      timeoutMs: input.timeoutMs,
      url: `${baseUrl}/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${this.config.apiKey}`,
      headers: {},
      body: {
        contents: [{ role: "user", parts: [{ text: input.message }] }],
      },
    })) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new AIError({
        message: "Gemini response does not include message content",
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
