import { notFound } from "next/navigation";
import { LiveRoom } from "@/components/episodes/LiveRoom";
import { PageShell } from "@/components/ui/panel";
import { prisma } from "@/lib/db/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function EpisodeLivePage({ params }: PageProps) {
  const { id } = await params;
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      },
      turns: {
        orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
        include: {
          speaker: {
            select: { name: true, displayName: true }
          }
        }
      },
      sharedBoard: {
        orderBy: { createdAt: "desc" },
        include: {
          introducedByCharacter: {
            select: { name: true, displayName: true }
          }
        }
      },
      memories: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          character: {
            select: { name: true, displayName: true }
          }
        }
      }
    }
  });

  if (!episode) {
    notFound();
  }

  const participantIds = episode.characters.map((entry) => entry.characterId);
  const availableCharacters = await prisma.character.findMany({
    where: { id: { notIn: participantIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, displayName: true, roleArchetype: true }
  });
  const totals = await prisma.turn.aggregate({
    where: { episodeId: episode.id },
    _sum: { estimatedCost: true, tokensInput: true, tokensOutput: true }
  });

  return (
    <PageShell className="max-w-none">
      <LiveRoom
        episode={{
          id: episode.id,
          title: episode.title,
          format: episode.format,
          status: episode.status,
          budgetUsd: episode.budgetUsd,
          maxRounds: episode.maxRounds,
          rulesJson: episode.rulesJson
        }}
        participants={episode.characters.map((entry) => ({
          character: {
            id: entry.character.id,
            name: entry.character.name,
            displayName: entry.character.displayName,
            provider: entry.character.provider,
            model: entry.character.model,
            roleArchetype: entry.character.roleArchetype
          }
        }))}
        availableCharacters={availableCharacters}
        turns={episode.turns.map((turn) => ({
          id: turn.id,
          roundIndex: turn.roundIndex,
          speech: turn.speech,
          action: turn.action,
          emotion: turn.emotion,
          intent: turn.intent,
          innerThought: turn.innerThought,
          tokensInput: turn.tokensInput,
          tokensOutput: turn.tokensOutput,
          estimatedCost: turn.estimatedCost,
          speaker: turn.speaker
        }))}
        sharedBoard={episode.sharedBoard.map((item) => ({
          id: item.id,
          type: item.type,
          content: item.content,
          confidence: item.confidence,
          source: item.source,
          introducedByCharacter: item.introducedByCharacter
        }))}
        memories={episode.memories.map((memory) => ({
          id: memory.id,
          content: memory.content,
          character: memory.character
        }))}
        cost={{
          spentUsd: totals._sum.estimatedCost ?? 0,
          tokensInput: totals._sum.tokensInput ?? 0,
          tokensOutput: totals._sum.tokensOutput ?? 0
        }}
      />
    </PageShell>
  );
}
