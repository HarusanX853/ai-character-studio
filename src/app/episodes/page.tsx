import Link from "next/link";
import { Plus } from "lucide-react";
import { EpisodeCard } from "@/components/episodes/EpisodeCard";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/panel";
import { prisma } from "@/lib/db/prisma";

export default async function EpisodesPage() {
  const episodes = await prisma.episode.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { characters: true, turns: true } } }
  });

  return (
    <PageShell className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Episodes</h1>
          <p className="text-sm text-muted-foreground">Round-based multi-character scenes with shared board and memory.</p>
        </div>
        <Link href="/episodes/new" className="inline-flex">
          <Button type="button">
            <Plus className="h-4 w-4" />
            New Episode
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {episodes.map((episode) => (
          <EpisodeCard key={episode.id} episode={episode} />
        ))}
      </div>
    </PageShell>
  );
}
