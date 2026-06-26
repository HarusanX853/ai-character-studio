import { updateSharedBoardFromOutput } from "@/lib/shared-board/update-shared-board";
import type { EpisodeGraphState } from "../state";

export async function updateSharedBoard(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (
    state.shouldEnd ||
    !state.episode ||
    !state.currentSpeakerId ||
    !state.characterOutputParsed ||
    !state.lastTurnId
  ) {
    return {};
  }

  await updateSharedBoardFromOutput({
    episodeId: state.episode.id,
    characterId: state.currentSpeakerId,
    turnId: state.lastTurnId,
    output: state.characterOutputParsed
  });

  return {};
}
