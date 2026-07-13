import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { getTotalOutputTokens } from "@/lib/llm/output-limits";
import { requireApiKey, requireMessageContent, throwProviderResponseError } from "../errors";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "../types";

export const geminiProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = requireApiKey(
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
      "Gemini",
      input.model,
      "GOOGLE_GENERATIVE_AI_API_KEY 或 GEMINI_API_KEY"
    );

    const startedAt = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${input.systemPrompt}\n\n${input.userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: input.temperature ?? 0.7,
            maxOutputTokens: getTotalOutputTokens(input),
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      await throwProviderResponseError(response, "Gemini", input.model);
    }

    const providerResponse = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const rawText = requireMessageContent(
      providerResponse.candidates?.[0]?.content?.parts?.[0]?.text,
      "Gemini",
      input.model
    );
    const tokensInput =
      providerResponse.usageMetadata?.promptTokenCount ?? estimateTokenCount(`${input.systemPrompt}\n${input.userPrompt}`);
    const tokensOutput = providerResponse.usageMetadata?.candidatesTokenCount ?? estimateTokenCount(rawText);

    return {
      rawText,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost("gemini", input.model, tokensInput, tokensOutput),
      latencyMs: Date.now() - startedAt,
      providerResponse,
      provider: "gemini",
      model: input.model
    };
  }
};
