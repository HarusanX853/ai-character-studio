import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { getTotalOutputTokens } from "@/lib/llm/output-limits";
import { requireApiKey, requireMessageContent, throwProviderResponseError } from "../errors";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "../types";

export const anthropicProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = requireApiKey(process.env.ANTHROPIC_API_KEY, "Anthropic", input.model, "ANTHROPIC_API_KEY");

    const startedAt = Date.now();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: input.model,
        system: input.systemPrompt,
        messages: [{ role: "user", content: input.userPrompt }],
        max_tokens: getTotalOutputTokens(input),
        temperature: input.temperature ?? 0.7
      })
    });

    if (!response.ok) {
      await throwProviderResponseError(response, "Anthropic", input.model);
    }

    const providerResponse = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const rawText = requireMessageContent(
      providerResponse.content?.find((item) => item.type === "text")?.text,
      "Anthropic",
      input.model
    );
    const tokensInput =
      providerResponse.usage?.input_tokens ?? estimateTokenCount(`${input.systemPrompt}\n${input.userPrompt}`);
    const tokensOutput = providerResponse.usage?.output_tokens ?? estimateTokenCount(rawText);

    return {
      rawText,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost("anthropic", input.model, tokensInput, tokensOutput),
      latencyMs: Date.now() - startedAt,
      providerResponse,
      provider: "anthropic",
      model: input.model
    };
  }
};
