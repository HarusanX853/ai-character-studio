"use client";

import { Download, FastForward, FileText, Gauge, Loader2, Play, RefreshCw, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ActionResult = {
  error?: string;
  code?: string;
  summary?: string;
};

type PostActionOptions = {
  confirmMessage?: string;
};

type StreamEvent =
  | {
      type: "thinking";
      speakerName: string;
      provider: string;
      model: string;
      roundIndex: number;
    }
  | {
      type: "status";
      message: string;
    }
  | {
      type: "chunk";
      text: string;
    }
  | {
      type: "complete";
      summary: string;
      turnId: string;
    }
  | {
      type: "error";
      message: string;
      code: string;
    };

type StreamingTurn = {
  speakerName: string;
  provider: string;
  model: string;
  roundIndex: number;
  status: string;
  speech: string;
  complete: boolean;
  startedAt: number;
  serverStatusReceived: boolean;
};

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
    </span>
  );
}

type NextSpeakerPreview = {
  name: string;
  provider: string;
  model: string;
  roundIndex: number;
} | null;

export function EpisodeControls({ episodeId, nextSpeaker }: { episodeId: string; nextSpeaker: NextSpeakerPreview }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [streamingTurn, setStreamingTurn] = useState<StreamingTurn | null>(null);

  useEffect(() => {
    if (loading !== "Run Next Turn" || !streamingTurn || streamingTurn.complete || streamingTurn.serverStatusReceived) {
      return;
    }

    const interval = window.setInterval(() => {
      setStreamingTurn((current) => {
        if (!current || current.complete || current.serverStatusReceived) {
          return current;
        }

        const elapsedSeconds = Math.max(1, Math.round((Date.now() - current.startedAt) / 1000));
        return {
          ...current,
          status: `${current.speakerName} 正在连接生成流... ${elapsedSeconds}s`
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, streamingTurn]);

  async function postAction(path: string, label: string, body?: unknown, options?: PostActionOptions) {
    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) {
      return;
    }

    setLoading(label);
    setMessage(`${label} is running...`);

    try {
      const response = await fetch(`/api/episodes/${episodeId}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const result = (await response.json().catch(() => ({}))) as ActionResult;

      if (!response.ok) {
        const suffix = result.code ? ` (${result.code})` : "";
        setMessage(`${result.error ?? `${label} failed`}${suffix}`);
        return;
      }

      setMessage(result.summary ?? `${label} complete`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    } finally {
      setLoading(null);
    }
  }

  function handleStreamEvent(event: StreamEvent) {
    if (event.type === "thinking") {
      setStreamingTurn({
        speakerName: event.speakerName,
        provider: event.provider,
        model: event.model,
        roundIndex: event.roundIndex,
        status: `${event.speakerName} 正在思考...`,
        speech: "",
        complete: false,
        startedAt: Date.now(),
        serverStatusReceived: true
      });
      return;
    }

    if (event.type === "status") {
      setStreamingTurn((current) => (current ? { ...current, status: event.message, serverStatusReceived: true } : current));
      return;
    }

    if (event.type === "chunk") {
      setStreamingTurn((current) =>
        current
          ? {
              ...current,
              status: `${current.speakerName} 正在发言...`,
              speech: `${current.speech}${event.text}`,
              serverStatusReceived: true
            }
          : current
      );
      return;
    }

    if (event.type === "complete") {
      setStreamingTurn((current) => (current ? { ...current, status: "本轮完成", complete: true } : current));
      setMessage(event.summary);
      router.refresh();
      return;
    }

    setStreamingTurn((current) => (current ? { ...current, status: event.message, complete: true } : current));
    setMessage(`${event.message} (${event.code})`);
  }

  async function runNextTurnStream() {
    setLoading("Run Next Turn");
    setMessage(null);
    setStreamingTurn(
      nextSpeaker
        ? {
            speakerName: nextSpeaker.name,
            provider: nextSpeaker.provider,
            model: nextSpeaker.model,
            roundIndex: nextSpeaker.roundIndex,
            status: `${nextSpeaker.name} 正在连接生成流...`,
            speech: "",
            complete: false,
            startedAt: Date.now(),
            serverStatusReceived: false
          }
        : {
            speakerName: "Next speaker",
            provider: "loading",
            model: "loading",
            roundIndex: 1,
            status: "正在连接生成流...",
            speech: "",
            complete: false,
            startedAt: Date.now(),
            serverStatusReceived: false
          }
    );

    try {
      const response = await fetch(`/api/episodes/${episodeId}/run-next-turn-stream`, {
        method: "POST",
        headers: { "content-type": "application/json" }
      });

      if (!response.body) {
        await postAction("run-next-turn", "Run Next Turn");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          handleStreamEvent(JSON.parse(line) as StreamEvent);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        handleStreamEvent(JSON.parse(buffer) as StreamEvent);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run Next Turn failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void runNextTurnStream()} disabled={loading !== null}>
          {loading === "Run Next Turn" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading === "Run Next Turn" ? "Running..." : "Run Next Turn"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => postAction("run-round", "Run Full Round")} disabled={loading !== null}>
          {loading === "Run Full Round" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
          {loading === "Run Full Round" ? "Running round..." : "Run Full Round"}
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
                "Restart live? This will clear the transcript, generated memories, runtime board items, checkpoints, and LLM cost records for this episode."
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
      {streamingTurn ? (
        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>Round {streamingTurn.roundIndex}</Badge>
            <span className="font-medium">{streamingTurn.speakerName}</span>
            <Badge>
              {streamingTurn.provider}/{streamingTurn.model}
            </Badge>
            {!streamingTurn.complete ? <ThinkingDots /> : null}
          </div>
          <div className="mb-2 text-xs text-muted-foreground">{streamingTurn.status}</div>
          {streamingTurn.speech ? <p className="whitespace-pre-wrap leading-6">{streamingTurn.speech}</p> : null}
        </div>
      ) : null}
      {message ? <pre className="max-h-52 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{message}</pre> : null}
    </div>
  );
}
