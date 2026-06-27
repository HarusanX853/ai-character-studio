import type { Prisma } from "@prisma/client";
import { formatEvidenceForBoard, normalizeTrialRules } from "@/lib/jury/trial-state";
import { toInputJson } from "@/lib/utils/json";

const managedEvidenceSourcePrefix = "episode_evidence:";

export async function syncEvidenceBoardItems(tx: Prisma.TransactionClient, episodeId: string, rulesJson: unknown) {
  const rules = normalizeTrialRules(rulesJson);

  await tx.sharedBoardItem.deleteMany({
    where: {
      episodeId,
      source: { startsWith: managedEvidenceSourcePrefix }
    }
  });

  if (!rules.evidence.length) {
    return;
  }

  await tx.sharedBoardItem.createMany({
    data: rules.evidence.map((evidence) => ({
      episodeId,
      type: "clue",
      content: formatEvidenceForBoard(evidence),
      source: `${managedEvidenceSourcePrefix}${evidence.id}`,
      confidence: 1,
      tagsJson: toInputJson(["episode_evidence", evidence.id])
    }))
  });
}
