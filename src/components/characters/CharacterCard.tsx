"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type CharacterCardProps = {
  character: {
    id: string;
    name: string;
    displayName: string | null;
    provider: string;
    model: string;
    roleArchetype: string | null;
    speechStyle: string | null;
    _count?: {
      memories: number;
      episodes: number;
    };
  };
};

export function CharacterCard({ character }: CharacterCardProps) {
  const router = useRouter();

  async function deleteCharacter() {
    if (!confirm(`Delete ${character.displayName ?? character.name}?`)) {
      return;
    }

    await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Panel className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{character.displayName ?? character.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{character.roleArchetype ?? "No archetype"}</p>
        </div>
        <Badge>{character.provider}/{character.model}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{character.speechStyle ?? "No speech style set"}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{character._count?.memories ?? 0} memories</span>
        <span>{character._count?.episodes ?? 0} episodes</span>
      </div>
      <div className="flex gap-2">
        <Link href={`/characters/${character.id}`} className="inline-flex">
          <Button type="button" variant="secondary" size="sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </Link>
        <Button type="button" variant="danger" size="sm" onClick={deleteCharacter}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </Panel>
  );
}
