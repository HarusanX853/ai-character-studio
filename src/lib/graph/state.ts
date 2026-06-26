import type { Prisma } from "@prisma/client";
import type { GenerateCharacterTurnResult } from "@/lib/llm/types";
import type { CharacterTurnOutput } from "@/lib/schemas/character-output";

export type EpisodeSnapshot = {
  id: string;
  title: string;
  format: string;
  setting: string;
  publicFactsJson: Prisma.JsonValue | null;
  hiddenFactsJson: Prisma.JsonValue | null;
  rulesJson: Prisma.JsonValue | null;
  budgetUsd: number;
  maxRounds: number;
  status: string;
};

export type CharacterSnapshot = {
  id: string;
  name: string;
  displayName: string | null;
  provider: string;
  model: string;
  roleArchetype: string | null;
  personalityJson: Prisma.JsonValue;
  backstory: string;
  publicGoal: string | null;
  privateGoal: string | null;
  secretsJson: Prisma.JsonValue | null;
  speechStyle: string | null;
  episodeRole: string | null;
  episodeHiddenFactsJson: Prisma.JsonValue | null;
};

export type TurnSnapshot = {
  id: string;
  roundIndex: number;
  speakerCharacterId: string;
  speakerName: string;
  speech: string;
  action: string | null;
  emotion: string | null;
  intent: string | null;
  estimatedCost: number;
  tokensInput: number;
  tokensOutput: number;
  createdAt: string;
};

export type MemorySnapshot = {
  id: string;
  type: string;
  content: string;
  visibility: string;
  importance: number;
  createdAt: string;
};

export type SharedBoardSnapshot = {
  id: string;
  type: string;
  content: string;
  source: string | null;
  introducedByCharacterId: string | null;
  confidence: number;
  visibility: string;
  createdAt: string;
};

export type EpisodeGraphState = {
  episodeId: string;
  threadId: string;
  episode: EpisodeSnapshot | null;
  characters: CharacterSnapshot[];
  currentSpeakerId: string | null;
  roundIndex: number;
  turnCount: number;
  recentTurns: TurnSnapshot[];
  sharedBoard: SharedBoardSnapshot[];
  retrievedMemories: MemorySnapshot[];
  builtContext: {
    systemPrompt: string;
    userPrompt: string;
  } | null;
  characterOutputRaw: string | null;
  characterOutputParsed: CharacterTurnOutput | null;
  llmResult: GenerateCharacterTurnResult | null;
  budget: {
    budgetUsd: number;
    spentUsd: number;
    remainingUsd: number;
    exceeded: boolean;
    override: boolean;
  };
  shouldEnd: boolean;
  endReason: string | null;
  error: string | null;
  lastTurnId: string | null;
};

export function createInitialEpisodeGraphState(episodeId: string, threadId: string): EpisodeGraphState {
  return {
    episodeId,
    threadId,
    episode: null,
    characters: [],
    currentSpeakerId: null,
    roundIndex: 1,
    turnCount: 0,
    recentTurns: [],
    sharedBoard: [],
    retrievedMemories: [],
    builtContext: null,
    characterOutputRaw: null,
    characterOutputParsed: null,
    llmResult: null,
    budget: {
      budgetUsd: 0,
      spentUsd: 0,
      remainingUsd: 0,
      exceeded: false,
      override: false
    },
    shouldEnd: false,
    endReason: null,
    error: null,
    lastTurnId: null
  };
}
