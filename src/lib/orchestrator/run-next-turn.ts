import { prisma } from "@/lib/db/prisma";
import { createEpisodeGraph } from "@/lib/graph/episode-graph";
import { getOrCreateEpisodeThreadId, persistEpisodeCheckpoint } from "@/lib/graph/checkpointer";
import { createInitialEpisodeGraphState } from "@/lib/graph/state";

export class EpisodeRunError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

export async function getNextTurnPreview(episodeId: string) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!episode) {
    throw new EpisodeRunError("Episode not found.", "episode_not_found");
  }

  if (episode.status !== "active") {
    throw new EpisodeRunError("Episode must be active before running turns.", "episode_not_active");
  }

  if (episode.characters.length < 1) {
    throw new EpisodeRunError("Add at least one character before running turns.", "no_characters");
  }

  const turnCount = await prisma.turn.count({ where: { episodeId } });
  const speakerIndex = turnCount % episode.characters.length;
  const speaker = episode.characters[speakerIndex]?.character;

  if (!speaker) {
    throw new EpisodeRunError("Selected speaker was not found.", "speaker_not_found");
  }

  return {
    speakerId: speaker.id,
    speakerName: speaker.displayName ?? speaker.name,
    provider: speaker.provider,
    model: speaker.model,
    roundIndex: Math.floor(turnCount / episode.characters.length) + 1,
    turnCount
  };
}

export async function runNextTurn(episodeId: string) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { characters: true }
  });

  if (!episode) {
    throw new EpisodeRunError("Episode not found.", "episode_not_found");
  }

  if (episode.status !== "active") {
    throw new EpisodeRunError("Episode must be active before running turns.", "episode_not_active");
  }

  if (episode.characters.length < 1) {
    throw new EpisodeRunError("Add at least one character before running turns.", "no_characters");
  }

  const threadId = await getOrCreateEpisodeThreadId(episodeId);
  const graph = createEpisodeGraph();
  const initialState = createInitialEpisodeGraphState(episodeId, threadId);
  const finalState = await graph.invoke(initialState);

  await persistEpisodeCheckpoint(finalState);

  if (finalState.error && !finalState.lastTurnId) {
    throw new EpisodeRunError(finalState.error, finalState.endReason ?? "episode_run_failed");
  }

  if (!finalState.lastTurnId) {
    throw new EpisodeRunError("No turn was generated.", finalState.endReason ?? "no_turn_generated");
  }

  const turn = await prisma.turn.findUnique({
    where: { id: finalState.lastTurnId },
    include: { speaker: true }
  });

  if (!turn) {
    throw new EpisodeRunError("Generated turn could not be loaded.", "turn_not_found");
  }

  return {
    turn,
    state: finalState
  };
}
