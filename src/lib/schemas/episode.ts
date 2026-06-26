import { z } from "zod";

export const episodeFormats = [
  "jury_deliberation",
  "murder_mystery",
  "tabletop_rpg",
  "werewolf",
  "debate",
  "council_vote",
  "improv_drama"
] as const;

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const episodeSchema = z.object({
  title: z.string().trim().min(1),
  format: z.enum(episodeFormats),
  setting: z.string().trim().min(1),
  publicFactsJson: z.unknown().optional(),
  hiddenFactsJson: z.unknown().optional(),
  rulesJson: z.unknown().optional(),
  budgetUsd: z.number().min(0).default(3),
  maxRounds: z.number().int().min(1).max(100).default(12),
  status: z.enum(["draft", "active", "paused", "ended"]).default("draft")
});

export type EpisodeInput = z.infer<typeof episodeSchema>;

export const episodeCharacterSchema = z.object({
  characterId: z.string().min(1),
  roleInEpisode: optionalTrimmedString,
  hiddenFactsJson: z.unknown().optional()
});

export const overrideBudgetSchema = z.object({
  amountUsd: z.number().min(0.01).max(100).default(3)
});
