import type {
  AIMessageResponse,
  ProviderAdapter,
  ProviderConfig,
} from "../types.js";

import { AIError } from "../errors.js";
import { postJson } from "../http.js";

export class OpenAIAdapter implements ProviderAdapter {
  readonly id = "openai" as const;

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
        message: "Missing OPENAI_API_KEY",
        code: "configuration",
        provider: this.id,
      });
    }

    const data = (await postJson({
      provider: this.id,
      model: input.model,
      timeoutMs: input.timeoutMs,
      url: `${this.config.baseUrl}/v1/chat/completions`,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: {
        model: input.model,
        messages: [{ role: "user", content: input.message }],
      },
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new AIError({
        message: "OpenAI response does not include message content",
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
