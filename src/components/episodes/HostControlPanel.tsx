"use client";

import { CheckCircle2, ChevronRight, Eye, FileText, ListChecks, Loader2, Send, Vote, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getCurrentStage,
  getEvidenceForStage,
  isEvidenceReleased,
  type TrialEvidence,
  type TrialRules,
  type TrialVote
} from "@/lib/jury/trial-state";

type HostControlPanelProps = {
  episodeId: string;
  rules: TrialRules;
  currentVotes: TrialVote[];
  hostMessages: Array<{
    id: string;
    kind: string;
    content: string;
    createdAt: string;
  }>;
};

type DirectorActionResult = {
  message?: string;
  summary?: string;
  error?: string;
};

function hostKindLabel(kind: string) {
  if (kind === "task") {
    return "任务";
  }
  if (kind === "evidence") {
    return "证据";
  }
  return "消息";
}

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

export function HostControlPanel({ episodeId, rules, currentVotes, hostMessages }: HostControlPanelProps) {
  const router = useRouter();
  const currentStage = getCurrentStage(rules);
  const stageEvidence = getEvidenceForStage(rules, currentStage);
  const [selectedStageId, setSelectedStageId] = useState(currentStage?.id ?? "");
  const [hostMessageKind, setHostMessageKind] = useState("task");
  const [hostMessageContent, setHostMessageContent] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestClosedRound = [...rules.voteRounds].reverse().find((round) => round.status === "closed") ?? null;
  const canStartVote = !rules.voteOpen && rules.currentVoteRound < rules.maxVoteRounds;

  useEffect(() => {
    setSelectedStageId(currentStage?.id ?? "");
  }, [currentStage?.id]);

  async function postDirectorAction(label: string, body: Record<string, unknown>) {
    setLoading(label);
    setMessage(null);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/director-action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = (await response.json().catch(() => ({}))) as DirectorActionResult;

      setMessage(response.ok ? result.message ?? `${label} complete` : result.error ?? `${label} failed`);
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    } finally {
      setLoading(null);
    }
  }

  async function postHostMessage() {
    const content = hostMessageContent.trim();
    if (!content) {
      setMessage("主持人消息不能为空。");
      return;
    }

    setLoading("Host Message");
    setMessage(null);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/host-messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: hostMessageKind,
          content
        })
      });
      const result = (await response.json().catch(() => ({}))) as DirectorActionResult;

      setMessage(response.ok ? result.summary ?? "主持人消息已公开。" : result.error ?? "主持人消息发送失败。");
      if (response.ok) {
        setHostMessageContent("");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "主持人消息发送失败。");
    } finally {
      setLoading(null);
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
          <Badge>
            Vote {rules.currentVoteRound}/{rules.maxVoteRounds}
          </Badge>
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
          {loading === "Release Stage Evidence" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Release Stage Evidence
        </Button>
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

      {stageEvidence.length ? (
        <div className="space-y-2">
          {stageEvidence.map((evidence) => (
            <EvidenceRow key={evidence.id} evidence={evidence} />
          ))}
        </div>
      ) : null}

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
                  {isEvidenceReleased(rules, evidence.id) ? <Badge>released</Badge> : null}
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

      <div className="space-y-3 border-t pt-4">
        <div>
          <h3 className="font-semibold">主持人发言</h3>
          <p className="text-xs text-muted-foreground">发布任务、证据或普通消息；后续 AI 发言都会看到这些内容。</p>
        </div>
        <div className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
          <Select value={hostMessageKind} onChange={(event) => setHostMessageKind(event.target.value)}>
            <option value="task">任务</option>
            <option value="evidence">证据</option>
            <option value="message">消息</option>
          </Select>
          <Textarea
            value={hostMessageContent}
            onChange={(event) => setHostMessageContent(event.target.value)}
            placeholder="例如：请各位根据 E2 和 E3 判断被告是否有罪，并说明最关键的矛盾。"
            className="min-h-20"
          />
          <Button type="button" disabled={loading !== null || !hostMessageContent.trim()} onClick={() => void postHostMessage()}>
            <Send className="h-4 w-4" />
            发送
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-auto rounded-md border bg-muted/30 p-3">
          {hostMessages.length ? (
            hostMessages.map((item) => (
              <div key={item.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>{hostKindLabel(item.kind)}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap leading-6">{item.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">还没有主持人消息。</p>
          )}
        </div>
      </div>
    </div>
  );
}
