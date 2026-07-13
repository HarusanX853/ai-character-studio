import { anthropicProvider } from "./providers/anthropic";
import { deepseekProvider } from "./providers/deepseek";
import { doubaoProvider } from "./providers/doubao";
import { geminiProvider } from "./providers/gemini";
import { mockProvider } from "./providers/mock";
import { openaiProvider } from "./providers/openai";
import { openrouterProvider } from "./providers/openrouter";
import { xaiProvider } from "./providers/xai";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "./types";
import { LlmProviderError } from "./errors";

const adapters: Record<string, LLMProviderAdapter> = {
  mock: mockProvider,
  "mock-local": mockProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  doubao: doubaoProvider,
  xai: xaiProvider
};

export async function generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
  const adapter = adapters[input.provider];
  if (!adapter) {
    throw new LlmProviderError(
      `不支持的模型提供方：${input.provider}。`,
      "unsupported_provider",
      input.provider,
      input.model
    );
  }

  return adapter.generateCharacterTurn(input);
}
