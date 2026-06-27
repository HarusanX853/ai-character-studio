import { Badge } from "@/components/ui/badge";

export type SharedBoardRow = {
  id: string;
  type: string;
  content: string;
  confidence: number;
  source: string | null;
  introducedByCharacter: {
    name: string;
    displayName: string | null;
  } | null;
};

export function SharedBoardView({ items }: { items: SharedBoardRow[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No shared board items yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>{item.type}</Badge>
            <span className="text-xs text-muted-foreground">confidence {item.confidence.toFixed(2)}</span>
            {item.introducedByCharacter ? (
              <span className="text-xs text-muted-foreground">
                by {item.introducedByCharacter.displayName ?? item.introducedByCharacter.name}
              </span>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-sm">{item.content}</p>
        </div>
      ))}
    </div>
  );
}
