type Pricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const pricingByProviderModel: Record<string, Pricing> = {
  "mock-local:mock-roleplay": { inputPerMillion: 0, outputPerMillion: 0 },
  "mock:mock-roleplay": { inputPerMillion: 0, outputPerMillion: 0 },
  "openai:gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "openrouter:anthropic/claude-sonnet-4.6": { inputPerMillion: 3, outputPerMillion: 15 },
  "anthropic:claude-sonnet": { inputPerMillion: 3, outputPerMillion: 15 },
  "gemini:gemini-pro": { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  "deepseek:deepseek-chat": { inputPerMillion: 0.14, outputPerMillion: 0.28 },
  "doubao:doubao-seed-evolving": { inputPerMillion: 1, outputPerMillion: 3 },
  "xai:grok": { inputPerMillion: 3, outputPerMillion: 15 }
};

const fallbackPricing: Pricing = {
  inputPerMillion: 1,
  outputPerMillion: 3
};

export function estimateCost(provider: string, model: string, tokensInput: number, tokensOutput: number) {
  const pricing = pricingByProviderModel[`${provider}:${model}`] ?? fallbackPricing;
  return (tokensInput / 1_000_000) * pricing.inputPerMillion + (tokensOutput / 1_000_000) * pricing.outputPerMillion;
}

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}
