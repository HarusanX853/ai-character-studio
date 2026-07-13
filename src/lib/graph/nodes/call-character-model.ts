import { prisma } from "@/lib/db/prisma";
import { getLlmErrorCode, getLlmFailureDetails } from "@/lib/llm/errors";
import { getGenerationBudget } from "@/lib/llm/output-limits";
import { generateCharacterTurn } from "@/lib/llm/router";
import { characterTurnOutputSchema } from "@/lib/schemas/character-output";
import { toInputJson } from "@/lib/utils/json";
import type { EpisodeGraphState } from "../state";

export async function callCharacterModel(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd || !state.builtContext || !state.currentSpeakerId || !state.episode) {
    return {};
  }

  const character = state.characters.find((item) => item.id === state.currentSpeakerId);
  if (!character) {
    return { shouldEnd: true, endReason: "speaker_not_found", error: "Selected speaker was not found." };
  }

  const input = {
    provider: character.provider,
    model: character.model,
    systemPrompt: state.builtContext.systemPrompt,
    userPrompt: state.builtContext.userPrompt,
    responseSchema: characterTurnOutputSchema,
    temperature: 0.7,
    generationBudget: getGenerationBudget("episode_turn"),
    metadata: {
      episodeId: state.episode.id,
      characterId: character.id,
      characterName: character.name,
      episodeTitle: state.episode.title,
      episodeSetting: state.episode.setting
    }
  };

  const startedAt = Date.now();
  try {
    const result = await generateCharacterTurn(input);

    return {
      characterOutputRaw: result.rawText,
      llmResult: result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败。";
    const failure = getLlmFailureDetails(error);
    await prisma.llmCall
      .create({
        data: {
          provider: character.provider,
          model: character.model,
          characterId: character.id,
          episodeId: state.episode.id,
          requestJson: toInputJson({ ...state.builtContext, generationBudget: input.generationBudget }),
          responseJson: toInputJson({ failed: true, providerResponse: failure?.providerResponse ?? null }),
          tokensInput: failure?.tokensInput ?? 0,
          tokensOutput: failure?.tokensOutput ?? 0,
          estimatedCost: failure?.estimatedCost ?? 0,
          latencyMs: failure?.latencyMs ?? Date.now() - startedAt,
          error: message
        }
      })
      .catch((recordError) => console.error("Failed to persist failed LLM call", recordError));

    return {
      shouldEnd: true,
      endReason: getLlmErrorCode(error),
      error: `${character.displayName ?? character.name} 生成失败：${message}`
    };
  }
}
