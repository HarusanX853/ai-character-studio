import { prisma } from "@/lib/db/prisma";
import type { CharacterTurnOutput } from "@/lib/schemas/character-output";
import { toInputJson } from "@/lib/utils/json";

export async function updateSharedBoardFromOutput(params: {
  episodeId: string;
  characterId: string;
  turnId: string;
  output: CharacterTurnOutput;
}) {
  const publishableClaims = (params.output.claims ?? []).filter(
    (claim) => claim.should_publish_to_shared_board === true
  );

  if (!publishableClaims.length) {
    return [];
  }

  return Promise.all(
    publishableClaims.map((claim) =>
      prisma.sharedBoardItem.create({
        data: {
          episodeId: params.episodeId,
          type: claim.type,
          content: claim.content,
          confidence: claim.confidence ?? 0.5,
          introducedByCharacterId: params.characterId,
          source: `turn:${params.turnId}`,
          tagsJson: toInputJson([])
        }
      })
    )
  );
}
