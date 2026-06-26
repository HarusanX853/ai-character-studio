import { prisma } from "@/lib/db/prisma";
import { toInputJson } from "@/lib/utils/json";
import type { EpisodeGraphState, TurnSnapshot } from "../state";

export async function persistTurn(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (
    state.shouldEnd ||
    !state.episode ||
    !state.currentSpeakerId ||
    !state.characterOutputParsed ||
    !state.builtContext ||
    !state.llmResult
  ) {
    return {};
  }

  const turn = await prisma.turn.create({
    data: {
      episodeId: state.episode.id,
      roundIndex: state.roundIndex,
      speakerCharacterId: state.currentSpeakerId,
      inputContextJson: toInputJson(state.builtContext),
      outputJson: toInputJson(state.characterOutputParsed),
      speech: state.characterOutputParsed.speech,
      action: state.characterOutputParsed.action,
      innerThought: state.characterOutputParsed.inner_thought,
      emotion: state.characterOutputParsed.emotion,
      intent: state.characterOutputParsed.intent,
      tokensInput: state.llmResult.tokensInput,
      tokensOutput: state.llmResult.tokensOutput,
      estimatedCost: state.llmResult.estimatedCost,
      latencyMs: state.llmResult.latencyMs
    },
    include: { speaker: true }
  });

  await prisma.llmCall.create({
    data: {
      provider: state.llmResult.provider,
      model: state.llmResult.model,
      characterId: state.currentSpeakerId,
      episodeId: state.episode.id,
      requestJson: toInputJson(state.builtContext),
      responseJson: toInputJson({
        rawText: state.llmResult.rawText,
        parsed: state.characterOutputParsed,
        providerResponse: state.llmResult.providerResponse
      }),
      tokensInput: state.llmResult.tokensInput,
      tokensOutput: state.llmResult.tokensOutput,
      estimatedCost: state.llmResult.estimatedCost,
      latencyMs: state.llmResult.latencyMs,
      error: state.llmResult.error
    }
  });

  const snapshot: TurnSnapshot = {
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
  };

  return {
    lastTurnId: turn.id,
    recentTurns: [...state.recentTurns, snapshot].slice(-12),
    turnCount: state.turnCount + 1
  };
}
