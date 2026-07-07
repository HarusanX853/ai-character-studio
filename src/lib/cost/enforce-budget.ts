import { prisma } from "@/lib/db/prisma";
import { asRecord } from "@/lib/utils/json";

export function readBudgetOverride(rulesJson: unknown) {
  return asRecord(rulesJson).budgetOverride === true;
}

export async function getEpisodeSpentUsd(episodeId: string) {
  const aggregate = await prisma.llmCall.aggregate({
    where: { episodeId },
    _sum: { estimatedCost: true }
  });

  return aggregate._sum.estimatedCost ?? 0;
}

export async function enforceEpisodeBudget(episodeId: string, budgetUsd: number, override: boolean) {
  const spentUsd = await getEpisodeSpentUsd(episodeId);
  return {
    budgetUsd,
    spentUsd,
    remainingUsd: Math.max(0, budgetUsd - spentUsd),
    exceeded: !override && spentUsd >= budgetUsd,
    override
  };
}
