import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ id: string; characterId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, characterId } = await context.params;
  await prisma.episodeCharacter.delete({
    where: {
      episodeId_characterId: {
        episodeId: id,
        characterId
      }
    }
  });

  return NextResponse.json({ ok: true });
}
