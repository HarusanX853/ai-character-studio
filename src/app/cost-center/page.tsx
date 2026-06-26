import { CostSummary } from "@/components/cost/CostSummary";
import { PageShell } from "@/components/ui/panel";
import { aggregateCostCenter } from "@/lib/cost/aggregate-cost";

export default async function CostCenterPage() {
  const rows = await aggregateCostCenter();

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cost Center</h1>
        <p className="text-sm text-muted-foreground">LLM call aggregation by provider, model, episode, and date.</p>
      </div>
      <CostSummary rows={rows} />
    </PageShell>
  );
}
