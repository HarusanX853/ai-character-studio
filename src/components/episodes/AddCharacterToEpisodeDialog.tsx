"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type CharacterOption = {
  id: string;
  name: string;
  displayName: string | null;
  roleArchetype: string | null;
};

export function AddCharacterToEpisodeDialog({
  episodeId,
  characters
}: {
  episodeId: string;
  characters: CharacterOption[];
}) {
  const router = useRouter();
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [roleInEpisode, setRoleInEpisode] = useState("");

  async function addCharacter() {
    if (!characterId) {
      return;
    }

    await fetch(`/api/episodes/${episodeId}/characters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId, roleInEpisode })
    });
    router.refresh();
  }

  return (
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
      <Select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.displayName ?? character.name}
          </option>
        ))}
      </Select>
      <Input value={roleInEpisode} onChange={(event) => setRoleInEpisode(event.target.value)} placeholder="Role in episode" />
      <Button type="button" onClick={addCharacter} disabled={!characters.length}>
        <UserPlus className="h-4 w-4" />
        Add Character
      </Button>
    </div>
  );
}
