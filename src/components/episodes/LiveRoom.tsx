import { AddCharacterToEpisodeDialog } from "./AddCharacterToEpisodeDialog";
import { EpisodeControls } from "./EpisodeControls";
import { HostControlPanel } from "./HostControlPanel";
import { SharedBoardView, type SharedBoardRow } from "./SharedBoardView";
import { TranscriptView, type TranscriptTurn } from "./TranscriptView";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { normalizeTrialRules } from "@/lib/jury/trial-state";
import { collectVotes } from "@/lib/jury/voting";

type LiveRoomProps = {
  episode: {
    id: string;
    title: string;
    format: string;
    status: string;
    budgetUsd: number;
    maxRounds: number;
    rulesJson: unknown;
    caseFactsAvailable: boolean;
  };
  participants: Array<{
    character: {
      id: string;
      name: string;
      displayName: string | null;
      provider: string;
      model: string;
      roleArchetype: string | null;
    };
    latestOpinion: {
      id: string;
      roundIndex: number;
      summary: string;
      verdict: string;
      guiltyProbability: number | null;
      keyEvidence: string | null;
      influentialArgument: string | null;
      rationale: string | null;
      createdAt: Date;
    } | null;
  }>;
  availableCharacters: Array<{
    id: string;
    name: string;
    displayName: string | null;
    roleArchetype: string | null;
  }>;
  turns: TranscriptTurn[];
  sharedBoard: SharedBoardRow[];
  hostMessages: Array<{
    id: string;
    kind: string;
    content: string;
    createdAt: string;
  }>;
  memories: Array<{
    id: string;
    content: string;
    character: { name: string; displayName: string | null };
  }>;
  cost: {
    spentUsd: number;
    tokensInput: number;
    tokensOutput: number;
  };
};

function verdictLabel(verdict: string) {
  if (verdict === "guilty") {
    return "倾向有罪";
  }
  if (verdict === "not_guilty") {
    return "倾向无罪";
  }
  return "尚未确定";
}

export function LiveRoom({
  episode,
  participants,
  availableCharacters,
  turns,
  sharedBoard,
  hostMessages,
  memories,
  cost
}: LiveRoomProps) {
  const currentRound = participants.length ? Math.floor(turns.length / participants.length) + 1 : 1;
  const remainingBudget = Math.max(0, episode.budgetUsd - cost.spentUsd);
  const trialRules = normalizeTrialRules(episode.rulesJson);
  const voteTurns = trialRules.voteOpen ? turns.slice(trialRules.voteStartedTurnCount ?? 0) : [];
  const currentVotes = collectVotes(
    participants.map((participant) => ({
      characterId: participant.character.id,
      characterName: participant.character.displayName ?? participant.character.name
    })),
    voteTurns.map((turn) => ({
      id: turn.id,
      speakerCharacterId: turn.speakerCharacterId,
      outputJson: turn.outputJson
    }))
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr_360px]">
      <div className="space-y-4">
        <Panel className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold">{episode.title}</h1>
            <p className="text-sm text-muted-foreground">{episode.format}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Badge>{episode.status}</Badge>
            <Badge>Round {currentRound}</Badge>
            <Badge>${cost.spentUsd.toFixed(4)} spent</Badge>
            <Badge>${remainingBudget.toFixed(4)} left</Badge>
          </div>
        </Panel>
        <Panel className="space-y-3">
          <h2 className="font-semibold">Participants</h2>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={participant.character.id} className="rounded-md border p-3">
                <div className="font-medium">{participant.character.displayName ?? participant.character.name}</div>
                <div className="text-xs text-muted-foreground">{participant.character.roleArchetype}</div>
                <Badge className="mt-2">
                  {participant.character.provider}/{participant.character.model}
                </Badge>
                {participant.latestOpinion ? (
                  <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>主持人可见</Badge>
                      <Badge>{verdictLabel(participant.latestOpinion.verdict)}</Badge>
                      {participant.latestOpinion.guiltyProbability !== null ? (
                        <span className="text-xs text-muted-foreground">
                          有罪概率 {participant.latestOpinion.guiltyProbability.toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap leading-6">{participant.latestOpinion.summary}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>最在意证据：{participant.latestOpinion.keyEvidence ?? "未说明"}</p>
                      <p>影响最大论点：{participant.latestOpinion.influentialArgument ?? "未说明"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">尚无独立意见。</p>
                )}
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="space-y-3">
          <h2 className="font-semibold">Add Character</h2>
          <AddCharacterToEpisodeDialog episodeId={episode.id} characters={availableCharacters} />
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel>
          <HostControlPanel
            episodeId={episode.id}
            rules={trialRules}
            caseFactsAvailable={episode.caseFactsAvailable}
            currentVotes={currentVotes}
            hostMessages={hostMessages}
          />
        </Panel>
        <Panel>
          <EpisodeControls
            episodeId={episode.id}
            participants={participants.map((participant) => ({
              id: participant.character.id,
              name: participant.character.displayName ?? participant.character.name,
              provider: participant.character.provider,
              model: participant.character.model
            }))}
          />
        </Panel>
        <Panel className="space-y-3">
          <h2 className="font-semibold">公开讨论</h2>
          <TranscriptView turns={turns} />
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel className="space-y-3">
          <h2 className="font-semibold">Shared Board</h2>
          <SharedBoardView items={sharedBoard} />
        </Panel>
        <Panel className="space-y-3">
          <h2 className="font-semibold">Recent Memories</h2>
          <div className="space-y-2">
            {memories.map((memory) => (
              <div key={memory.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 text-xs text-muted-foreground">
                  {memory.character.displayName ?? memory.character.name}
                </div>
                {memory.content}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
