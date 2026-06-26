import { estimateTokenCount } from "@/lib/cost/estimate-cost";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "../types";

function pickEmotion(seed: string) {
  const emotions = ["冷静", "怀疑", "克制", "警觉", "好奇", "笃定"];
  return emotions[seed.length % emotions.length];
}

function extractAfter(label: string, text: string) {
  const match = text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`));
  return match?.[1]?.trim();
}

export const mockProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const startedAt = Date.now();
    const characterName =
      input.metadata?.characterName ?? extractAfter("角色名称", input.systemPrompt) ?? "角色";
    const setting =
      input.metadata?.episodeSetting ?? extractAfter("场景设定", input.userPrompt) ?? "当前场景";
    const emotion = pickEmotion(`${characterName}:${setting}:${input.userPrompt.length}`);
    const speech = `${characterName}看向众人，抓住了一个新的细节：${setting.slice(0, 42)}。这个线索不能只当作背景，它会改变我们下一步的判断。`;

    const payload = {
      speech,
      action: "把视线从记录上移开，缓慢开口。",
      inner_thought: "如果现在公开得太多，可能会暴露自己的真实判断。",
      emotion,
      intent: "advance_reasoning",
      claims: [
        {
          type: "hypothesis",
          content: `${characterName}认为当前局势中存在被忽略的关键矛盾。`,
          confidence: 0.62,
          should_publish_to_shared_board: true
        }
      ],
      memory_writes: [
        {
          type: "episode",
          content: `${characterName}在本轮把注意力放在被忽略的矛盾上。`,
          visibility: "private",
          importance: 0.58
        }
      ]
    };

    const rawText = JSON.stringify(payload);
    const tokensInput = estimateTokenCount(`${input.systemPrompt}\n${input.userPrompt}`);
    const tokensOutput = estimateTokenCount(rawText);

    return {
      rawText,
      parsed: payload,
      tokensInput,
      tokensOutput,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      providerResponse: { mocked: true },
      provider: "mock-local",
      model: "mock-roleplay"
    };
  }
};
