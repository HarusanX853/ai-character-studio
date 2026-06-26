import { anthropicProvider } from "./providers/anthropic";
import { deepseekProvider } from "./providers/deepseek";
import { doubaoProvider } from "./providers/doubao";
import { geminiProvider } from "./providers/gemini";
import { mockProvider } from "./providers/mock";
import { openaiProvider } from "./providers/openai";
import { openrouterProvider } from "./providers/openrouter";
import { xaiProvider } from "./providers/xai";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "./types";

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
  const adapter = adapters[input.provider] ?? mockProvider;

  try {
    return await adapter.generateCharacterTurn(input);
  } catch (error) {
    const fallback = await mockProvider.generateCharacterTurn({
      ...input,
      provider: "mock-local",
      model: "mock-roleplay"
    });
    return {
      ...fallback,
      error: error instanceof Error ? error.message : "Provider request failed",
      providerResponse: {
        fallbackFrom: input.provider,
        originalModel: input.model,
        fallbackProviderResponse: fallback.providerResponse
      }
    };
  }
}
