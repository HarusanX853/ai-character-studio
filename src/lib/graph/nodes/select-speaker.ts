import type { EpisodeGraphState } from "../state";

export async function selectSpeaker(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd) {
    return {};
  }

  if (!state.characters.length) {
    return {
      shouldEnd: true,
      endReason: "no_characters",
      error: "Add at least one character before running the episode."
    };
  }

  const speakerIndex = state.turnCount % state.characters.length;
  return {
    currentSpeakerId: state.characters[speakerIndex]?.id ?? null,
    roundIndex: Math.floor(state.turnCount / state.characters.length) + 1
  };
}
