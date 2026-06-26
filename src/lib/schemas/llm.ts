import { z } from "zod";

export const llmProviderSchema = z.enum([
  "mock",
  "mock-local",
  "openai",
  "openrouter",
  "anthropic",
  "gemini",
  "deepseek",
  "doubao",
  "xai"
]);

export const providerModelSchema = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1)
});
