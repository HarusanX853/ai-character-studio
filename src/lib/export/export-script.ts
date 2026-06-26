import { prisma } from "@/lib/db/prisma";
import { asStringArray } from "@/lib/utils/json";

export type ExportScriptOptions = {
  includeInnerThought?: boolean;
};

export async function exportEpisodeScript(episodeId: string, options: ExportScriptOptions = {}) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      },
      sharedBoard: {
        orderBy: { createdAt: "asc" }
      },
      turns: {
        orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
        include: { speaker: true }
      }
    }
  });

  if (!episode) {
    throw new Error("Episode not found");
  }

  const lines: string[] = [
    `# ${episode.title}`,
    "",
    `- Episode format: ${episode.format}`,
    `- Status: ${episode.status}`,
    "",
    "## 场景设定",
    episode.setting,
    "",
    "## 参与角色",
    ...episode.characters.map((entry) => {
      const character = entry.character;
      return `- ${character.displayName ?? character.name}: ${character.roleArchetype ?? entry.roleInEpisode ?? "角色"}`;
    }),
    "",
    "## 公开事实",
    ...asStringArray(episode.publicFactsJson).map((fact) => `- ${fact}`),
    "",
    "## 共享情报",
    ...episode.sharedBoard.map((item) => `- [${item.type}] ${item.content}`),
    "",
    "## 正片脚本"
  ];

  let currentRound = 0;
  for (const turn of episode.turns) {
    if (turn.roundIndex !== currentRound) {
      currentRound = turn.roundIndex;
      lines.push("", `### Round ${currentRound}`, "");
    }

    const speaker = turn.speaker.displayName ?? turn.speaker.name;
    const action = turn.action ? `（${turn.action}）` : "";
    lines.push(`**${speaker}**：${action}`, turn.speech, "");
    if (options.includeInnerThought && turn.innerThought) {
      lines.push(`> Inner thought: ${turn.innerThought}`, "");
    }
  }

  return lines.join("\n");
}
