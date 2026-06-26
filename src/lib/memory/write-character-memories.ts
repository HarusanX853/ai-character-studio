import { prisma } from "@/lib/db/prisma";
import type { CharacterTurnOutput } from "@/lib/schemas/character-output";

export async function writeCharacterMemories(params: {
  characterId: string;
  episodeId?: string;
  output: CharacterTurnOutput;
}) {
  const writes = params.output.memory_writes ?? [];

  if (!writes.length) {
    return [];
  }

  return Promise.all(
    writes.map((memory) =>
      prisma.memory.create({
        data: {
          characterId: params.characterId,
          episodeId: params.episodeId,
          type: memory.type,
          content: memory.content,
          visibility: memory.visibility ?? "private",
          importance: memory.importance ?? 0.5
        }
      })
    )
  );
}
