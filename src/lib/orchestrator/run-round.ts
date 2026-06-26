import { prisma } from "@/lib/db/prisma";
import { EpisodeRunError, runNextTurn } from "./run-next-turn";

export async function runRound(episodeId: string) {
  const count = await prisma.episodeCharacter.count({ where: { episodeId } });
  if (count < 1) {
    throw new EpisodeRunError("Add at least one character before running a round.", "no_characters");
  }

  const turns = [];
  for (let index = 0; index < count; index += 1) {
    try {
      const result = await runNextTurn(episodeId);
      turns.push(result.turn);

      if (result.state.shouldEnd) {
        break;
      }
    } catch (error) {
      if (error instanceof EpisodeRunError && ["budget_exceeded", "max_rounds_reached"].includes(error.code)) {
        break;
      }
      throw error;
    }
  }

  return turns;
}
