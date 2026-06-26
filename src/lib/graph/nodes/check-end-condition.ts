import { prisma } from "@/lib/db/prisma";
import { enforceEpisodeBudget } from "@/lib/cost/enforce-budget";
import type { EpisodeGraphState } from "../state";

export async function checkEndCondition(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (!state.episode) {
    return {};
  }

  if (state.episode.status === "ended") {
    return { shouldEnd: true, endReason: "episode_status_ended" };
  }

  const budget = await enforceEpisodeBudget(state.episode.id, state.episode.budgetUsd, state.budget.override);
  if (budget.exceeded) {
    return {
      budget,
      shouldEnd: true,
      endReason: "budget_exceeded"
    };
  }

  const maxTurns = state.episode.maxRounds * Math.max(1, state.characters.length);
  if (state.turnCount >= maxTurns) {
    await prisma.episode.update({
      where: { id: state.episode.id },
      data: { status: "ended" }
    });
    return {
      budget,
      shouldEnd: true,
      endReason: "max_rounds_reached"
    };
  }

  return { budget };
}
