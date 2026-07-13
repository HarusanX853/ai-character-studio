import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { getTotalOutputTokens } from "@/lib/llm/output-limits";
import { requireApiKey, requireMessageContent, throwProviderResponseError } from "../errors";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "../types";

export const openaiProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = requireApiKey(process.env.OPENAI_API_KEY, "OpenAI", input.model, "OPENAI_API_KEY");

    const startedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: getTotalOutputTokens(input),
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      await throwProviderResponseError(response, "OpenAI", input.model);
    }

    const providerResponse = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const rawText = requireMessageContent(providerResponse.choices?.[0]?.message?.content, "OpenAI", input.model);
    const tokensInput =
      providerResponse.usage?.prompt_tokens ?? estimateTokenCount(`${input.systemPrompt}\n${input.userPrompt}`);
    const tokensOutput = providerResponse.usage?.completion_tokens ?? estimateTokenCount(rawText);

    return {
      rawText,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost("openai", input.model, tokensInput, tokensOutput),
      latencyMs: Date.now() - startedAt,
      providerResponse,
      provider: "openai",
      model: input.model
    };
  }
};
