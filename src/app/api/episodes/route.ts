import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { episodeSchema } from "@/lib/schemas/episode";
import { syncEvidenceBoardItems } from "@/lib/shared-board/sync-evidence-board";
import { syncPublicFactsBoardItems } from "@/lib/shared-board/sync-public-facts-board";
import { toInputJson } from "@/lib/utils/json";

export async function GET() {
  const episodes = await prisma.episode.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ episodes });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = episodeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const episode = await prisma.$transaction(async (tx) => {
    const createdEpisode = await tx.episode.create({
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

    await syncPublicFactsBoardItems(tx, createdEpisode.id, input.publicFactsJson);
    await syncEvidenceBoardItems(tx, createdEpisode.id, input.rulesJson);
    return createdEpisode;
  });

  return NextResponse.json({ episode }, { status: 201 });
}
