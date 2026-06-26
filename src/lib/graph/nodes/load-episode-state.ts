import { prisma } from "@/lib/db/prisma";
import { retrieveSharedBoard } from "@/lib/shared-board/retrieve-shared-board";
import type { EpisodeGraphState, SharedBoardSnapshot, TurnSnapshot } from "../state";

export async function loadEpisodeState(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  const episode = await prisma.episode.findUnique({
    where: { id: state.episodeId },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!episode) {
    return {
      shouldEnd: true,
      endReason: "episode_not_found",
      error: "Episode not found"
    };
  }

  const [turnsDescending, turnCount, boardItems] = await Promise.all([
    prisma.turn.findMany({
      where: { episodeId: state.episodeId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { speaker: true }
    }),
    prisma.turn.count({ where: { episodeId: state.episodeId } }),
    retrieveSharedBoard(state.episodeId, 50)
  ]);

  const characters = episode.characters.map((entry) => ({
    id: entry.character.id,
    name: entry.character.name,
    displayName: entry.character.displayName,
    provider: entry.character.provider,
    model: entry.character.model,
    roleArchetype: entry.character.roleArchetype,
    personalityJson: entry.character.personalityJson,
    backstory: entry.character.backstory,
    publicGoal: entry.character.publicGoal,
    privateGoal: entry.character.privateGoal,
    secretsJson: entry.character.secretsJson,
    speechStyle: entry.character.speechStyle,
    episodeRole: entry.roleInEpisode,
    episodeHiddenFactsJson: entry.hiddenFactsJson
  }));

  const recentTurns: TurnSnapshot[] = turnsDescending.reverse().map((turn) => ({
    id: turn.id,
    roundIndex: turn.roundIndex,
    speakerCharacterId: turn.speakerCharacterId,
    speakerName: turn.speaker.displayName ?? turn.speaker.name,
    speech: turn.speech,
    action: turn.action,
    emotion: turn.emotion,
    intent: turn.intent,
    estimatedCost: turn.estimatedCost,
    tokensInput: turn.tokensInput,
    tokensOutput: turn.tokensOutput,
    createdAt: turn.createdAt.toISOString()
  }));

  const sharedBoard: SharedBoardSnapshot[] = boardItems.map((item) => ({
    id: item.id,
    type: item.type,
    content: item.content,
    source: item.source,
    introducedByCharacterId: item.introducedByCharacterId,
    confidence: item.confidence,
    visibility: item.visibility,
    createdAt: item.createdAt.toISOString()
  }));

  const roundIndex = characters.length ? Math.floor(turnCount / characters.length) + 1 : 1;

  return {
    episode: {
      id: episode.id,
      title: episode.title,
      format: episode.format,
      setting: episode.setting,
      publicFactsJson: episode.publicFactsJson,
      hiddenFactsJson: episode.hiddenFactsJson,
      rulesJson: episode.rulesJson,
      budgetUsd: episode.budgetUsd,
      maxRounds: episode.maxRounds,
      status: episode.status
    },
    characters,
    recentTurns,
    sharedBoard,
    turnCount,
    roundIndex,
    budget: {
      ...state.budget,
      budgetUsd: episode.budgetUsd
    }
  };
}
