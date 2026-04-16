import { AIError, toAIError } from "./errors.js";

import type { ProviderId } from "./types.js";

export async function postJson(params: {
  provider: ProviderId;
  model?: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  timeoutMs: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...params.headers,
      },
      body: JSON.stringify(params.body),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = safeJsonParse(text);

    if (!response.ok) {
      const message = extractErrorMessage(parsed) ?? response.statusText;
      throw toAIError({
        provider: params.provider,
        model: params.model,
        status: response.status,
        message,
      });
    }

    return parsed;
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AIError({
        message: "Request timeout",
        code: "timeout",
        provider: params.provider,
        model: params.model,
        retryable: true,
        cause: error,
      });
    }

    const networkMessage =
      error instanceof Error && error.message
        ? `Network or unexpected error: ${error.message}`
        : "Network or unexpected error";

    throw new AIError({
      message: networkMessage,
      code: "network",
      provider: params.provider,
      model: params.model,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if ("error" in value) {
    const errorField = (value as { error?: unknown }).error;
    if (typeof errorField === "string") {
      return errorField;
    }
    if (
      errorField &&
      typeof errorField === "object" &&
      "message" in errorField
    ) {
      const message = (errorField as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
    }
  }

  if ("message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return undefined;
}
