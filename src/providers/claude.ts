import type {
  AIMessageResponse,
  ProviderAdapter,
  ProviderConfig,
} from "../types.js";

import { AIError } from "../errors.js";
import { postJson } from "../http.js";

export class ClaudeAdapter implements ProviderAdapter {
  readonly id = "claude" as const;

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
        message: "Missing ANTHROPIC_API_KEY",
        code: "configuration",
        provider: this.id,
      });
    }

    const data = (await postJson({
      provider: this.id,
      model: input.model,
      timeoutMs: input.timeoutMs,
      url: `${this.config.baseUrl}/v1/messages`,
      headers: {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: input.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: input.message }],
      },
    })) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const content = data.content?.find((entry) => entry.type === "text")?.text;
    if (!content) {
      throw new AIError({
        message: "Claude response does not include text content",
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
