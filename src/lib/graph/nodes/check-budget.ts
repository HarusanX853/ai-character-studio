import { enforceEpisodeBudget, readBudgetOverride } from "@/lib/cost/enforce-budget";
import type { EpisodeGraphState } from "../state";

export async function checkBudget(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (!state.episode) {
    return {};
  }

  const override = state.budget.override || readBudgetOverride(state.episode.rulesJson);
  const budget = await enforceEpisodeBudget(state.episodeId, state.episode.budgetUsd, override);

  if (budget.exceeded) {
    return {
      budget,
      shouldEnd: true,
      endReason: "budget_exceeded",
      error: "Episode budget has been exhausted."
    };
  }

  return { budget };
}
