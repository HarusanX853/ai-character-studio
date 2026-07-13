import type { GenerateCharacterTurnInput, GenerationBudget } from "./types";

export type LlmTask = "character_test" | "episode_turn" | "independent_opinion" | "public_discussion";

function defineBudget(budget: GenerationBudget) {
  const allocated = budget.reasoningTokens + budget.answerReserveTokens + budget.safetyBufferTokens;
  if (allocated !== budget.totalOutputTokens) {
    throw new Error(`Invalid generation budget: ${allocated} allocated from ${budget.totalOutputTokens} tokens.`);
  }

  if (budget.retryReasoningTokens >= budget.reasoningTokens) {
    throw new Error("Retry reasoning budget must be lower than the initial reasoning budget.");
  }

  return budget;
}

const taskBudgets: Record<LlmTask, GenerationBudget> = {
  character_test: defineBudget({
    totalOutputTokens: 2560,
    reasoningTokens: 1024,
    answerReserveTokens: 1200,
    safetyBufferTokens: 336,
    reasoningEffort: "low",
    retryReasoningTokens: 256
  }),
  episode_turn: defineBudget({
    totalOutputTokens: 6144,
    reasoningTokens: 1600,
    answerReserveTokens: 3000,
    safetyBufferTokens: 1544,
    reasoningEffort: "low",
    retryReasoningTokens: 512
  }),
  independent_opinion: defineBudget({
    totalOutputTokens: 7168,
    reasoningTokens: 2200,
    answerReserveTokens: 3200,
    safetyBufferTokens: 1768,
    reasoningEffort: "medium",
    retryReasoningTokens: 768
  }),
  public_discussion: defineBudget({
    totalOutputTokens: 6144,
    reasoningTokens: 1800,
    answerReserveTokens: 3000,
    safetyBufferTokens: 1344,
    reasoningEffort: "low",
    retryReasoningTokens: 512
  })
};

export function getGenerationBudget(task: LlmTask): GenerationBudget {
  return { ...taskBudgets[task] };
}

export function getTotalOutputTokens(input: Pick<GenerateCharacterTurnInput, "generationBudget" | "maxTokens">) {
  return input.generationBudget?.totalOutputTokens ?? input.maxTokens ?? 800;
}
