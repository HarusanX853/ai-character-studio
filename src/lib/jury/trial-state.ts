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

export type TrialRules = Record<string, unknown> & {
  mode: string;
  currentStageId: string | null;
  releasedEvidenceIds: string[];
  stages: TrialStage[];
  evidence: TrialEvidence[];
  voteOptions: string[];
  voteOpen: boolean;
  activeVoteStageId: string | null;
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

export function normalizeTrialRules(value: unknown): TrialRules {
  const base = asRecord(value);
  const stages = (Array.isArray(base.stages) ? base.stages : [])
    .map(normalizeStage)
    .sort((left, right) => left.order - right.order);
  const evidence = (Array.isArray(base.evidence) ? base.evidence : []).map(normalizeEvidence);
  const releasedEvidenceIds = uniqueStrings(base.releasedEvidenceIds ?? base.released_evidence_ids);
  const configuredStageId = readString(base, "currentStageId") ?? readString(base, "current_stage_id") ?? null;
  const currentStageId =
    configuredStageId && stages.some((stage) => stage.id === configuredStageId)
      ? configuredStageId
      : stages[0]?.id ?? null;

  return {
    ...base,
    mode: readString(base, "mode") ?? "jury_trial",
    currentStageId,
    releasedEvidenceIds,
    stages,
    evidence,
    voteOptions: uniqueStrings(base.voteOptions ?? base.vote_options),
    voteOpen: readBoolean(base, "voteOpen", readBoolean(base, "vote_open", false)),
    activeVoteStageId: readString(base, "activeVoteStageId") ?? readString(base, "active_vote_stage_id") ?? null
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
