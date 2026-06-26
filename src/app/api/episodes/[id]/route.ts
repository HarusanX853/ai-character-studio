import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { episodeSchema } from "@/lib/schemas/episode";
import { syncPublicFactsBoardItems } from "@/lib/shared-board/sync-public-facts-board";
import { toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const episode = await prisma.episode.findUnique({
    where: { id },
    include: { characters: { include: { character: true } } }
  });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json({ episode });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = episodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const episode = await prisma.$transaction(async (tx) => {
    const updatedEpisode = await tx.episode.update({
      where: { id },
      data: {
        title: input.title,
        format: input.format,
        setting: input.setting,
        publicFactsJson: input.publicFactsJson === undefined ? undefined : toInputJson(input.publicFactsJson),
        hiddenFactsJson: input.hiddenFactsJson === undefined ? undefined : toInputJson(input.hiddenFactsJson),
        rulesJson: input.rulesJson === undefined ? undefined : toInputJson(input.rulesJson),
        budgetUsd: input.budgetUsd,
        maxRounds: input.maxRounds,
        status: input.status
      }
    });

    await syncPublicFactsBoardItems(tx, updatedEpisode.id, updatedEpisode.publicFactsJson);
    return updatedEpisode;
  });

  return NextResponse.json({ episode });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await prisma.episode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
