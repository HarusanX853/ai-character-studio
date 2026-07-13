export type TrialStage = {
  id: string;
  title: string;
  order: number;
  description?: string;
  evidenceIds: string[];
  requiresVote: boolean;
  discussionPrompt?: string;
};

export type TrialEvidence = {
  id: string;
  title: string;
  content: string;
  prosecutionView?: string;
  defenseView?: string;
  discussionPrompt?: string;
};

export type TrialVote = {
  characterId: string;
  characterName: string;
  choice: string | null;
  rationale: string | null;
  citedEvidenceIds: string[];
  turnId: string | null;
};

export type TrialVoteRound = {
  round: number;
  status: "open" | "closed";
  openedAtTurnCount: number;
  closedAtTurnCount: number | null;
  votes: TrialVote[];
  evidenceId: string | null;
  createdAt: string | null;
  closedAt: string | null;
};

export type TrialRules = Record<string, unknown> & {
  mode: string;
  currentStageId: string | null;
  caseFactsReleased: boolean;
  releasedEvidenceIds: string[];
  allEvidenceVisible: boolean;
  stages: TrialStage[];
  evidence: TrialEvidence[];
  voteOptions: string[];
  voteOpen: boolean;
  activeVoteStageId: string | null;
  maxVoteRounds: number;
  currentVoteRound: number;
  voteStartedTurnCount: number | null;
  voteRounds: TrialVoteRound[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback = false) {
  const value = record[key];
  return typeof value === "boolean" ? value : fallback;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    )
  ];
}

function normalizeStage(value: unknown, index: number): TrialStage {
  const record = asRecord(value);
  const id = readString(record, "id") ?? readString(record, "stageId") ?? `stage_${index + 1}`;
  return {
    id,
    title: readString(record, "title") ?? id,
    order: readNumber(record, "order", index + 1),
    description: readString(record, "description"),
    evidenceIds: uniqueStrings(record.evidenceIds ?? record.evidence_ids),
    requiresVote: readBoolean(record, "requiresVote", readBoolean(record, "requires_vote", false)),
    discussionPrompt: readString(record, "discussionPrompt") ?? readString(record, "discussion_prompt")
  };
}

function normalizeEvidence(value: unknown, index: number): TrialEvidence {
  const record = asRecord(value);
  const id = readString(record, "id") ?? readString(record, "evidenceId") ?? `E${index + 1}`;
  return {
    id,
    title: readString(record, "title") ?? id,
    content: readString(record, "content") ?? "",
    prosecutionView:
      readString(record, "prosecutionView") ??
      readString(record, "prosecution_view") ??
      readString(record, "prosecution"),
    defenseView: readString(record, "defenseView") ?? readString(record, "defense_view") ?? readString(record, "defense"),
    discussionPrompt: readString(record, "discussionPrompt") ?? readString(record, "discussion_prompt")
  };
}

function normalizeVote(value: unknown): TrialVote | null {
  const record = asRecord(value);
  const characterId = readString(record, "characterId") ?? readString(record, "character_id");
  const characterName = readString(record, "characterName") ?? readString(record, "character_name");

  if (!characterId || !characterName) {
    return null;
  }

  return {
    characterId,
    characterName,
    choice: readString(record, "choice") ?? null,
    rationale: readString(record, "rationale") ?? null,
    citedEvidenceIds: uniqueStrings(record.citedEvidenceIds ?? record.cited_evidence_ids),
    turnId: readString(record, "turnId") ?? readString(record, "turn_id") ?? null
  };
}

function normalizeVoteRound(value: unknown): TrialVoteRound | null {
  const record = asRecord(value);
  const round = readNumber(record, "round", 0);

  if (round < 1) {
    return null;
  }

  const rawStatus = readString(record, "status");
  const status = rawStatus === "open" ? "open" : "closed";

  return {
    round,
    status,
    openedAtTurnCount:
      readOptionalNumber(record, "openedAtTurnCount") ??
      readOptionalNumber(record, "opened_at_turn_count") ??
      0,
    closedAtTurnCount:
      readOptionalNumber(record, "closedAtTurnCount") ?? readOptionalNumber(record, "closed_at_turn_count"),
    votes: (Array.isArray(record.votes) ? record.votes : []).map(normalizeVote).filter((vote): vote is TrialVote => vote !== null),
    evidenceId: readString(record, "evidenceId") ?? readString(record, "evidence_id") ?? null,
    createdAt: readString(record, "createdAt") ?? readString(record, "created_at") ?? null,
    closedAt: readString(record, "closedAt") ?? readString(record, "closed_at") ?? null
  };
}

export function normalizeTrialRules(value: unknown): TrialRules {
  const base = asRecord(value);
  const stages = (Array.isArray(base.stages) ? base.stages : [])
    .map(normalizeStage)
    .sort((left, right) => left.order - right.order);
  const evidence = (Array.isArray(base.evidence) ? base.evidence : []).map(normalizeEvidence);
  const allEvidenceVisible = readBoolean(base, "allEvidenceVisible", readBoolean(base, "all_evidence_visible", false));
  const configuredReleasedEvidenceIds = uniqueStrings(base.releasedEvidenceIds ?? base.released_evidence_ids);
  const releasedEvidenceIds = allEvidenceVisible ? evidence.map((item) => item.id) : configuredReleasedEvidenceIds;
  const caseFactsReleased = readBoolean(base, "caseFactsReleased", readBoolean(base, "case_facts_released", false));
  const configuredStageId = readString(base, "currentStageId") ?? readString(base, "current_stage_id") ?? null;
  const currentStageId =
    configuredStageId && stages.some((stage) => stage.id === configuredStageId)
      ? configuredStageId
      : stages[0]?.id ?? null;
  const maxVoteRounds = Math.max(1, readNumber(base, "maxVoteRounds", readNumber(base, "max_vote_rounds", 5)));
  const currentVoteRound = Math.min(
    maxVoteRounds,
    Math.max(0, readNumber(base, "currentVoteRound", readNumber(base, "current_vote_round", 0)))
  );
  const voteOptions = uniqueStrings(base.voteOptions ?? base.vote_options);

  return {
    ...base,
    mode: readString(base, "mode") ?? "jury_trial",
    currentStageId,
    caseFactsReleased,
    releasedEvidenceIds,
    allEvidenceVisible,
    stages,
    evidence,
    voteOptions: voteOptions.length ? voteOptions : ["guilty", "not_guilty", "undecided"],
    voteOpen: readBoolean(base, "voteOpen", readBoolean(base, "vote_open", false)),
    activeVoteStageId: readString(base, "activeVoteStageId") ?? readString(base, "active_vote_stage_id") ?? null,
    maxVoteRounds,
    currentVoteRound,
    voteStartedTurnCount:
      readOptionalNumber(base, "voteStartedTurnCount") ?? readOptionalNumber(base, "vote_started_turn_count"),
    voteRounds: (Array.isArray(base.voteRounds) ? base.voteRounds : [])
      .map(normalizeVoteRound)
      .filter((round): round is TrialVoteRound => round !== null)
      .sort((left, right) => left.round - right.round)
  };
}

export function getCurrentStage(rules: TrialRules) {
  return rules.stages.find((stage) => stage.id === rules.currentStageId) ?? null;
}

export function getNextStage(rules: TrialRules) {
  const currentIndex = rules.stages.findIndex((stage) => stage.id === rules.currentStageId);
  if (currentIndex === -1) {
    return rules.stages[0] ?? null;
  }

  return rules.stages[currentIndex + 1] ?? null;
}

export function getEvidenceById(rules: TrialRules, evidenceId: string) {
  return rules.evidence.find((item) => item.id === evidenceId) ?? null;
}

export function getReleasedEvidence(rules: TrialRules) {
  return rules.releasedEvidenceIds
    .map((evidenceId) => getEvidenceById(rules, evidenceId))
    .filter((item): item is TrialEvidence => item !== null);
}

export function getVisibleEvidence(rules: TrialRules) {
  return rules.allEvidenceVisible ? rules.evidence : getReleasedEvidence(rules);
}

export function getEvidenceForStage(rules: TrialRules, stage: TrialStage | null) {
  if (!stage) {
    return [];
  }

  return stage.evidenceIds
    .map((evidenceId) => getEvidenceById(rules, evidenceId))
    .filter((item): item is TrialEvidence => item !== null);
}

export function isEvidenceReleased(rules: TrialRules, evidenceId: string) {
  return rules.releasedEvidenceIds.includes(evidenceId);
}

export function formatEvidenceForBoard(evidence: TrialEvidence) {
  return [
    `Evidence ${evidence.id}: ${evidence.title}`,
    evidence.content,
    evidence.prosecutionView ? `Prosecution view: ${evidence.prosecutionView}` : null,
    evidence.defenseView ? `Defense view: ${evidence.defenseView}` : null,
    evidence.discussionPrompt ? `Discussion prompt: ${evidence.discussionPrompt}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}
