import Link from "next/link";
import { Plus } from "lucide-react";
import { CharacterCard } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/panel";
import { prisma } from "@/lib/db/prisma";

export default async function CharactersPage() {
  const characters = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memories: true, episodes: true } } }
  });

  return (
    <PageShell className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Characters</h1>
          <p className="text-sm text-muted-foreground">Character agents with provider bindings, goals, secrets, and memory.</p>
        </div>
        <Link href="/characters/new" className="inline-flex">
          <Button type="button">
            <Plus className="h-4 w-4" />
            New Character
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => (
          <CharacterCard key={character.id} character={character} />
        ))}
      </div>
    </PageShell>
  );
}
