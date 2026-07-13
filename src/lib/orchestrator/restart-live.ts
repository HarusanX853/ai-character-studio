import { prisma } from "@/lib/db/prisma";
import { normalizeTrialRules } from "@/lib/jury/trial-state";
import { asRecord, toInputJson } from "@/lib/utils/json";

export class RestartLiveError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

function resetRulesForLive(rulesJson: unknown) {
  const base = asRecord(rulesJson);
  const rules = normalizeTrialRules(rulesJson);
  const firstStageId = rules.stages[0]?.id ?? null;
  const evidence = rules.evidence.filter((item) => !/^VOTE-\d+$/i.test(item.id));

  return {
    ...base,
    evidence,
    currentStageId: firstStageId,
    current_stage_id: firstStageId,
    caseFactsReleased: false,
    case_facts_released: false,
    allEvidenceVisible: false,
    all_evidence_visible: false,
    releasedEvidenceIds: [],
    released_evidence_ids: [],
    voteOpen: false,
    vote_open: false,
    activeVoteStageId: null,
    active_vote_stage_id: null,
    currentVoteRound: 0,
    current_vote_round: 0,
    voteStartedTurnCount: null,
    vote_started_turn_count: null,
    voteRounds: [],
    vote_rounds: []
  };
}

export async function restartLive(episodeId: string) {
  return prisma.$transaction(async (tx) => {
    const episode = await tx.episode.findUnique({
      where: { id: episodeId },
      select: {
        id: true,
        rulesJson: true
      }
    });

    if (!episode) {
      throw new RestartLiveError("Episode not found.", "episode_not_found");
    }

    const checkpoints = await tx.episodeCheckpoint.deleteMany({ where: { episodeId } });
    const llmCalls = await tx.llmCall.deleteMany({ where: { episodeId } });
    const independentOpinions = await tx.independentOpinion.deleteMany({ where: { episodeId } });
    const hostMessages = await tx.hostMessage.deleteMany({ where: { episodeId } });
    const runtimeBoardItems = await tx.sharedBoardItem.deleteMany({
      where: { episodeId }
    });
    const runtimeMemories = await tx.memory.deleteMany({
      where: {
        episodeId,
        NOT: { type: "persona" }
      }
    });
    const turns = await tx.turn.deleteMany({ where: { episodeId } });

    await tx.episode.update({
      where: { id: episodeId },
      data: {
        status: "active",
        rulesJson: toInputJson(resetRulesForLive(episode.rulesJson))
      }
    });

    return {
      checkpoints: checkpoints.count,
      llmCalls: llmCalls.count,
      sharedBoardItems: runtimeBoardItems.count,
      memories: runtimeMemories.count,
      turns: turns.count,
      hostMessages: hostMessages.count,
      independentOpinions: independentOpinions.count
    };
  });
}
