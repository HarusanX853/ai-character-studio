import { prisma } from "@/lib/db/prisma";

export async function retrieveCharacterMemories(characterId: string, episodeId?: string, limit = 10) {
  return prisma.memory.findMany({
    where: {
      characterId,
      visibility: "private",
      OR: [{ episodeId: episodeId ?? undefined }, { episodeId: null }]
    },
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: limit
  });
}
