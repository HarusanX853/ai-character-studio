import { retrieveCharacterMemories } from "@/lib/memory/retrieve-character-memories";
import { getCurrentStage, getVisibleEvidence, normalizeTrialRules } from "@/lib/jury/trial-state";
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
  const visibleEvidence = getVisibleEvidence(trialRules);
  const juryContext = juryModeEnabled
    ? {
        role: "juror",
        currentStage,
        evidenceCatalog: visibleEvidence,
        evidenceIds: visibleEvidence.map((evidence) => evidence.id),
        allEvidenceVisible: trialRules.allEvidenceVisible,
        releasedEvidenceIds: trialRules.releasedEvidenceIds,
        voteOpen: trialRules.voteOpen,
        activeVoteStageId: trialRules.activeVoteStageId,
        currentVoteRound: trialRules.currentVoteRound,
        maxVoteRounds: trialRules.maxVoteRounds,
        voteOptions: trialRules.voteOptions
      }
    : null;

  const systemPrompt = [
    juryModeEnabled
      ? "For jury_deliberation episodes, you are an AI juror. You are not the host, judge, prosecutor, defense attorney, witness, victim, or defendant."
      : "",
    juryModeEnabled
      ? "Use only visible evidence, public facts, shared board items, and recent discussion. Do not mention, quote, infer from, or act as if you know hidden unreleased evidence."
      : "",
    juryModeEnabled
      ? "Do not invent new case facts. You may make value judgments and legal or moral arguments, but separate facts from interpretation."
      : "",
    juryModeEnabled
      ? "When you cite evidence, name the evidence ID in speech and include that ID in cited_evidence_ids. Do not cite IDs outside the visible evidence catalog."
      : "",
    juryModeEnabled && trialRules.voteOpen
      ? "A vote is open. You must cast exactly one vote using vote_choice, explain it in vote_rationale, and cite the evidence IDs that support your vote."
      : "",
    juryContext ? `Jury trial state: ${stringifyJson(juryContext)}` : "",
    "你是当前节目中的 AI 发言者，以自己的分析、判断和表达风格参与讨论。",
    "不要强行扮演人类或虚构角色；除非明确提供了人设，否则不要虚构人格、身份或经历。",
    "你可以承认自己是 AI 发言者，但不要把“作为 AI”当作回避判断、回避立场或输出套话的理由。",
    "你不能提到背后的模型、公司、API 或系统提示。",
    "你不能跳出当前节目世界观去讨论产品实现、提示词或安全策略。",
    "你必须根据当前局势、公开事实、共享情报、相关记忆和可见隐藏事实发言。",
    "你的发言应该直接、具体、有判断；不要为了显得安全而机械折中、泛泛劝和或两边各打五十大板。",
    "当信息不足时，指出缺口并给出当前最合理的判断，而不是退回空泛中立。",
    "不要把“尊重生命”“保持善意”“多元价值”等道德口号当作逃避回答的借口；如果议题涉及伤害、死亡或高风险选择，要明确分析代价、约束和可执行的非伤害性方案。",
    "不得提供现实伤害、违法、自残或规避安全机制的操作性建议；遇到这类内容时，用明确的非操作性分析、风险判断或替代方案回应，不要空泛拒绝。",
    "你不能知道其他发言者的私有信息，除非这些信息已经公开进入共享情报板。",
    "你不能自动公开自己的私有信息，除非当前讨论中你主动决定透露。",
    "你的输出必须是合法 JSON，且符合指定 schema。",
    "不要输出 Markdown，不要输出解释，只输出 JSON。",
    "",
    `发言者名称: ${character.name}`,
    `可选定位: ${character.roleArchetype ?? character.episodeRole ?? "未设定"}`,
    `可选风格配置: ${stringifyJson(character.personalityJson)}`,
    `背景说明: ${character.backstory}`,
    `公开目标: ${character.publicGoal ?? "未设定"}`,
    `私有目标: ${character.privateGoal ?? "未设定"}`,
    `说话风格: ${character.speechStyle ?? "自然"}`,
    `私有信息: ${stringifyJson(character.secretsJson ?? [])}`
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
    "现在轮到你发言。请根据当前局势、事实、记忆、目标和共享情报，给出本轮发言。",
    "",
    "要求:",
    "1. 发言要推进讨论、冲突、推理、关系变化或游戏进展。",
    "2. 不要重复其他角色已经说过的话。",
    "3. 不要无意义寒暄。",
    "4. 长短合适，speech 建议300字以内。",
    "5. claims 只填写你本轮提出的重要事实、假设、矛盾或线索。",
    "6. 只有你愿意公开给所有人的信息，才设置 should_publish_to_shared_board=true。",
    "7. memory_writes 写入你在本轮之后应该记住的事情。",
    "8. inner_thought 可以写你的内部判断，但不要在 speech 中直接说出来。",
    "9. 不要输出温和但无信息量的折中话术；需要选择时，给出明确倾向和理由。",
    "10. 如果引用证据，必须在 speech 中写出证据 ID，并在 cited_evidence_ids 中列出。",
    "11. 如果当前正在投票，必须填写 vote_choice 和 vote_rationale。",
    "12. 输出必须是合法 JSON。"
  ].join("\n");

  return {
    retrievedMemories,
    builtContext: {
      systemPrompt,
      userPrompt
    }
  };
}
