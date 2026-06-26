import { generateCharacterTurn } from "@/lib/llm/router";
import { characterTurnOutputSchema } from "@/lib/schemas/character-output";
import type { EpisodeGraphState } from "../state";

export async function callCharacterModel(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd || !state.builtContext || !state.currentSpeakerId || !state.episode) {
    return {};
  }

  const character = state.characters.find((item) => item.id === state.currentSpeakerId);
  if (!character) {
    return { shouldEnd: true, endReason: "speaker_not_found", error: "Selected speaker was not found." };
  }

  const result = await generateCharacterTurn({
    provider: character.provider,
    model: character.model,
    systemPrompt: state.builtContext.systemPrompt,
    userPrompt: state.builtContext.userPrompt,
    responseSchema: characterTurnOutputSchema,
    temperature: 0.7,
    maxTokens: 800,
    metadata: {
      episodeId: state.episode.id,
      characterId: character.id,
      characterName: character.name,
      episodeTitle: state.episode.title,
      episodeSetting: state.episode.setting
    }
  });

  return {
    characterOutputRaw: result.rawText,
    llmResult: result
  };
}
