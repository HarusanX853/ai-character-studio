import { CharacterForm } from "@/components/characters/CharacterForm";
import { PageShell, Panel } from "@/components/ui/panel";

type PageProps = {
  searchParams?: Promise<{ formError?: string }>;
};

export default async function NewCharacterPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <PageShell className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Character</h1>
        <p className="text-sm text-muted-foreground">Create a character agent, not a generic chatbot.</p>
      </div>
      <Panel>
        <CharacterForm message={resolvedSearchParams?.formError} />
      </Panel>
    </PageShell>
  );
}
