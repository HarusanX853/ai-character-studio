import Link from "next/link";
import { Radio } from "lucide-react";
import { notFound } from "next/navigation";
import { EpisodeForm } from "@/components/episodes/EpisodeForm";
import { Button } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { prisma } from "@/lib/db/prisma";
import { stringifyJson } from "@/lib/utils/json";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EpisodeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: {
      characters: {
        include: { character: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!episode) {
    notFound();
  }

  return (
    <PageShell className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{episode.title}</h1>
          <p className="text-sm text-muted-foreground">{episode.format}</p>
        </div>
        <Link href={`/episodes/${episode.id}/live`} className="inline-flex">
          <Button type="button">
            <Radio className="h-4 w-4" />
            Open Live Room
          </Button>
        </Link>
      </div>
      <Panel>
        <EpisodeForm
          episodeId={episode.id}
          initialValues={{
            title: episode.title,
            format: episode.format,
            setting: episode.setting,
            publicFactsJson: stringifyJson(episode.publicFactsJson ?? []),
            hiddenFactsJson: stringifyJson(episode.hiddenFactsJson ?? []),
            rulesJson: stringifyJson(episode.rulesJson ?? {}),
            budgetUsd: episode.budgetUsd,
            maxRounds: episode.maxRounds,
            status: episode.status
          }}
        />
      </Panel>
      <Panel className="space-y-3">
        <h2 className="font-semibold">Participants</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {episode.characters.map((entry) => (
            <div key={entry.id} className="rounded-md border p-3 text-sm">
              <div className="font-medium">{entry.character.displayName ?? entry.character.name}</div>
              <div className="text-muted-foreground">{entry.roleInEpisode ?? entry.character.roleArchetype}</div>
            </div>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}
