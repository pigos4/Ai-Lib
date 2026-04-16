import type {
  AIMessageRequest,
  AIMessageResponse,
  LibraryConfig,
  ProviderId,
} from "./types.js";

import { AIRouter } from "./router.js";
import { ClaudeAdapter } from "./providers/claude.js";
import { GeminiAdapter } from "./providers/gemini.js";
import { OllamaAdapter } from "./providers/ollama.js";
import { OpenAIAdapter } from "./providers/openai.js";
import { loadConfig } from "./config.js";

export class AIClient {
  private readonly router: AIRouter;

  constructor(private readonly config: LibraryConfig = loadConfig()) {
    this.router = new AIRouter(this.config, {
      openai: new OpenAIAdapter(this.config.providers.openai),
      gemini: new GeminiAdapter(this.config.providers.gemini),
      claude: new ClaudeAdapter(this.config.providers.claude),
      ollamaCloud: new OllamaAdapter(
        "ollamaCloud",
        this.config.providers.ollamaCloud,
      ),
      ollamaLocal: new OllamaAdapter(
        "ollamaLocal",
        this.config.providers.ollamaLocal,
      ),
    });
  }

  async sendMessage(request: AIMessageRequest): Promise<AIMessageResponse> {
    return this.router.sendMessage(request);
  }

  providers(): ProviderId[] {
    return this.config.providerOrder;
  }
}

export function createAIClient(config?: LibraryConfig): AIClient {
  return new AIClient(config);
}
