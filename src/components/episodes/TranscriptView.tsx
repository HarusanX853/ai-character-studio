import { Badge } from "@/components/ui/badge";

export type TranscriptTurn = {
  id: string;
  roundIndex: number;
  speech: string;
  action: string | null;
  emotion: string | null;
  intent: string | null;
  innerThought: string | null;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  speaker: {
    name: string;
    displayName: string | null;
  };
};

export function TranscriptView({ turns }: { turns: TranscriptTurn[] }) {
  if (!turns.length) {
    return <p className="text-sm text-muted-foreground">No turns yet.</p>;
  }

  return (
    <div className="space-y-3">
      {turns.map((turn) => (
        <article key={turn.id} className="rounded-md border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>Round {turn.roundIndex}</Badge>
            <span className="font-semibold">{turn.speaker.displayName ?? turn.speaker.name}</span>
            {turn.emotion ? <Badge>{turn.emotion}</Badge> : null}
            {turn.intent ? <Badge>{turn.intent}</Badge> : null}
          </div>
          {turn.action ? <p className="mb-2 text-sm text-muted-foreground">({turn.action})</p> : null}
          <p className="whitespace-pre-wrap text-sm leading-6">{turn.speech}</p>
          {turn.innerThought ? (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">inner thought</summary>
              <p className="mt-2">{turn.innerThought}</p>
            </details>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>input {turn.tokensInput}</span>
            <span>output {turn.tokensOutput}</span>
            <span>${turn.estimatedCost.toFixed(6)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
