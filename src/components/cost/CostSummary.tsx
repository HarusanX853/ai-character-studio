import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";

type CostSummaryRow = {
  provider: string;
  model: string;
  episode: string;
  date: string;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  callCount: number;
  averageLatencyMs: number;
  errors: number;
};

export function CostSummary({ rows }: { rows: CostSummaryRow[] }) {
  if (!rows.length) {
    return <Panel className="text-sm text-muted-foreground">No LLM calls yet.</Panel>;
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Episode</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Input</th>
            <th className="px-3 py-2">Output</th>
            <th className="px-3 py-2">Cost</th>
            <th className="px-3 py-2">Calls</th>
            <th className="px-3 py-2">Latency</th>
            <th className="px-3 py-2">Errors</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.provider}:${row.model}:${row.episode}:${row.date}`} className="border-b last:border-b-0">
              <td className="px-3 py-2"><Badge>{row.provider}</Badge></td>
              <td className="px-3 py-2">{row.model}</td>
              <td className="px-3 py-2">{row.episode}</td>
              <td className="px-3 py-2">{row.date}</td>
              <td className="px-3 py-2">{row.tokensInput}</td>
              <td className="px-3 py-2">{row.tokensOutput}</td>
              <td className="px-3 py-2">${row.estimatedCost.toFixed(6)}</td>
              <td className="px-3 py-2">{row.callCount}</td>
              <td className="px-3 py-2">{row.averageLatencyMs}ms</td>
              <td className="px-3 py-2">{row.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
