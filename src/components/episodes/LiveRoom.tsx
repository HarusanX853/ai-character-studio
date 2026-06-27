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
      }>;
  availableCharacters: Array<{
    id: string;
    name: string;
    displayName: string | null;
    roleArchetype: string | null;
  }>;
  turns: TranscriptTurn[];
  sharedBoard: SharedBoardRow[];
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

export function LiveRoom({ episode, participants, availableCharacters, turns, sharedBoard, memories, cost }: LiveRoomProps) {
  const currentRound = participants.length ? Math.floor(turns.length / participants.length) + 1 : 1;
  const remainingBudget = Math.max(0, episode.budgetUsd - cost.spentUsd);
  const trialRules = normalizeTrialRules(episode.rulesJson);
  const nextParticipant = participants.length ? participants[turns.length % participants.length] : null;
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
          <HostControlPanel episodeId={episode.id} rules={trialRules} currentVotes={currentVotes} />
        </Panel>
        <Panel>
          <EpisodeControls
            episodeId={episode.id}
            nextSpeaker={
              nextParticipant
                ? {
                    name: nextParticipant.character.displayName ?? nextParticipant.character.name,
                    provider: nextParticipant.character.provider,
                    model: nextParticipant.character.model,
                    roundIndex: currentRound
                  }
                : null
            }
          />
        </Panel>
        <Panel className="space-y-3">
          <h2 className="font-semibold">Transcript</h2>
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
