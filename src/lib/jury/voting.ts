import type { TrialVote } from "./trial-state";
import { asRecord, asStringArray } from "@/lib/utils/json";

export type VoteParticipant = {
  characterId: string;
  characterName: string;
};

export type VoteTurnSource = {
  id: string;
  speakerCharacterId: string;
  outputJson: unknown;
};

export type TurnVoteMetadata = {
  voteChoice: string | null;
  voteRationale: string | null;
  citedEvidenceIds: string[];
};

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getTurnVoteMetadata(outputJson: unknown): TurnVoteMetadata {
  const record = asRecord(outputJson);
  return {
    voteChoice: readString(record, "vote_choice"),
    voteRationale: readString(record, "vote_rationale"),
    citedEvidenceIds: asStringArray(record.cited_evidence_ids).map((id) => id.trim()).filter(Boolean)
  };
}

export function collectVotes(participants: VoteParticipant[], turns: VoteTurnSource[]): TrialVote[] {
  return participants.map((participant) => {
    const latestVoteTurn = [...turns].reverse().find((turn) => {
      if (turn.speakerCharacterId !== participant.characterId) {
        return false;
      }

      return Boolean(getTurnVoteMetadata(turn.outputJson).voteChoice);
    });

    if (!latestVoteTurn) {
      return {
        characterId: participant.characterId,
        characterName: participant.characterName,
        choice: null,
        rationale: null,
        citedEvidenceIds: [],
        turnId: null
      };
    }

    const metadata = getTurnVoteMetadata(latestVoteTurn.outputJson);
    return {
      characterId: participant.characterId,
      characterName: participant.characterName,
      choice: metadata.voteChoice,
      rationale: metadata.voteRationale,
      citedEvidenceIds: metadata.citedEvidenceIds,
      turnId: latestVoteTurn.id
    };
  });
}

export function formatVoteEvidenceContent(round: number, maxRounds: number, votes: TrialVote[]) {
  const lines = votes.map((vote) => {
    const choice = vote.choice ?? "未投票";
    const cited = vote.citedEvidenceIds.length ? `；引用证据: ${vote.citedEvidenceIds.join(", ")}` : "";
    const rationale = vote.rationale ? `；理由: ${vote.rationale}` : "";
    return `- ${vote.characterName}: ${choice}${rationale}${cited}`;
  });

  return [`第 ${round}/${maxRounds} 轮投票结果`, ...lines].join("\n");
}
