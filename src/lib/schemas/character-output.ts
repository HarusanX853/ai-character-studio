import { z } from "zod";

export const claimTypeSchema = z.enum([
  "public_fact",
  "claim",
  "hypothesis",
  "contradiction",
  "clue",
  "vote_result",
  "rule_state"
]);

export const memoryTypeSchema = z.enum(["persona", "episode", "relationship", "secret", "reflection"]);

export const characterTurnOutputSchema = z.object({
  speech: z.string().min(1),
  action: z.string().optional(),
  inner_thought: z.string().optional(),
  emotion: z.string().optional(),
  intent: z.string().optional(),
  stance: z.enum(["guilty", "not_guilty", "undecided"]).optional(),
  cited_evidence_ids: z.array(z.string()).default([]),
  vote_choice: z.string().optional(),
  vote_rationale: z.string().optional(),
  claims: z
    .array(
      z.object({
        type: claimTypeSchema,
        content: z.string().min(1),
        confidence: z.number().min(0).max(1).optional(),
        should_publish_to_shared_board: z.boolean().optional()
      })
    )
    .default([]),
  memory_writes: z
    .array(
      z.object({
        type: memoryTypeSchema,
        content: z.string().min(1),
        visibility: z.enum(["private", "public"]).default("private"),
        importance: z.number().min(0).max(1).optional()
      })
    )
    .default([]),
  next_speaker_suggestion: z.string().optional()
});

export type CharacterTurnOutput = z.infer<typeof characterTurnOutputSchema>;

export const fallbackCharacterTurnOutput: CharacterTurnOutput = {
  speech: "我需要重新整理一下思路。",
  action: "沉默片刻。",
  emotion: "迟疑",
  intent: "pause",
  cited_evidence_ids: [],
  claims: [],
  memory_writes: []
};
