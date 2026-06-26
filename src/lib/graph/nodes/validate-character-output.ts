import {
  characterTurnOutputSchema,
  fallbackCharacterTurnOutput
} from "@/lib/schemas/character-output";
import { extractFirstJsonObject, safeJsonParse } from "@/lib/utils/safe-parse";
import type { EpisodeGraphState } from "../state";

const claimTypes = new Set(["public_fact", "claim", "hypothesis", "contradiction", "clue", "vote_result", "rule_state"]);
const memoryTypes = new Set(["persona", "episode", "relationship", "secret", "reflection"]);
const visibilityValues = new Set(["private", "public"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeClaims(value: unknown, topLevelShouldPublish: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((claim) => {
      if (typeof claim === "string") {
        return {
          type: "claim",
          content: claim,
          should_publish_to_shared_board: topLevelShouldPublish === true
        };
      }

      const record = asRecord(claim);
      const content = record.content ?? record.fact ?? record.text ?? record.claim;
      if (typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        ...record,
        type: typeof record.type === "string" && claimTypes.has(record.type) ? record.type : "claim",
        content: content.trim(),
        should_publish_to_shared_board:
          typeof record.should_publish_to_shared_board === "boolean"
            ? record.should_publish_to_shared_board
            : topLevelShouldPublish === true
      };
    })
    .filter(Boolean);
}

function normalizeMemoryWrites(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((memory) => {
      if (typeof memory === "string") {
        return {
          type: "episode",
          content: memory,
          visibility: "private"
        };
      }

      const record = asRecord(memory);
      const content = record.content ?? record.memory ?? record.text;
      if (typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        ...record,
        type: typeof record.type === "string" && memoryTypes.has(record.type) ? record.type : "episode",
        content: content.trim(),
        visibility: typeof record.visibility === "string" && visibilityValues.has(record.visibility) ? record.visibility : "private"
      };
    })
    .filter(Boolean);
}

function normalizeCharacterOutputCandidate(candidate: unknown) {
  const record = asRecord(candidate);
  if (!Object.keys(record).length) {
    return candidate;
  }

  return {
    ...record,
    claims: normalizeClaims(record.claims, record.should_publish_to_shared_board),
    memory_writes: normalizeMemoryWrites(record.memory_writes)
  };
}

export async function validateCharacterOutput(state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  if (state.shouldEnd || !state.characterOutputRaw) {
    return {};
  }

  const parsedJson = safeJsonParse(state.characterOutputRaw);
  const extractedJson = parsedJson.ok ? parsedJson : extractFirstJsonObject(state.characterOutputRaw);
  const candidate = extractedJson.ok ? normalizeCharacterOutputCandidate(extractedJson.data) : fallbackCharacterTurnOutput;

  const parsed = characterTurnOutputSchema.safeParse(candidate);

  return {
    characterOutputParsed: parsed.success ? parsed.data : fallbackCharacterTurnOutput
  };
}
