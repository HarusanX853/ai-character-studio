"use client";

import { Download, FileText, Gauge, Loader2, MessageSquareQuote, RefreshCw, RotateCcw, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type ActionResult = {
  error?: string;
  code?: string;
  summary?: string;
};

type PostActionOptions = {
  confirmMessage?: string;
};

type ParticipantOption = {
  id: string;
  name: string;
  provider: string;
  model: string;
};

export function EpisodeControls({
  episodeId,
  participants
}: {
  episodeId: string;
  participants: ParticipantOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState(participants[0]?.id ?? "");

  useEffect(() => {
    if (!selectedCharacterId && participants[0]) {
      setSelectedCharacterId(participants[0].id);
    }
  }, [participants, selectedCharacterId]);

  async function postAction(path: string, label: string, body?: unknown, options?: PostActionOptions) {
    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    setLoading(label);
    setMessage(`${label} 运行中...`);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const result = (await response.json().catch(() => ({}))) as ActionResult;

      if (!response.ok) {
        const suffix = result.code ? ` (${result.code})` : "";
        setMessage(`${result.error ?? `${label} 失败`}${suffix}`);
        return;
      }

      setMessage(result.summary ?? `${label} 完成`);
      if (path === "group-discussion") {
        setGroupOpen(false);
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} 失败`);
    } finally {
      setLoading(null);
    }
  }

  const selectedParticipant = participants.find((participant) => participant.id === selectedCharacterId) ?? participants[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void postAction("independent-opinions", "独立发表意见")}
          disabled={loading !== null || !participants.length}
        >
          {loading === "独立发表意见" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}
          {loading === "独立发表意见" ? "生成中..." : "独立发表意见"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setGroupOpen((value) => !value)} disabled={loading !== null || !participants.length}>
          <MessageSquareQuote className="h-4 w-4" />
          集体讨论
        </Button>
        <Button type="button" variant="secondary" onClick={() => postAction("summarize", "Summarize Episode")} disabled={loading !== null}>
          <FileText className="h-4 w-4" />
          Summarize
        </Button>
        <Button type="button" variant="secondary" onClick={() => postAction("override-budget", "Override Budget", { amountUsd: 3 })} disabled={loading !== null}>
          <Gauge className="h-4 w-4" />
          Override Budget
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() =>
            postAction("restart-live", "Restart Live", undefined, {
              confirmMessage:
                "Restart live? This will clear public discussion, host messages, independent opinions, generated memories, runtime board items, checkpoints, and LLM cost records for this episode."
            })
          }
          disabled={loading !== null}
        >
          {loading === "Restart Live" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {loading === "Restart Live" ? "Restarting..." : "Restart Live"}
        </Button>
        <a href={`/api/episodes/${episodeId}/export-script`} target="_blank" rel="noreferrer" className="inline-flex">
          <Button type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Export Script
          </Button>
        </a>
        <Button type="button" variant="ghost" onClick={() => router.refresh()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {groupOpen ? (
        <div className="rounded-md border bg-card p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>一次选择一个 AI</Badge>
            {selectedParticipant ? (
              <Badge>
                {selectedParticipant.provider}/{selectedParticipant.model}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Select value={selectedCharacterId} onChange={(event) => setSelectedCharacterId(event.target.value)}>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              disabled={loading !== null || !selectedCharacterId}
              onClick={() => void postAction("group-discussion", "集体讨论", { characterId: selectedCharacterId })}
            >
              {loading === "集体讨论" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareQuote className="h-4 w-4" />}
              {loading === "集体讨论" ? "发言中..." : "让该 AI 发言"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">选中的 AI 会根据主持人最新任务公开发言，内容会进入公开讨论记录。</p>
        </div>
      ) : null}

      {message ? <pre className="max-h-52 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{message}</pre> : null}
    </div>
  );
}
