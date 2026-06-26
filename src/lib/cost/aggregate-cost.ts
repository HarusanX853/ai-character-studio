import { prisma } from "@/lib/db/prisma";

export async function aggregateCostCenter() {
  const calls = await prisma.llmCall.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      episode: { select: { id: true, title: true } }
    }
  });

  const grouped = new Map<
    string,
    {
      provider: string;
      model: string;
      episode: string;
      date: string;
      tokensInput: number;
      tokensOutput: number;
      estimatedCost: number;
      callCount: number;
      totalLatencyMs: number;
      errors: number;
    }
  >();

  for (const call of calls) {
    const date = call.createdAt.toISOString().slice(0, 10);
    const episode = call.episode?.title ?? "Unassigned";
    const key = `${call.provider}:${call.model}:${episode}:${date}`;
    const existing =
      grouped.get(key) ??
      {
        provider: call.provider,
        model: call.model,
        episode,
        date,
        tokensInput: 0,
        tokensOutput: 0,
        estimatedCost: 0,
        callCount: 0,
        totalLatencyMs: 0,
        errors: 0
      };

    existing.tokensInput += call.tokensInput;
    existing.tokensOutput += call.tokensOutput;
    existing.estimatedCost += call.estimatedCost;
    existing.callCount += 1;
    existing.totalLatencyMs += call.latencyMs;
    existing.errors += call.error ? 1 : 0;
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    averageLatencyMs: item.callCount ? Math.round(item.totalLatencyMs / item.callCount) : 0
  }));
}
