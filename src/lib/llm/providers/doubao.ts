import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { getTotalOutputTokens } from "@/lib/llm/output-limits";
import { LlmProviderError, requireApiKey, requireMessageContent } from "../errors";
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
  return baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
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
    return text;
  }

  return "";
}

export const doubaoProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = requireApiKey(process.env.DOUBAO_API_KEY, "Doubao", input.model, "DOUBAO_API_KEY");

    const baseUrl = normalizeBaseUrl(process.env.DOUBAO_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3");
    const startedAt = Date.now();
    const requestCompletion = (includeJsonResponseFormat: boolean) =>
      fetch(`${baseUrl}/chat/completions`, {
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
          ...(includeJsonResponseFormat ? { response_format: { type: "json_object" } } : {})
        })
      });

    let response = await requestCompletion(true);
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status !== 400 || !errorText.includes("json_object") || !errorText.includes("not supported")) {
        throw new LlmProviderError(
          `Doubao 调用失败（HTTP ${response.status}）：${errorText.slice(0, 500)}`,
          "provider_request_failed",
          "doubao",
          input.model
        );
      }

      response = await requestCompletion(false);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new LlmProviderError(
        `Doubao 调用失败（HTTP ${response.status}）：${errorText.slice(0, 500)}`,
        "provider_request_failed",
        "doubao",
        input.model
      );
    }

    const providerResponse = (await response.json()) as ChatCompletionResponse;
    const rawText = requireMessageContent(
      readMessageContent(providerResponse.choices?.[0]?.message?.content),
      "Doubao",
      input.model
    );
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
