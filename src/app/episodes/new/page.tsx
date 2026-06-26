import { EpisodeForm } from "@/components/episodes/EpisodeForm";
import { PageShell, Panel } from "@/components/ui/panel";

export default function NewEpisodePage() {
  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Episode</h1>
        <p className="text-sm text-muted-foreground">Create a controlled scene for character agents to play through.</p>
      </div>
      <Panel>
        <EpisodeForm />
      </Panel>
    </PageShell>
  );
}
