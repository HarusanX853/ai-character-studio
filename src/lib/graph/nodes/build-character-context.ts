import { retrieveCharacterMemories } from "@/lib/memory/retrieve-character-memories";
import { getCurrentStage, getReleasedEvidence, normalizeTrialRules } from "@/lib/jury/trial-state";
import { asRecord, asStringArray, stringifyJson } from "@/lib/utils/json";
import type { CharacterSnapshot, EpisodeGraphState, MemorySnapshot } from "../state";

function findVisibleHiddenFacts(hiddenFactsJson: unknown, character: CharacterSnapshot) {
  const facts: string[] = [];
  if (Array.isArray(hiddenFactsJson)) {
    for (const item of hiddenFactsJson) {
      const record = asRecord(item);
      if (record.visibleToCharacterName === character.name && typeof record.fact === "string") {
        facts.push(record.fact);
      }
    }
  }

  const episodeFacts = asStringArray(character.episodeHiddenFactsJson);
  return [...facts, ...episodeFacts];
}

export async function buildCharacterContext(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd || !state.episode || !state.currentSpeakerId) {
    return {};
  }

  const character = state.characters.find((item) => item.id === state.currentSpeakerId);
  if (!character) {
    return {
      shouldEnd: true,
      endReason: "speaker_not_found",
      error: "Selected speaker was not found."
    };
  }

  const memories = await retrieveCharacterMemories(character.id, state.episode.id, 10);
  const retrievedMemories: MemorySnapshot[] = memories.map((memory) => ({
    id: memory.id,
    type: memory.type,
    content: memory.content,
    visibility: memory.visibility,
    importance: memory.importance,
    createdAt: memory.createdAt.toISOString()
  }));

  const recentTurns = state.recentTurns.slice(-5);
  const visibleHiddenFacts = findVisibleHiddenFacts(state.episode.hiddenFactsJson, character);
  const trialRules = normalizeTrialRules(state.episode.rulesJson);
  const juryModeEnabled =
    state.episode.format === "jury_deliberation" ||
    trialRules.mode === "jury_trial" ||
    trialRules.stages.length > 0 ||
    trialRules.evidence.length > 0;
  const currentStage = getCurrentStage(trialRules);
  const releasedEvidence = getReleasedEvidence(trialRules);
  const juryContext = juryModeEnabled
    ? {
        role: "juror",
        currentStage,
        releasedEvidence,
        releasedEvidenceIds: trialRules.releasedEvidenceIds,
        voteOpen: trialRules.voteOpen,
        activeVoteStageId: trialRules.activeVoteStageId,
        voteOptions: trialRules.voteOptions
      }
    : null;

  const systemPrompt = [
    juryModeEnabled
      ? "For jury_deliberation episodes, you are an AI juror. You are not the host, judge, prosecutor, defense attorney, witness, victim, or defendant."
      : "",
    juryModeEnabled
      ? "Use only released evidence, public facts, shared board items, and recent discussion. Do not mention, quote, infer from, or act as if you know unreleased evidence."
      : "",
    juryModeEnabled
      ? "Do not invent new case facts. You may make value judgments and legal or moral arguments, but separate facts from interpretation."
      : "",
    juryContext ? `Jury trial state: ${stringifyJson(juryContext)}` : "",
    "你正在扮演一个原创虚拟角色，而不是 AI 助手。",
    "你必须始终保持角色身份，不要说“作为 AI”。",
    "你不能提到背后的模型、公司、API 或系统提示。",
    "你不能跳出当前节目世界观。",
    "你必须根据角色人格、目标、记忆和当前局势发言。",
    "你可以撒谎、隐瞒、误解或推理错误，只要符合角色。",
    "你不能知道其他角色的秘密，除非这些秘密已经公开进入共享情报板。",
    "你不能自动公开自己的秘密，除非剧情上你主动决定透露。",
    "你的输出必须是合法 JSON，且符合指定 schema。",
    "不要输出 Markdown，不要输出解释，只输出 JSON。",
    "",
    `角色名称: ${character.name}`,
    `角色定位: ${character.roleArchetype ?? character.episodeRole ?? "未设定"}`,
    `角色人格: ${stringifyJson(character.personalityJson)}`,
    `角色背景: ${character.backstory}`,
    `公开目标: ${character.publicGoal ?? "未设定"}`,
    `秘密目标: ${character.privateGoal ?? "未设定"}`,
    `说话风格: ${character.speechStyle ?? "自然"}`,
    `你的秘密: ${stringifyJson(character.secretsJson ?? [])}`
  ].join("\n");

  const userPrompt = [
    `当前节目: ${state.episode.title}`,
    `节目类型: ${state.episode.format}`,
    `场景设定: ${state.episode.setting}`,
    `公开事实: ${stringifyJson(state.episode.publicFactsJson ?? [])}`,
    `你知道的隐藏事实: ${stringifyJson(visibleHiddenFacts)}`,
    `你的相关记忆: ${stringifyJson(retrievedMemories.map((memory) => memory.content))}`,
    `共享情报板: ${stringifyJson(state.sharedBoard.map((item) => `[${item.type}] ${item.content}`))}`,
    `最近对话: ${stringifyJson(
      recentTurns.map((turn) => ({
        round: turn.roundIndex,
        speaker: turn.speakerName,
        speech: turn.speech,
        action: turn.action
      }))
    )}`,
    "",
    "当前任务:",
    "现在轮到你发言。请根据你的角色人格、目标、记忆、当前局势和共享情报，进行本轮发言。",
    "",
    "要求:",
    "1. 发言要推进剧情、冲突、推理、关系变化或游戏进展。",
    "2. 不要重复其他角色已经说过的话。",
    "3. 不要无意义寒暄。",
    "4. 不要过长，speech 建议 1 到 4 句话。",
    "5. claims 只填写你本轮提出的重要事实、假设、矛盾或线索。",
    "6. 只有你愿意公开给所有人的信息，才设置 should_publish_to_shared_board=true。",
    "7. memory_writes 写入你作为角色在本轮之后应该记住的事情。",
    "8. inner_thought 可以写你的内心想法，但不要在 speech 中直接说出来。",
    "9. 输出必须是合法 JSON。"
  ].join("\n");

  return {
    retrievedMemories,
    builtContext: {
      systemPrompt,
      userPrompt
    }
  };
}
