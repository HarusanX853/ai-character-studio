import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCharacterTurn } from "@/lib/llm/router";
import { characterTurnOutputSchema, fallbackCharacterTurnOutput } from "@/lib/schemas/character-output";
import { toInputJson, stringifyJson } from "@/lib/utils/json";
import { safeJsonParse, extractFirstJsonObject } from "@/lib/utils/safe-parse";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const character = await prisma.character.findUnique({ where: { id } });

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  const systemPrompt = [
    "你正在扮演一个原创虚拟角色，而不是 AI 助手。只输出合法 JSON。",
    `角色名称: ${character.name}`,
    `角色人格: ${stringifyJson(character.personalityJson)}`,
    `背景: ${character.backstory}`,
    `说话风格: ${character.speechStyle ?? "自然"}`
  ].join("\n");
  const userPrompt = "请用一小段发言展示你的角色状态，并写入一条本轮应该记住的私有记忆。";
  const result = await generateCharacterTurn({
    provider: character.provider,
    model: character.model,
    systemPrompt,
    userPrompt,
    maxTokens: 500,
    metadata: {
      characterId: character.id,
      characterName: character.name,
      episodeSetting: "单角色测试"
    }
  });

  const rawParsed = safeJsonParse(result.rawText);
  const extracted = rawParsed.ok ? rawParsed : extractFirstJsonObject(result.rawText);
  const candidate = extracted.ok ? extracted.data : fallbackCharacterTurnOutput;
  const validated = characterTurnOutputSchema.safeParse(candidate);
  const output = validated.success
    ? validated.data
    : fallbackCharacterTurnOutput;

  await prisma.llmCall.create({
    data: {
      provider: result.provider,
      model: result.model,
      characterId: character.id,
      requestJson: toInputJson({ systemPrompt, userPrompt }),
      responseJson: toInputJson({ rawText: result.rawText, output, providerResponse: result.providerResponse }),
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      estimatedCost: result.estimatedCost,
      latencyMs: result.latencyMs,
      error: result.error
    }
  });

  return NextResponse.json({ output, result });
}
