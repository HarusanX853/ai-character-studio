import { prisma } from "@/lib/db/prisma";

export async function summarizeEpisode(episodeId: string) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      turns: {
        orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
        include: { speaker: true }
      },
      sharedBoard: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!episode) {
    throw new Error("Episode not found");
  }

  const lines = [
    `# ${episode.title} Summary`,
    "",
    `Format: ${episode.format}`,
    `Status: ${episode.status}`,
    `Turns: ${episode.turns.length}`,
    "",
    "## Key Shared Board Items",
    ...episode.sharedBoard.slice(-10).map((item) => `- [${item.type}] ${item.content}`),
    "",
    "## Recent Turns",
    ...episode.turns.slice(-10).map((turn) => `- R${turn.roundIndex} ${turn.speaker.displayName ?? turn.speaker.name}: ${turn.speech}`)
  ];

  return lines.join("\n");
}
