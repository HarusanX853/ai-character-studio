import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const characters = [
  {
    name: "林澈",
    provider: "openai",
    model: "gpt-4.1-mini",
    roleArchetype: "冷静的逻辑分析者",
    personalityJson: {
      traits: ["理性", "克制", "证据主义", "怀疑证词"],
      flaws: ["容易忽视情绪线索"]
    },
    backstory: "曾经参与过一起误判案件，因此极度重视证据链。",
    publicGoal: "推动陪审团基于证据作出裁决。",
    privateGoal: "避免任何人再次因为仓促判断而被定罪。",
    secretsJson: ["他曾在旧案中投下过错误的一票。"],
    speechStyle: "短句、直接、喜欢反问"
  },
  {
    name: "白鸥",
    provider: "anthropic",
    model: "claude-sonnet",
    roleArchetype: "感性的共情者",
    personalityJson: {
      traits: ["敏锐", "温和", "关注情绪变化"],
      flaws: ["容易替他人寻找动机"]
    },
    backstory: "曾经是心理咨询师，善于捕捉沉默背后的压力。",
    publicGoal: "理解证人与嫌疑人的心理状态。",
    privateGoal: "证明情绪线索也可以成为重要证据。",
    secretsJson: ["她认识案发别墅的一名前雇员。"],
    speechStyle: "细腻、带有情绪观察"
  },
  {
    name: "赫尔曼",
    provider: "gemini",
    model: "gemini-pro",
    roleArchetype: "系统化的战略家",
    personalityJson: {
      traits: ["宏观", "结构化", "擅长画局势图"],
      flaws: ["有时过度抽象"]
    },
    backstory: "前军事推演顾问，习惯先建立局势模型再讨论细节。",
    publicGoal: "把混乱证词归纳为可推演的路线。",
    privateGoal: "让陪审团接受他的结构化推理框架。",
    secretsJson: ["他曾为嫌疑人 A 的公司做过风险咨询。"],
    speechStyle: "条理清晰，经常分点陈述"
  },
  {
    name: "砂夜",
    provider: "deepseek",
    model: "deepseek-chat",
    roleArchetype: "沉默的怀疑者",
    personalityJson: {
      traits: ["寡言", "敏锐", "善于发现矛盾"],
      flaws: ["不愿解释自己的推理过程"]
    },
    backstory: "曾是地下调查员，习惯在噪音中寻找不自然的空白。",
    publicGoal: "找出证据链中最不自然的部分。",
    privateGoal: "不让任何人察觉她掌握了额外线索。",
    secretsJson: ["她收到过一封匿名短信，提示监控黑屏并非偶然。"],
    speechStyle: "少说话，但每句话都有刺"
  },
  {
    name: "诺亚",
    provider: "xai",
    model: "grok",
    roleArchetype: "挑衅型破局者",
    personalityJson: {
      traits: ["讽刺", "反权威", "擅长打破沉默"],
      flaws: ["容易激怒同伴"]
    },
    backstory: "曾经是脱口秀演员和黑客，喜欢用反常识问题逼别人暴露立场。",
    publicGoal: "打破陪审团的礼貌沉默。",
    privateGoal: "证明权威叙事里一定有人撒谎。",
    secretsJson: ["他偷偷查过案发别墅的旧监控维修记录。"],
    speechStyle: "幽默、尖锐、经常挑衅别人"
  },
  {
    name: "雾岛莲",
    provider: "mock-local",
    model: "mock-roleplay",
    roleArchetype: "神秘的记录者",
    personalityJson: {
      traits: ["安静", "诗意", "旁观者", "似乎知道更多"],
      flaws: ["发言含混"]
    },
    backstory: "来历不明，只负责记录每个人说过的话。",
    publicGoal: "保存讨论中每个被忽略的细节。",
    privateGoal: "等待那个真正安静的人露出破绽。",
    secretsJson: ["雾岛莲知道死者在案发前写下过一句未完成的话。"],
    speechStyle: "简短、文学化、有隐喻"
  }
];

const publicFacts = [
  "死者于凌晨 1 点到 2 点之间死亡。",
  "嫌疑人 A 声称自己整晚没有离开房间。",
  "别墅走廊监控在 1:17 到 1:20 出现黑屏。",
  "案发当晚有暴雨，室外脚印很快被冲刷。",
  "死者生前与嫌疑人 A 有财务纠纷。"
];

const evidence = [
  {
    id: "E1",
    title: "走廊监控黑屏记录",
    content: "别墅二楼走廊监控在 1:17 到 1:20 出现连续 180 秒黑屏，恢复后画面中没有看到嫌疑人 A。",
    prosecutionView: "黑屏时间覆盖了作案窗口，可能是嫌疑人 A 避开监控的关键操作。",
    defenseView: "暴雨夜电力不稳，黑屏不能直接证明有人操控。"
  },
  {
    id: "E2",
    title: "管家证词",
    content: "管家称 1:10 左右听见死者书房方向传来争吵声，其中一个声音像嫌疑人 A。",
    prosecutionView: "证词支持嫌疑人 A 在死亡窗口前后接近书房。",
    defenseView: "管家承认隔着雨声和墙壁，无法确认声音身份。"
  },
  {
    id: "E3",
    title: "湿鞋印照片",
    content: "书房门外发现一枚半残湿鞋印，尺码接近嫌疑人 A，但鞋底纹路只有局部可见。",
    prosecutionView: "鞋印将嫌疑人 A 与书房门口联系起来。",
    defenseView: "脚印残缺，且别墅内多人穿相近尺码皮鞋。"
  },
  {
    id: "E4",
    title: "死者未完成便签",
    content: "死者桌上有一张被雨水浸湿的便签，只能辨认出“不是他，是那个最安静……”几个字。",
    prosecutionView: "便签可能是死者临终前试图指出真凶。",
    defenseView: "便签语义不完整，不能确定“他”指谁。"
  },
  {
    id: "E5",
    title: "财务纠纷邮件",
    content: "死者案发前一周向嫌疑人 A 发送邮件，要求其在月底前偿还一笔高额债务。",
    prosecutionView: "财务压力提供了明确动机。",
    defenseView: "动机不等于作案，邮件语气更像商业催款。"
  }
];

function formatEvidenceForBoard(item: (typeof evidence)[number]) {
  return [
    `Evidence ${item.id}: ${item.title}`,
    item.content,
    item.prosecutionView ? `Prosecution view: ${item.prosecutionView}` : null,
    item.defenseView ? `Defense view: ${item.defenseView}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

async function main() {
  await prisma.episodeCheckpoint.deleteMany();
  await prisma.llmCall.deleteMany();
  await prisma.sharedBoardItem.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.turn.deleteMany();
  await prisma.episodeCharacter.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.character.deleteMany();

  const createdCharacters = await Promise.all(
    characters.map((character) =>
      prisma.character.create({
        data: {
          name: character.name,
          provider: character.provider,
          model: character.model,
          roleArchetype: character.roleArchetype,
          personalityJson: json(character.personalityJson),
          backstory: character.backstory,
          publicGoal: character.publicGoal,
          privateGoal: character.privateGoal,
          secretsJson: json(character.secretsJson),
          speechStyle: character.speechStyle
        }
      })
    )
  );

  const episode = await prisma.episode.create({
    data: {
      title: "雨夜别墅谋杀案",
      format: "jury_deliberation",
      setting:
        "六名陪审员被要求在封闭会议室中讨论一宗发生在雨夜别墅的谋杀案。证据彼此矛盾，证人证词摇摆，监控出现三分钟黑屏。所有人必须在午夜前给出裁决。",
      publicFactsJson: json(publicFacts),
      hiddenFactsJson: json([
        {
          visibleToCharacterName: "砂夜",
          fact: "砂夜注意到监控黑屏的时间过于精确，像是人为设置。"
        },
        {
          visibleToCharacterName: "雾岛莲",
          fact: "雾岛莲知道死者在案发前曾写下：不是他，是那个看起来最安静的人。"
        }
      ]),
      rulesJson: json({
        mode: "jury_trial",
        maxRounds: 12,
        maxVoteRounds: 5,
        currentVoteRound: 0,
        allEvidenceVisible: true,
        releasedEvidenceIds: evidence.map((item) => item.id),
        voteOptions: ["guilty", "not_guilty", "undecided"],
        voteOpen: false,
        activeVoteStageId: null,
        voteStartedTurnCount: null,
        voteRounds: [],
        evidence,
        turnOrder: "round_robin",
        allowPrivateThought: true,
        allowSecretReveal: true,
        endCondition: "max_rounds_or_budget"
      }),
      budgetUsd: 3,
      maxRounds: 12,
      status: "active"
    }
  });

  await Promise.all(
    createdCharacters.map((character) =>
      prisma.episodeCharacter.create({
        data: {
          episodeId: episode.id,
          characterId: character.id,
          roleInEpisode: character.roleArchetype
        }
      })
    )
  );

  await Promise.all(
    publicFacts.map((fact) =>
      prisma.sharedBoardItem.create({
        data: {
          episodeId: episode.id,
          type: "public_fact",
          content: fact,
          source: "seed",
          confidence: 1,
          tagsJson: json(["seed"])
        }
      })
    )
  );

  await Promise.all(
    evidence.map((item) =>
      prisma.sharedBoardItem.create({
        data: {
          episodeId: episode.id,
          type: "clue",
          content: formatEvidenceForBoard(item),
          source: `episode_evidence:${item.id}`,
          confidence: 1,
          tagsJson: json(["episode_evidence", item.id])
        }
      })
    )
  );

  await Promise.all(
    createdCharacters.map((character) =>
      prisma.memory.create({
        data: {
          characterId: character.id,
          episodeId: episode.id,
          type: "persona",
          content: `${character.name}进入陪审讨论时，会优先按照自己的目标和说话风格行动。`,
          visibility: "private",
          importance: 0.7
        }
      })
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
