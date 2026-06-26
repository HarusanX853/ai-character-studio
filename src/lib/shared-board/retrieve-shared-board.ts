import { prisma } from "@/lib/db/prisma";

export async function retrieveSharedBoard(episodeId: string, limit = 50) {
  return prisma.sharedBoardItem.findMany({
    where: {
      episodeId,
      visibility: "public"
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      introducedByCharacter: {
        select: { id: true, name: true, displayName: true }
      }
    }
  });
}
