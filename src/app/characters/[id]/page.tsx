import { notFound } from "next/navigation";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { MemoryList } from "@/components/characters/MemoryList";
import { PageShell, Panel } from "@/components/ui/panel";
import { prisma } from "@/lib/db/prisma";
import { stringifyJson } from "@/lib/utils/json";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ editMemory?: string; formError?: string }>;
};

export default async function CharacterDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      memories: {
        orderBy: { createdAt: "desc" },
        take: 30
      }
    }
  });

  if (!character) {
    notFound();
  }

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{character.displayName ?? character.name}</h1>
        <p className="text-sm text-muted-foreground">{character.provider}/{character.model}</p>
      </div>
      <Panel>
        <CharacterForm
          characterId={character.id}
          message={resolvedSearchParams?.formError}
          initialValues={{
            name: character.name,
            displayName: character.displayName ?? "",
            avatarUrl: character.avatarUrl ?? "",
            provider: character.provider,
            model: character.model,
            roleArchetype: character.roleArchetype ?? "",
            personalityJson: stringifyJson(character.personalityJson),
            backstory: character.backstory,
            publicGoal: character.publicGoal ?? "",
            privateGoal: character.privateGoal ?? "",
            secretsJson: stringifyJson(character.secretsJson ?? []),
            speechStyle: character.speechStyle ?? "",
            costPolicyJson: stringifyJson(character.costPolicyJson ?? {})
          }}
        />
      </Panel>
      <Panel className="space-y-4">
        <h2 className="font-semibold">Memories</h2>
        <MemoryList
          characterId={character.id}
          editingMemoryId={resolvedSearchParams?.editMemory}
          memories={character.memories.map((memory) => ({
            id: memory.id,
            type: memory.type,
            content: memory.content,
            visibility: memory.visibility,
            importance: memory.importance,
            createdAt: memory.createdAt.toISOString()
          }))}
        />
      </Panel>
    </PageShell>
  );
}
