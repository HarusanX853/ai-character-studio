import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { episodeCharacterSchema } from "@/lib/schemas/episode";
import { toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = episodeCharacterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.episodeCharacter.upsert({
    where: {
      episodeId_characterId: {
        episodeId: id,
        characterId: parsed.data.characterId
      }
    },
    update: {
      roleInEpisode: parsed.data.roleInEpisode,
      hiddenFactsJson: parsed.data.hiddenFactsJson === undefined ? undefined : toInputJson(parsed.data.hiddenFactsJson)
    },
    create: {
      episodeId: id,
      characterId: parsed.data.characterId,
      roleInEpisode: parsed.data.roleInEpisode,
      hiddenFactsJson: parsed.data.hiddenFactsJson === undefined ? undefined : toInputJson(parsed.data.hiddenFactsJson)
    }
  });

  return NextResponse.json({ entry }, { status: 201 });
}
