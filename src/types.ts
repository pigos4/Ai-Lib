export type ProviderId =
  | "openai"
  | "gemini"
  | "claude"
  | "ollamaCloud"
  | "ollamaLocal";

export type RoutingMode = "auto" | "manual";

export interface AIMessageRequest {
  message: string;
  mode?: RoutingMode;
  provider?: ProviderId;
  model?: string;
  timeoutMs?: number;
}

export interface AIMessageResponse {
  provider: ProviderId;
  model: string;
  content: string;
}

export interface AttemptRecord {
  provider: ProviderId;
  model?: string;
  code: string;
  message: string;
}

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  models: string[];
}

export interface LibraryConfig {
  providerOrder: ProviderId[];
  timeoutMs: number;
  providers: Record<ProviderId, ProviderConfig>;
}

export interface ProviderAdapter {
  id: ProviderId;
  isConfigured(): boolean;
  models(): string[];
  sendMessage(input: {
    message: string;
    model: string;
    timeoutMs: number;
  }): Promise<AIMessageResponse>;
}
