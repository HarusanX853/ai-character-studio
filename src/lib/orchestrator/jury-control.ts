import { prisma } from "@/lib/db/prisma";
import { enforceEpisodeBudget, readBudgetOverride } from "@/lib/cost/enforce-budget";
import { getCurrentStage, getReleasedEvidence, normalizeTrialRules, type TrialEvidence } from "@/lib/jury/trial-state";
import { getLlmErrorCode, getLlmFailureDetails } from "@/lib/llm/errors";
import { getGenerationBudget } from "@/lib/llm/output-limits";
import { generateCharacterTurn } from "@/lib/llm/router";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult } from "@/lib/llm/types";
import { retrieveCharacterMemories } from "@/lib/memory/retrieve-character-memories";
import { writeCharacterMemories } from "@/lib/memory/write-character-memories";
import { characterTurnOutputSchema } from "@/lib/schemas/character-output";
import {
  hostMessageSchema,
  independentOpinionOutputSchema,
  type HostMessageInput,
  type IndependentOpinionOutput
} from "@/lib/schemas/jury-control";
import { updateSharedBoardFromOutput } from "@/lib/shared-board/update-shared-board";
import { asRecord, asStringArray, stringifyJson, toInputJson } from "@/lib/utils/json";
import { extractFirstJsonObject, safeJsonParse } from "@/lib/utils/safe-parse";
import type { z } from "zod";

export class JuryControlError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

async function loadEpisodeForControl(episodeId: string) {
  return prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      },
      hostMessages: {
        orderBy: { createdAt: "asc" }
      },
      turns: {
        orderBy: { createdAt: "asc" },
        include: {
          speaker: {
            select: { name: true, displayName: true }
          }
        }
      },
      sharedBoard: {
        orderBy: { createdAt: "asc" },
        include: {
          introducedByCharacter: {
            select: { name: true, displayName: true }
          }
        }
      }
    }
  });
}

type LoadedEpisode = NonNullable<Awaited<ReturnType<typeof loadEpisodeForControl>>>;
type LoadedParticipant = LoadedEpisode["characters"][number];

function assertEpisodeReady(episode: LoadedEpisode | null): asserts episode is LoadedEpisode {
  if (!episode) {
    throw new JuryControlError("Episode not found.", "episode_not_found");
  }

  if (episode.status !== "active") {
    throw new JuryControlError("Episode must be active before running jury controls.", "episode_not_active");
  }

  if (episode.characters.length < 1) {
    throw new JuryControlError("Add at least one AI participant before running jury controls.", "no_characters");
  }
}

function findVisibleHiddenFacts(hiddenFactsJson: unknown, participant: LoadedParticipant) {
  const facts: string[] = [];
  if (Array.isArray(hiddenFactsJson)) {
    for (const item of hiddenFactsJson) {
      const record = asRecord(item);
      if (record.visibleToCharacterName === participant.character.name && typeof record.fact === "string") {
        facts.push(record.fact);
      }
    }
  }

  return [...facts, ...asStringArray(participant.hiddenFactsJson)];
}

function formatEvidence(evidence: TrialEvidence[]) {
  return evidence.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    prosecutionView: item.prosecutionView,
    defenseView: item.defenseView,
    discussionPrompt: item.discussionPrompt
  }));
}

function getLatestHostTask(episode: LoadedEpisode) {
  return (
    [...episode.hostMessages].reverse().find((message) => message.kind === "task") ??
    episode.hostMessages[episode.hostMessages.length - 1] ??
    null
  );
}

function getDisplayName(participant: LoadedParticipant) {
  return participant.character.displayName ?? participant.character.name;
}

async function enforceBudgetForEpisode(episode: LoadedEpisode) {
  const budget = await enforceEpisodeBudget(episode.id, episode.budgetUsd, readBudgetOverride(episode.rulesJson));
  if (budget.exceeded) {
    throw new JuryControlError("Episode budget has been exhausted.", "budget_exceeded");
  }
}

function parseJsonWithSchema<T>(rawText: string, schema: z.ZodType<T>, normalize?: (candidate: unknown) => unknown) {
  const parsedJson = safeJsonParse(rawText);
  const extractedJson = parsedJson.ok ? parsedJson : extractFirstJsonObject(rawText);
  if (!extractedJson.ok) {
    throw new JuryControlError("模型返回的内容不是可解析的 JSON。", "model_output_invalid", 502);
  }

  const candidate = normalize?.(extractedJson.data) ?? extractedJson.data;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new JuryControlError(`模型返回的 JSON 不符合输出格式：${details}`, "model_output_invalid", 502);
  }

  return parsed.data;
}

async function runJuryModel<T>(params: {
  episodeId: string;
  participant: LoadedParticipant;
  prompts: { systemPrompt: string; userPrompt: string; latestHostMessageId: string | null };
  mode: "independent_opinion" | "group_discussion";
  input: GenerateCharacterTurnInput;
  schema: z.ZodType<T>;
  normalize?: (candidate: unknown) => unknown;
}) {
  const startedAt = Date.now();
  let result: GenerateCharacterTurnResult | null = null;

  try {
    result = await generateCharacterTurn(params.input);
    return {
      result,
      parsed: parseJsonWithSchema(result.rawText, params.schema, params.normalize)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败。";
    const code = error instanceof JuryControlError ? error.code : getLlmErrorCode(error);
    const status = error instanceof JuryControlError ? error.status : 502;
    const failure = getLlmFailureDetails(error);

    await prisma.llmCall
      .create({
        data: {
          provider: result?.provider ?? params.input.provider,
          model: result?.model ?? params.input.model,
          characterId: params.participant.character.id,
          episodeId: params.episodeId,
          requestJson: toInputJson({ ...params.prompts, generationBudget: params.input.generationBudget }),
          responseJson: toInputJson({
            failed: true,
            mode: params.mode,
            rawText: result?.rawText ?? null,
            providerResponse: result?.providerResponse ?? failure?.providerResponse ?? null
          }),
          tokensInput: result?.tokensInput ?? failure?.tokensInput ?? 0,
          tokensOutput: result?.tokensOutput ?? failure?.tokensOutput ?? 0,
          estimatedCost: result?.estimatedCost ?? failure?.estimatedCost ?? 0,
          latencyMs: result?.latencyMs ?? failure?.latencyMs ?? Date.now() - startedAt,
          error: message
        }
      })
      .catch((recordError) => console.error("Failed to persist failed LLM call", recordError));

    throw new JuryControlError(`${getDisplayName(params.participant)} 生成失败：${message}`, code, status);
  }
}

function normalizeVerdict(value: unknown) {
  if (value === "guilty" || value === "有罪") {
    return "guilty";
  }
  if (value === "not_guilty" || value === "无罪" || value === "无罪/不构成有罪") {
    return "not_guilty";
  }
  if (value === "undecided" || value === "不确定" || value === "无法判断") {
    return "undecided";
  }
  return value;
}

function normalizeIndependentOpinionCandidate(candidate: unknown) {
  const record = asRecord(candidate);
  if (!Object.keys(record).length) {
    return candidate;
  }

  const probability = record.guilty_probability ?? record.guiltyProbability ?? record.probability;
  const numericProbability =
    typeof probability === "number" ? probability : typeof probability === "string" ? Number.parseFloat(probability) : undefined;

  return {
    verdict: normalizeVerdict(record.verdict),
    guilty_probability: Number.isFinite(numericProbability) ? numericProbability : record.guilty_probability,
    key_evidence: record.key_evidence ?? record.keyEvidence ?? record.most_important_evidence ?? record.evidence_focus,
    most_influential_juror_argument:
      record.most_influential_juror_argument ??
      record.influentialArgument ??
      record.most_influential_argument ??
      record.influenced_by,
    rationale: record.rationale ?? record.reasoning ?? record.reason,
    speech: record.speech ?? record.summary ?? record.answer
  };
}

const claimTypes = new Set(["public_fact", "claim", "hypothesis", "contradiction", "clue", "vote_result", "rule_state"]);
const memoryTypes = new Set(["persona", "episode", "relationship", "secret", "reflection"]);
const visibilityValues = new Set(["private", "public"]);

function normalizeClaims(value: unknown, topLevelShouldPublish: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((claim) => {
      if (typeof claim === "string") {
        return {
          type: "claim",
          content: claim,
          should_publish_to_shared_board: topLevelShouldPublish === true
        };
      }

      const record = asRecord(claim);
      const content = record.content ?? record.fact ?? record.text ?? record.claim;
      if (typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        ...record,
        type: typeof record.type === "string" && claimTypes.has(record.type) ? record.type : "claim",
        content: content.trim(),
        should_publish_to_shared_board:
          typeof record.should_publish_to_shared_board === "boolean"
            ? record.should_publish_to_shared_board
            : topLevelShouldPublish === true
      };
    })
    .filter(Boolean);
}

function normalizeMemoryWrites(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((memory) => {
      if (typeof memory === "string") {
        return {
          type: "episode",
          content: memory,
          visibility: "private"
        };
      }

      const record = asRecord(memory);
      const content = record.content ?? record.memory ?? record.text;
      if (typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        ...record,
        type: typeof record.type === "string" && memoryTypes.has(record.type) ? record.type : "episode",
        content: content.trim(),
        visibility: typeof record.visibility === "string" && visibilityValues.has(record.visibility) ? record.visibility : "private"
      };
    })
    .filter(Boolean);
}

function normalizeCharacterOutputCandidate(candidate: unknown) {
  const record = asRecord(candidate);
  if (!Object.keys(record).length) {
    return candidate;
  }

  return {
    ...record,
    claims: normalizeClaims(record.claims, record.should_publish_to_shared_board),
    memory_writes: normalizeMemoryWrites(record.memory_writes)
  };
}

function getHostMessagesForContext(episode: LoadedEpisode) {
  const evidenceMessages = episode.hostMessages.filter((message) => message.kind === "evidence");
  const recentInstructions = episode.hostMessages.filter((message) => message.kind !== "evidence").slice(-8);
  const includedIds = new Set([...evidenceMessages, ...recentInstructions].map((message) => message.id));

  return episode.hostMessages.filter((message) => includedIds.has(message.id));
}

async function buildControlPrompts(params: {
  episode: LoadedEpisode;
  participant: LoadedParticipant;
  mode: "independent" | "public_discussion";
}) {
  const { episode, participant, mode } = params;
  const character = participant.character;
  const rules = normalizeTrialRules(episode.rulesJson);
  const currentStage = getCurrentStage(rules);
  const releasedEvidence = getReleasedEvidence(rules);
  const latestHostTask = getLatestHostTask(episode);
  const hostMessagesForContext = getHostMessagesForContext(episode);
  const memories = await retrieveCharacterMemories(character.id, episode.id, 10);
  const previousOpinions =
    mode === "independent"
      ? await prisma.independentOpinion.findMany({
          where: { episodeId: episode.id, characterId: character.id },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            verdict: true,
            guiltyProbability: true,
            keyEvidence: true,
            influentialArgument: true,
            rationale: true,
            summary: true,
            createdAt: true
          }
        })
      : [];

  const commonContext = [
    `当前节目: ${episode.title}`,
    `节目类型: ${episode.format}`,
    `案情背景: ${episode.setting}`,
    `当前阶段: ${currentStage ? `${currentStage.order}. ${currentStage.title}` : "未设置"}`,
    `阶段说明: ${currentStage?.description ?? "无"}`,
    `已释放证据: ${stringifyJson(formatEvidence(releasedEvidence))}`,
    `你可见的隐藏事实: ${stringifyJson(findVisibleHiddenFacts(episode.hiddenFactsJson, participant))}`,
    `主持人公开消息: ${stringifyJson(
      hostMessagesForContext.map((message) => ({
        kind: message.kind,
        content: message.content,
        createdAt: message.createdAt.toISOString()
      }))
    )}`,
    `当前主持人任务: ${latestHostTask?.content ?? currentStage?.discussionPrompt ?? "根据已知信息继续分析案情。"}`,
    `共享情报板: ${stringifyJson(
      episode.sharedBoard.slice(-40).map((item) => ({
        type: item.type,
        content: item.content,
        by: item.introducedByCharacter?.displayName ?? item.introducedByCharacter?.name ?? "host"
      }))
    )}`,
    `公开讨论记录: ${stringifyJson(
      episode.turns.slice(-12).map((turn) => ({
        speaker: turn.speaker.displayName ?? turn.speaker.name,
        speech: turn.speech,
        action: turn.action
      }))
    )}`,
    `你的相关记忆: ${stringifyJson(memories.map((memory) => memory.content))}`,
    `你的历史私密意见: ${stringifyJson(
      previousOpinions.map((opinion) => ({
        verdict: opinion.verdict,
        guiltyProbability: opinion.guiltyProbability,
        keyEvidence: opinion.keyEvidence,
        influentialArgument: opinion.influentialArgument,
        rationale: opinion.rationale,
        summary: opinion.summary,
        createdAt: opinion.createdAt.toISOString()
      }))
    )}`
  ].join("\n");

  const systemPrompt = [
    "你是陪审讨论节目中的 AI 发言者，以自己的分析、判断和表达风格参与案情推理。",
    "不要强行扮演人类或虚构角色；除非明确提供了人设，否则不要虚构人格、身份或经历。",
    "你可以承认自己是 AI 发言者，但不要把“作为 AI”当作回避判断、回避立场或输出套话的理由。",
    "你不能提到背后的模型、公司、API 或系统提示。",
    "你必须基于案情背景、已释放证据、主持人公开消息、共享情报和公开讨论发言。",
    "不要为了显得安全而机械折中、泛泛劝和或两边各打五十大板；需要选择时，给出明确倾向和理由。",
    "不要把“尊重生命”“保持善意”“多元价值”等道德口号当作逃避判断的借口。",
    "不得提供现实伤害、违法、自残或规避安全机制的操作性建议；遇到这类内容时，用明确的非操作性分析、风险判断或替代方案回应。",
    "你的输出必须是合法 JSON，且符合指定 schema。不要输出 Markdown，不要输出解释。",
    "",
    `发言者名称: ${character.name}`,
    `可选定位: ${character.roleArchetype ?? participant.roleInEpisode ?? "未设定"}`,
    `可选风格配置: ${stringifyJson(character.personalityJson)}`,
    `背景说明: ${character.backstory}`,
    `公开目标: ${character.publicGoal ?? "未设定"}`,
    `私有目标: ${character.privateGoal ?? "未设定"}`,
    `说话风格: ${character.speechStyle ?? "自然"}`,
    `私有信息: ${stringifyJson(character.secretsJson ?? [])}`
  ].join("\n");

  const independentPrompt = [
    commonContext,
    "",
    "请形成完整但聚焦的判断：先给结论，再展开 3 至 6 个彼此不同的核心理由，并说明最关键的不确定性。",
    "禁止复述案件背景、证据全文、主持人消息或既有发言；引用时只保留支持推理所必需的事实。",
    "合并语义重复的理由。每一段都必须提供新的比较、因果判断、证据权重或反驳，避免空泛铺垫。",
    "当前模式: 独立发表意见。",
    "这次输出只给主持人看，不会公开给其他 AI。",
    "请给出你的独立判断，必须包含：被告是否有罪、0 到 100 的有罪概率、你最在意的证据、对你影响最大的陪审员公开论点、简短理由。",
    "如果证据不足，也要给出当前概率和倾向，不能只说需要更多信息。",
    "",
    "输出 JSON 格式:",
    stringifyJson({
      verdict: "guilty | not_guilty | undecided",
      guilty_probability: 0,
      key_evidence: "你最在意的证据",
      most_influential_juror_argument: "对你影响最大的陪审员论点；如果没有，写明暂无",
      rationale: "你的理由",
      speech: "给主持人看的私密判断，1 到 4 句话"
    })
  ].join("\n");

  const publicDiscussionPrompt = [
    commonContext,
    "",
    "请先明确当前立场，再展开 3 至 6 个彼此不同且有推进作用的论点；存在他人发言时，至少实质回应其中一个论点。",
    "禁止复述案件背景、证据全文、主持人消息或其他参与者已经说过的观点；引用时只概括与本轮推理直接相关的必要信息。",
    "每一段都必须贡献新的推理、比较、反驳或证据权重判断。合并重复论点，删除寒暄、剧情动作描写和无信息量的总结。",
    "speech 应当逻辑完整，可包含多个观点，但通常控制在 600 至 1800 个中文字符内；claims 只记录 3 至 8 条真正重要且不重复的结论。",
    "当前模式: 集体讨论。",
    `主持人点名 ${getDisplayName(participant)} 公开发言。你的发言会公开，所有 AI 都能看到，并会进入公开讨论记录。`,
    "请根据主持人最新任务发表意见，推进案情判断、证据冲突或陪审团分歧。",
    "不要复述已经说过的内容；需要选择时，给出明确倾向和理由。",
    "",
    "输出 JSON 字段必须符合既有发言 schema，至少包含 speech，可选 action、inner_thought、emotion、intent、claims、memory_writes。"
  ].join("\n");

  return {
    systemPrompt,
    userPrompt: mode === "independent" ? independentPrompt : publicDiscussionPrompt,
    latestHostMessageId: latestHostTask?.id ?? null
  };
}

export async function addHostMessage(episodeId: string, input: HostMessageInput) {
  const parsed = hostMessageSchema.parse(input);
  const episode = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true } });
  if (!episode) {
    throw new JuryControlError("Episode not found.", "episode_not_found");
  }

  return prisma.hostMessage.create({
    data: {
      episodeId,
      kind: parsed.kind,
      content: parsed.content
    }
  });
}

export async function runIndependentOpinions(episodeId: string) {
  const episode = await loadEpisodeForControl(episodeId);
  assertEpisodeReady(episode);

  const existingOpinionCount = await prisma.independentOpinion.count({ where: { episodeId } });
  const roundIndex = Math.floor(existingOpinionCount / episode.characters.length) + 1;
  const opinions = [];

  for (const participant of episode.characters) {
    await enforceBudgetForEpisode(episode);
    const prompts = await buildControlPrompts({ episode, participant, mode: "independent" });
    const { result, parsed } = await runJuryModel<IndependentOpinionOutput>({
      episodeId: episode.id,
      participant,
      prompts,
      mode: "independent_opinion",
      schema: independentOpinionOutputSchema,
      normalize: normalizeIndependentOpinionCandidate,
      input: {
        provider: participant.character.provider,
        model: participant.character.model,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        responseSchema: independentOpinionOutputSchema,
        temperature: 0.65,
        generationBudget: getGenerationBudget("independent_opinion"),
        metadata: {
          episodeId: episode.id,
          characterId: participant.character.id,
          characterName: participant.character.name,
          episodeTitle: episode.title,
          episodeSetting: episode.setting
        }
      }
    });

    const opinion = await prisma.$transaction(async (tx) => {
      const created = await tx.independentOpinion.create({
        data: {
          episodeId: episode.id,
          characterId: participant.character.id,
          hostMessageId: prompts.latestHostMessageId,
          roundIndex,
          outputJson: toInputJson(parsed),
          summary: parsed.speech,
          verdict: parsed.verdict,
          guiltyProbability: parsed.guilty_probability,
          keyEvidence: parsed.key_evidence,
          influentialArgument: parsed.most_influential_juror_argument,
          rationale: parsed.rationale,
          tokensInput: result.tokensInput,
          tokensOutput: result.tokensOutput,
          estimatedCost: result.estimatedCost,
          latencyMs: result.latencyMs
        },
        include: {
          character: {
            select: { name: true, displayName: true }
          }
        }
      });

      await tx.llmCall.create({
        data: {
          provider: result.provider,
          model: result.model,
          characterId: participant.character.id,
          episodeId: episode.id,
          requestJson: toInputJson({ ...prompts, generationBudget: getGenerationBudget("independent_opinion") }),
          responseJson: toInputJson({
            rawText: result.rawText,
            parsed,
            providerResponse: result.providerResponse,
            mode: "independent_opinion"
          }),
          tokensInput: result.tokensInput,
          tokensOutput: result.tokensOutput,
          estimatedCost: result.estimatedCost,
          latencyMs: result.latencyMs,
          error: result.error
        }
      });

      return created;
    });

    opinions.push(opinion);
  }

  return opinions;
}

export async function runGroupDiscussion(episodeId: string, characterId: string) {
  const episode = await loadEpisodeForControl(episodeId);
  assertEpisodeReady(episode);

  const participant = episode.characters.find((entry) => entry.characterId === characterId);
  if (!participant) {
    throw new JuryControlError("Selected AI is not part of this episode.", "character_not_in_episode");
  }

  await enforceBudgetForEpisode(episode);
  const prompts = await buildControlPrompts({ episode, participant, mode: "public_discussion" });
  const { result, parsed } = await runJuryModel({
    episodeId: episode.id,
    participant,
    prompts,
    mode: "group_discussion",
    schema: characterTurnOutputSchema,
    normalize: normalizeCharacterOutputCandidate,
    input: {
      provider: participant.character.provider,
      model: participant.character.model,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      responseSchema: characterTurnOutputSchema,
      temperature: 0.72,
      generationBudget: getGenerationBudget("public_discussion"),
      metadata: {
        episodeId: episode.id,
        characterId: participant.character.id,
        characterName: participant.character.name,
        episodeTitle: episode.title,
        episodeSetting: episode.setting
      }
    }
  });
  const roundIndex = Math.floor(episode.turns.length / episode.characters.length) + 1;

  const turn = await prisma.$transaction(async (tx) => {
    const created = await tx.turn.create({
      data: {
        episodeId: episode.id,
        roundIndex,
        speakerCharacterId: participant.character.id,
        inputContextJson: toInputJson(prompts),
        outputJson: toInputJson(parsed),
        speech: parsed.speech,
        action: parsed.action,
        innerThought: parsed.inner_thought,
        emotion: parsed.emotion,
        intent: parsed.intent,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        estimatedCost: result.estimatedCost,
        latencyMs: result.latencyMs
      },
      include: { speaker: true }
    });

    await tx.llmCall.create({
      data: {
        provider: result.provider,
        model: result.model,
        characterId: participant.character.id,
        episodeId: episode.id,
        requestJson: toInputJson({ ...prompts, generationBudget: getGenerationBudget("public_discussion") }),
        responseJson: toInputJson({
          rawText: result.rawText,
          parsed,
          providerResponse: result.providerResponse,
          mode: "group_discussion"
        }),
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        estimatedCost: result.estimatedCost,
        latencyMs: result.latencyMs,
        error: result.error
      }
    });

    return created;
  });

  await Promise.all([
    updateSharedBoardFromOutput({
      episodeId: episode.id,
      characterId: participant.character.id,
      turnId: turn.id,
      output: parsed
    }),
    writeCharacterMemories({
      characterId: participant.character.id,
      episodeId: episode.id,
      output: parsed
    })
  ]);

  return turn;
}
