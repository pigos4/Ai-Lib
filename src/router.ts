import {
  AIError,
  AllModelsExhaustedError,
  AllProvidersExhaustedError,
} from "./errors.js";
import type {
  AIMessageRequest,
  AIMessageResponse,
  AttemptRecord,
  LibraryConfig,
  ProviderAdapter,
  ProviderId,
} from "./types.js";

export class AIRouter {
  constructor(
    private readonly config: LibraryConfig,
    private readonly adapters: Record<ProviderId, ProviderAdapter>,
  ) {}

  async sendMessage(request: AIMessageRequest): Promise<AIMessageResponse> {
    const mode = request.mode ?? "auto";

    if (!request.message?.trim()) {
      throw new AIError({
        message: "message is required",
        code: "invalid_request",
      });
    }

    if (mode === "manual") {
      console.info("[aiLib] mode=manual");
      return this.sendManual(request);
    }

    console.info("[aiLib] mode=auto");
    return this.sendAuto(request);
  }

  private async sendManual(
    request: AIMessageRequest,
  ): Promise<AIMessageResponse> {
    if (!request.provider) {
      throw new AIError({
        message: "provider is required in manual mode",
        code: "invalid_request",
      });
    }

    const providerId = request.provider;
    const adapter = this.adapters[providerId];
    const attempts: AttemptRecord[] = [];

    if (!adapter || !adapter.isConfigured()) {
      throw new AIError({
        message: `Provider ${providerId} is not configured`,
        code: "configuration",
        provider: providerId,
      });
    }

    const candidateModels = this.getModelOrder(adapter.models(), request.model);

    for (const model of candidateModels) {
      try {
        console.info(
          `[aiLib] trying provider=${providerId} model=${model} (manual)`,
        );
        const response = await adapter.sendMessage({
          message: request.message,
          model,
          timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
        });
        console.info(
          `[aiLib] using provider=${response.provider} model=${response.model}`,
        );
        return response;
      } catch (error) {
        const aiError = normalizeError(error, providerId, model);
        attempts.push({
          provider: providerId,
          model,
          code: aiError.code,
          message: aiError.message,
        });

        if (aiError.code === "rate_limit") {
          console.warn(
            `[aiLib] rate limit on provider=${providerId} model=${model}, trying next model: ${aiError.message}`,
          );
          continue;
        }

        console.warn(
          `[aiLib] provider=${providerId} model=${model} failed with code=${aiError.code}: ${aiError.message}`,
        );

        throw aiError;
      }
    }

    throw new AllModelsExhaustedError(providerId, attempts);
  }

  private async sendAuto(
    request: AIMessageRequest,
  ): Promise<AIMessageResponse> {
    const attempts: AttemptRecord[] = [];

    for (const providerId of this.config.providerOrder) {
      const adapter = this.adapters[providerId];
      if (!adapter || !adapter.isConfigured()) {
        console.info(
          `[aiLib] skipping provider=${providerId} (not configured)`,
        );
        continue;
      }

      for (const model of adapter.models()) {
        try {
          console.info(
            `[aiLib] trying provider=${providerId} model=${model} (auto)`,
          );
          const response = await adapter.sendMessage({
            message: request.message,
            model,
            timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
          });
          console.info(
            `[aiLib] using provider=${response.provider} model=${response.model}`,
          );
          return response;
        } catch (error) {
          const aiError = normalizeError(error, providerId, model);
          attempts.push({
            provider: providerId,
            model,
            code: aiError.code,
            message: aiError.message,
          });

          if (aiError.code === "rate_limit" || aiError.retryable) {
            console.warn(
              `[aiLib] fallback from provider=${providerId} model=${model} due to code=${aiError.code}: ${aiError.message}`,
            );
            continue;
          }

          console.warn(
            `[aiLib] stopping provider=${providerId} due to non-retryable code=${aiError.code}: ${aiError.message}`,
          );

          break;
        }
      }
    }

    if (attempts.length > 0) {
      const attemptSummary = attempts
        .map(
          (attempt) =>
            `${attempt.provider}/${attempt.model ?? "n/a"}:${attempt.code}:${attempt.message}`,
        )
        .join(" | ");
      console.error(
        `[aiLib] all providers exhausted. attempts=${attemptSummary}`,
      );
    }

    throw new AllProvidersExhaustedError(attempts);
  }

  private getModelOrder(models: string[], selected?: string): string[] {
    if (!selected) {
      return models;
    }

    const unique = [selected, ...models.filter((model) => model !== selected)];
    return unique;
  }
}

function normalizeError(
  error: unknown,
  provider: ProviderId,
  model?: string,
): AIError {
  if (error instanceof AIError) {
    return error;
  }

  if (error instanceof Error) {
    return new AIError({
      message: error.message,
      code: "unknown",
      provider,
      model,
      retryable: false,
      cause: error,
    });
  }

  return new AIError({
    message: "Unknown error",
    code: "unknown",
    provider,
    model,
    retryable: false,
    cause: error,
  });
}
