import { writeCharacterMemories } from "@/lib/memory/write-character-memories";
import type { EpisodeGraphState } from "../state";

export async function updatePrivateMemory(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd || !state.episode || !state.currentSpeakerId || !state.characterOutputParsed) {
    return {};
  }

  await writeCharacterMemories({
    characterId: state.currentSpeakerId,
    episodeId: state.episode.id,
    output: state.characterOutputParsed
  });

  return {};
}
