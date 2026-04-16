import type { AttemptRecord, ProviderId } from "./types.js";

export type AIErrorCode =
  | "rate_limit"
  | "auth"
  | "timeout"
  | "invalid_request"
  | "provider_unavailable"
  | "network"
  | "configuration"
  | "all_models_exhausted"
  | "all_providers_exhausted"
  | "unknown";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(params: {
    message: string;
    code: AIErrorCode;
    provider?: ProviderId;
    model?: string;
    status?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "AIError";
    this.code = params.code;
    this.provider = params.provider;
    this.model = params.model;
    this.status = params.status;
    this.retryable = params.retryable ?? false;
    if (params.cause !== undefined) {
      (this as { cause?: unknown }).cause = params.cause;
    }
  }
}

export class AllModelsExhaustedError extends AIError {
  readonly attempts: AttemptRecord[];

  constructor(provider: ProviderId, attempts: AttemptRecord[]) {
    const details = formatAttempts(attempts);
    super({
      message: details
        ? `All models are exhausted for provider ${provider}. Attempts: ${details}`
        : `All models are exhausted for provider ${provider}`,
      code: "all_models_exhausted",
      provider,
      retryable: false,
    });
    this.name = "AllModelsExhaustedError";
    this.attempts = attempts;
  }
}

export class AllProvidersExhaustedError extends AIError {
  readonly attempts: AttemptRecord[];

  constructor(attempts: AttemptRecord[]) {
    const details = formatAttempts(attempts);
    super({
      message: details
        ? `All providers are exhausted or unavailable. Attempts: ${details}`
        : "All providers are exhausted or unavailable",
      code: "all_providers_exhausted",
      retryable: false,
    });
    this.name = "AllProvidersExhaustedError";
    this.attempts = attempts;
  }
}

function formatAttempts(attempts: AttemptRecord[]): string {
  return attempts
    .map(
      (attempt) =>
        `${attempt.provider}/${attempt.model ?? "n/a"}:${attempt.code}:${attempt.message}`,
    )
    .join(" | ");
}

export function toAIError(input: {
  provider: ProviderId;
  model?: string;
  status?: number;
  message: string;
  cause?: unknown;
}): AIError {
  const { provider, model, status, message, cause } = input;

  if (status === 401 || status === 403) {
    return new AIError({
      message,
      code: "auth",
      provider,
      model,
      status,
      retryable: false,
      cause,
    });
  }

  if (status === 429) {
    return new AIError({
      message,
      code: "rate_limit",
      provider,
      model,
      status,
      retryable: true,
      cause,
    });
  }

  if (status === 400 || status === 404 || status === 422) {
    return new AIError({
      message,
      code: "invalid_request",
      provider,
      model,
      status,
      retryable: false,
      cause,
    });
  }

  if (status !== undefined && status >= 500) {
    return new AIError({
      message,
      code: "provider_unavailable",
      provider,
      model,
      status,
      retryable: true,
      cause,
    });
  }

  return new AIError({
    message,
    code: "unknown",
    provider,
    model,
    status,
    retryable: false,
    cause,
  });
}
