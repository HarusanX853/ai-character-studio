export type GenerateCharacterTurnInput = {
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseSchema?: unknown;
  temperature?: number;
  maxTokens?: number;
  metadata?: {
    episodeId?: string;
    characterId?: string;
    turnId?: string;
    characterName?: string;
    episodeTitle?: string;
    episodeSetting?: string;
  };
};

export type GenerateCharacterTurnResult = {
  rawText: string;
  parsed?: unknown;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  latencyMs: number;
  providerResponse?: unknown;
  provider: string;
  model: string;
  error?: string;
};

export interface LLMProviderAdapter {
  generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult>;
}
