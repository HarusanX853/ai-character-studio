"use client";

import { CheckCircle2, ChevronRight, Eye, ListChecks, Vote, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  getCurrentStage,
  getEvidenceForStage,
  isEvidenceReleased,
  type TrialEvidence,
  type TrialRules
} from "@/lib/jury/trial-state";

type HostControlPanelProps = {
  episodeId: string;
  rules: TrialRules;
};

type DirectorActionResult = {
  message?: string;
  error?: string;
};

export function HostControlPanel({ episodeId, rules }: HostControlPanelProps) {
  const router = useRouter();
  const currentStage = getCurrentStage(rules);
  const stageEvidence = getEvidenceForStage(rules, currentStage);
  const [selectedStageId, setSelectedStageId] = useState(currentStage?.id ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedStageId(currentStage?.id ?? "");
  }, [currentStage?.id]);

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

  function EvidenceRow({ evidence }: { evidence: TrialEvidence }) {
    const released = isEvidenceReleased(rules, evidence.id);

    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{evidence.id}</Badge>
            {released ? (
              <Badge>
                <CheckCircle2 className="h-3 w-3" />
                released
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 truncate text-sm font-medium">{evidence.title}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={released ? "ghost" : "secondary"}
          disabled={loading !== null || released}
          onClick={() => void postDirectorAction(`Release ${evidence.id}`, { action: "release_evidence", evidenceId: evidence.id })}
        >
          <Eye className="h-4 w-4" />
          Release
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Host Control</h2>
          <p className="text-xs text-muted-foreground">{currentStage ? currentStage.title : "No stage selected"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{rules.mode}</Badge>
          <Badge>{rules.voteOpen ? "vote open" : "vote closed"}</Badge>
        </div>
      </div>

      {rules.stages.length ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <Select value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)}>
            {rules.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.order}. {stage.title}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            disabled={loading !== null || !selectedStageId || selectedStageId === currentStage?.id}
            onClick={() => void postDirectorAction("Set Stage", { action: "set_stage", stageId: selectedStageId })}
          >
            <ListChecks className="h-4 w-4" />
            Set Stage
          </Button>
          <Button
            type="button"
            disabled={loading !== null}
            onClick={() => void postDirectorAction("Advance Stage", { action: "advance_stage" })}
          >
            <ChevronRight className="h-4 w-4" />
            Next Stage
          </Button>
        </div>
      ) : (
        <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">No trial stages configured in rulesJson.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={loading !== null || !stageEvidence.length}
          onClick={() => void postDirectorAction("Release Stage Evidence", { action: "release_stage_evidence" })}
        >
          <Eye className="h-4 w-4" />
          Release Stage Evidence
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading !== null || rules.voteOpen}
          onClick={() => void postDirectorAction("Start Vote", { action: "start_vote" })}
        >
          <Vote className="h-4 w-4" />
          Start Vote
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loading !== null || !rules.voteOpen}
          onClick={() => void postDirectorAction("Close Vote", { action: "close_vote" })}
        >
          <XCircle className="h-4 w-4" />
          Close Vote
        </Button>
      </div>

      {stageEvidence.length ? (
        <div className="space-y-2">
          {stageEvidence.map((evidence) => (
            <EvidenceRow key={evidence.id} evidence={evidence} />
          ))}
        </div>
      ) : null}

      {message ? <pre className="max-h-32 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{message}</pre> : null}
    </div>
  );
}

