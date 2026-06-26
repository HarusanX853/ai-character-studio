"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type EpisodeCardProps = {
  episode: {
    id: string;
    title: string;
    format: string;
    setting: string;
    status: string;
    budgetUsd: number;
    maxRounds: number;
    _count?: {
      characters: number;
      turns: number;
    };
  };
};

export function EpisodeCard({ episode }: EpisodeCardProps) {
  const router = useRouter();

  async function deleteEpisode() {
    if (!confirm(`Delete ${episode.title}?`)) {
      return;
    }

    await fetch(`/api/episodes/${episode.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{episode.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{episode.setting}</p>
        </div>
        <Badge>{episode.status}</Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge>{episode.format}</Badge>
        <Badge>{episode._count?.characters ?? 0} characters</Badge>
        <Badge>{episode._count?.turns ?? 0} turns</Badge>
        <Badge>${episode.budgetUsd.toFixed(2)} budget</Badge>
        <Badge>{episode.maxRounds} rounds</Badge>
      </div>
      <div className="flex gap-2">
        <Link href={`/episodes/${episode.id}/live`} className="inline-flex">
          <Button type="button" size="sm">
            <Radio className="h-4 w-4" />
            Live
          </Button>
        </Link>
        <Link href={`/episodes/${episode.id}`} className="inline-flex">
          <Button type="button" variant="secondary" size="sm">
            Edit
          </Button>
        </Link>
        <Button type="button" variant="danger" size="sm" onClick={deleteEpisode}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </Panel>
  );
}
