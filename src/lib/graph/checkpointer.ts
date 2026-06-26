import { prisma } from "@/lib/db/prisma";
import { toInputJson } from "@/lib/utils/json";
import type { EpisodeGraphState } from "./state";

export async function getOrCreateEpisodeThreadId(episodeId: string) {
  const existing = await prisma.episodeCheckpoint.findFirst({
    where: { episodeId },
    orderBy: { updatedAt: "desc" }
  });

  if (existing) {
    return existing.threadId;
  }

  const created = await prisma.episodeCheckpoint.create({
    data: {
      episodeId,
      threadId: `episode-${episodeId}`,
      graphStateJson: toInputJson({})
    }
  });

  return created.threadId;
}

export async function persistEpisodeCheckpoint(state: EpisodeGraphState) {
  await prisma.episodeCheckpoint.upsert({
    where: {
      episodeId_threadId: {
        episodeId: state.episodeId,
        threadId: state.threadId
      }
    },
    update: {
      graphStateJson: toInputJson(state)
    },
    create: {
      episodeId: state.episodeId,
      threadId: state.threadId,
      graphStateJson: toInputJson(state)
    }
  });
}
