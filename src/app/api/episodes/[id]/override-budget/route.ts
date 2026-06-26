import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getEpisodeSpentUsd } from "@/lib/cost/enforce-budget";
import { overrideBudgetSchema } from "@/lib/schemas/episode";
import { asRecord, toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = overrideBudgetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const episode = await prisma.episode.findUnique({ where: { id } });
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const spent = await getEpisodeSpentUsd(id);
  const rules = {
    ...asRecord(episode.rulesJson),
    budgetOverride: true,
    budgetOverrideAmountUsd: parsed.data.amountUsd
  };
  const updated = await prisma.episode.update({
    where: { id },
    data: {
      rulesJson: toInputJson(rules),
      budgetUsd: Math.max(episode.budgetUsd, spent + parsed.data.amountUsd)
    }
  });

  return NextResponse.json({ episode: updated });
}
