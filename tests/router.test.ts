import type {
  AIMessageResponse,
  LibraryConfig,
  ProviderAdapter,
  ProviderId,
} from "../src/types.js";
import { describe, expect, it } from "vitest";

import { AIError } from "../src/errors.js";
import { AIRouter } from "../src/router.js";

class FakeAdapter implements ProviderAdapter {
  constructor(
    readonly id: ProviderId,
    private readonly modelList: string[],
    private readonly responder: (model: string) => Promise<AIMessageResponse>,
  ) {}

  isConfigured(): boolean {
    return true;
  }

  models(): string[] {
    return this.modelList;
  }

  sendMessage(input: {
    message: string;
    model: string;
    timeoutMs: number;
  }): Promise<AIMessageResponse> {
    return this.responder(input.model);
  }
}

function baseConfig(): LibraryConfig {
  return {
    timeoutMs: 1000,
    providerOrder: ["gemini", "openai", "claude", "ollamaCloud", "ollamaLocal"],
    providers: {
      openai: { enabled: true, baseUrl: "", models: [] },
      gemini: { enabled: true, baseUrl: "", models: [] },
      claude: { enabled: true, baseUrl: "", models: [] },
      ollamaCloud: { enabled: true, baseUrl: "", models: [] },
      ollamaLocal: { enabled: true, baseUrl: "", models: [] },
    },
  };
}

describe("AIRouter", () => {
  it("manual mode retries next model when first is rate limited", async () => {
    const router = new AIRouter(baseConfig(), {
      gemini: new FakeAdapter("gemini", ["m1", "m2"], async (model) => {
        if (model === "m1") {
          throw new AIError({
            message: "rate limited",
            code: "rate_limit",
            provider: "gemini",
            model,
            retryable: true,
          });
        }
        return { provider: "gemini", model, content: "ok" };
      }),
      openai: new FakeAdapter("openai", [], async () => {
        throw new Error("unused");
      }),
      claude: new FakeAdapter("claude", [], async () => {
        throw new Error("unused");
      }),
      ollamaCloud: new FakeAdapter("ollamaCloud", [], async () => {
        throw new Error("unused");
      }),
      ollamaLocal: new FakeAdapter("ollamaLocal", [], async () => {
        throw new Error("unused");
      }),
    });

    const result = await router.sendMessage({
      mode: "manual",
      provider: "gemini",
      model: "m1",
      message: "hello",
    });

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("m2");
    expect(result.content).toBe("ok");
  });

  it("auto mode falls back to next provider when current provider rate limited", async () => {
    const router = new AIRouter(baseConfig(), {
      gemini: new FakeAdapter("gemini", ["m1"], async () => {
        throw new AIError({
          message: "rate limited",
          code: "rate_limit",
          provider: "gemini",
          model: "m1",
          retryable: true,
        });
      }),
      openai: new FakeAdapter("openai", ["o1"], async (model) => ({
        provider: "openai",
        model,
        content: "openai ok",
      })),
      claude: new FakeAdapter("claude", [], async () => {
        throw new Error("unused");
      }),
      ollamaCloud: new FakeAdapter("ollamaCloud", [], async () => {
        throw new Error("unused");
      }),
      ollamaLocal: new FakeAdapter("ollamaLocal", [], async () => {
        throw new Error("unused");
      }),
    });

    const result = await router.sendMessage({ message: "hello", mode: "auto" });

    expect(result.provider).toBe("openai");
    expect(result.model).toBe("o1");
    expect(result.content).toBe("openai ok");
  });
});
