export type ReasoningEffort = "minimal" | "low" | "medium";

export type GenerationBudget = {
  totalOutputTokens: number;
  reasoningTokens: number;
  answerReserveTokens: number;
  safetyBufferTokens: number;
  reasoningEffort: ReasoningEffort;
  retryReasoningTokens: number;
};

export type GenerateCharacterTurnInput = {
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  responseSchema?: unknown;
  temperature?: number;
  generationBudget?: GenerationBudget;
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
