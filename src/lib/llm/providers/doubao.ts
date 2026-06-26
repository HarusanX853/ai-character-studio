import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { mockProvider } from "./mock";
import type { GenerateCharacterTurnInput, GenerateCharacterTurnResult, LLMProviderAdapter } from "../types";

type ChatMessageContent = string | Array<{ type?: string; text?: string }>;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: ChatMessageContent;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function readMessageContent(content?: ChatMessageContent) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .filter(Boolean)
      .join("\n");
    return text || "{}";
  }

  return "{}";
}

export const doubaoProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      return mockProvider.generateCharacterTurn(input);
    }

    const baseUrl = normalizeBaseUrl(process.env.DOUBAO_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3");
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
        max_tokens: input.maxTokens ?? 800,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Doubao request failed with status ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const providerResponse = (await response.json()) as ChatCompletionResponse;
    const rawText = readMessageContent(providerResponse.choices?.[0]?.message?.content);
    const tokensInput =
      providerResponse.usage?.prompt_tokens ?? estimateTokenCount(`${input.systemPrompt}\n${input.userPrompt}`);
    const tokensOutput = providerResponse.usage?.completion_tokens ?? estimateTokenCount(rawText);

    return {
      rawText,
      tokensInput,
      tokensOutput,
      estimatedCost: estimateCost("doubao", input.model, tokensInput, tokensOutput),
      latencyMs: Date.now() - startedAt,
      providerResponse,
      provider: "doubao",
      model: input.model
    };
  }
};
