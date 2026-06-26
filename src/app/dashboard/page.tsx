import Link from "next/link";
import { ArrowRight, Clapperboard, Coins, MessageSquareText, UsersRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { PageShell, Panel } from "@/components/ui/panel";

export default async function DashboardPage() {
  const [characterCount, episodeCount, turnCount, turnTotals, recentTurns, recentEpisodes] = await Promise.all([
    prisma.character.count(),
    prisma.episode.count(),
    prisma.turn.count(),
    prisma.turn.aggregate({
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        estimatedCost: true
      }
    }),
    prisma.turn.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        speaker: true,
        episode: { select: { id: true, title: true } }
      }
    }),
    prisma.episode.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { _count: { select: { characters: true, turns: true } } }
    })
  ]);

  const tokens = (turnTotals._sum.tokensInput ?? 0) + (turnTotals._sum.tokensOutput ?? 0);
  const cost = turnTotals._sum.estimatedCost ?? 0;

  const stats = [
    { label: "Characters", value: characterCount, icon: UsersRound },
    { label: "Episodes", value: episodeCount, icon: Clapperboard },
    { label: "Turns", value: turnCount, icon: MessageSquareText },
    { label: "Tokens", value: tokens, icon: Coins },
    { label: "Estimated Cost", value: `$${cost.toFixed(6)}`, icon: Coins }
  ];

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Operational snapshot for characters, episodes, turns, and spend.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Panel key={stat.label} className="space-y-3">
              <Icon className="h-5 w-5 text-primary" />
              <div className="text-2xl font-semibold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Panel>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Turns</h2>
            <Link href="/episodes" className="flex items-center gap-1 text-sm text-primary">
              Episodes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentTurns.map((turn) => (
              <div key={turn.id} className="rounded-md border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge>R{turn.roundIndex}</Badge>
                  <span className="text-sm font-medium">{turn.speaker.displayName ?? turn.speaker.name}</span>
                  <Link href={`/episodes/${turn.episode.id}/live`} className="text-xs text-primary">
                    {turn.episode.title}
                  </Link>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{turn.speech}</p>
              </div>
            ))}
            {!recentTurns.length ? <p className="text-sm text-muted-foreground">No generated turns yet.</p> : null}
          </div>
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Episodes</h2>
            <Link href="/episodes/new" className="text-sm text-primary">
              New Episode
            </Link>
          </div>
          <div className="space-y-3">
            {recentEpisodes.map((episode) => (
              <Link key={episode.id} href={`/episodes/${episode.id}/live`} className="block rounded-md border p-3 hover:bg-muted">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{episode.title}</span>
                  <Badge>{episode.status}</Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{episode._count.characters} characters</span>
                  <span>{episode._count.turns} turns</span>
                  <span>{episode.format}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
