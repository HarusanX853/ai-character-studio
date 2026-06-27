"use client";

import { CheckCircle2, FileText, Loader2, Vote, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TrialRules, TrialVote } from "@/lib/jury/trial-state";

type HostControlPanelProps = {
  episodeId: string;
  rules: TrialRules;
  currentVotes: TrialVote[];
};

type DirectorActionResult = {
  message?: string;
  error?: string;
};

function VoteRows({ votes }: { votes: TrialVote[] }) {
  if (!votes.length) {
    return <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">No votes to display.</p>;
  }

  return (
    <div className="space-y-2">
      {votes.map((vote) => (
        <div key={vote.characterId} className="rounded-md border bg-card p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-medium">{vote.characterName}</span>
            <Badge>{vote.choice ?? "waiting"}</Badge>
            {vote.turnId ? (
              <Badge>
                <CheckCircle2 className="h-3 w-3" />
                submitted
              </Badge>
            ) : null}
          </div>
          {vote.rationale ? <p className="mb-2 text-muted-foreground">{vote.rationale}</p> : null}
          {vote.citedEvidenceIds.length ? (
            <div className="flex flex-wrap gap-1">
              {vote.citedEvidenceIds.map((evidenceId) => (
                <Badge key={evidenceId}>{evidenceId}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function HostControlPanel({ episodeId, rules, currentVotes }: HostControlPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestClosedRound = [...rules.voteRounds].reverse().find((round) => round.status === "closed") ?? null;
  const canStartVote = !rules.voteOpen && rules.currentVoteRound < rules.maxVoteRounds;

  async function postDirectorAction(label: string, body: Record<string, unknown>) {
    setLoading(label);
    setMessage(null);

    const response = await fetch(`/api/episodes/${episodeId}/director-action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = (await response.json().catch(() => ({}))) as DirectorActionResult;

    setLoading(null);
    setMessage(response.ok ? result.message ?? `${label} complete` : result.error ?? `${label} failed`);
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Host Control</h2>
          <p className="text-xs text-muted-foreground">Evidence is visible from the start. Run up to five vote rounds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{rules.mode}</Badge>
          <Badge>
            Vote {rules.currentVoteRound}/{rules.maxVoteRounds}
          </Badge>
          <Badge>{rules.voteOpen ? "vote open" : "vote closed"}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={loading !== null || !canStartVote}
          onClick={() => void postDirectorAction("Start Vote Round", { action: "start_vote" })}
        >
          {loading === "Start Vote Round" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Vote className="h-4 w-4" />}
          {loading === "Start Vote Round" ? "Starting..." : "Start Vote Round"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading !== null || !rules.voteOpen}
          onClick={() => void postDirectorAction("Close Vote Round", { action: "close_vote" })}
        >
          {loading === "Close Vote Round" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          {loading === "Close Vote Round" ? "Closing..." : "Close Vote Round"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{rules.voteOpen ? "Current Vote" : "Latest Vote Result"}</h3>
        </div>
        <VoteRows votes={rules.voteOpen ? currentVotes : latestClosedRound?.votes ?? []} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Evidence Catalog</h3>
        </div>
        {rules.evidence.length ? (
          <div className="space-y-2">
            {rules.evidence.map((evidence) => (
              <article key={evidence.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>{evidence.id}</Badge>
                  <span className="font-medium">{evidence.title}</span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{evidence.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">No evidence configured.</p>
        )}
      </div>

      {message ? <pre className="max-h-32 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{message}</pre> : null}
    </div>
  );
}
