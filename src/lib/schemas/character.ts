import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const characterSchema = z.object({
  name: z.string().trim().min(1),
  displayName: optionalTrimmedString,
  avatarUrl: optionalTrimmedString,
  provider: z.string().trim().min(1).default("mock-local"),
  model: z.string().trim().min(1).default("mock-roleplay"),
  roleArchetype: optionalTrimmedString,
  personalityJson: z.unknown().default({}),
  backstory: z.string().trim().min(1),
  publicGoal: optionalTrimmedString,
  privateGoal: optionalTrimmedString,
  secretsJson: z.unknown().optional(),
  speechStyle: optionalTrimmedString,
  costPolicyJson: z.unknown().optional()
});

export type CharacterInput = z.infer<typeof characterSchema>;

export const memoryCreateSchema = z.object({
  type: z.string().trim().min(1).default("episode"),
  content: z.string().trim().min(1),
  visibility: z.enum(["private", "public"]).default("private"),
  importance: z.number().min(0).max(1).default(0.5),
  episodeId: z.string().optional()
});

export const memoryUpdateSchema = z
  .object({
    type: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    visibility: z.enum(["private", "public"]).optional(),
    importance: z.number().min(0).max(1).optional()
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one memory field is required."
  });
