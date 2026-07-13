import { estimateCost, estimateTokenCount } from "@/lib/cost/estimate-cost";
import { getTotalOutputTokens } from "@/lib/llm/output-limits";
import { LlmProviderError, requireApiKey } from "../errors";
import type {
  GenerateCharacterTurnInput,
  GenerateCharacterTurnResult,
  GenerationBudget,
  LLMProviderAdapter
} from "../types";

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type OpenRouterChatCompletionResponse = {
  id?: string;
  provider?: string;
  choices?: Array<{
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: OpenRouterUsage;
};

type OpenRouterCapabilities = {
  endpointParameterSets: Array<Set<string>>;
  supportsReasoning: boolean;
  supportsReasoningMaxTokens: boolean;
  reasoningMandatory: boolean;
  supportedReasoningEfforts: OpenRouterReasoningEffort[] | null | undefined;
};

type OpenRouterReasoningEffort = "max" | "xhigh" | "high" | "medium" | "low" | "minimal" | "none";

type ReasoningConfig = { max_tokens: number } | { effort: OpenRouterReasoningEffort };

type AttemptSummary = {
  attempt: "initial" | "reduced_reasoning_retry";
  requestedReasoning: ReasoningConfig | null;
  routedProvider: string | null;
  finishReason: string;
  nativeFinishReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  contentChars: number;
  reasoningChars: number;
};

const CAPABILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const capabilityCache = new Map<string, { expiresAt: number; value: OpenRouterCapabilities }>();
let catalogCache:
  | {
      expiresAt: number;
      value: Map<
        string,
        {
          supportedParameters: string[];
          reasoning?: {
            supported_efforts?: OpenRouterReasoningEffort[] | null;
            supports_max_tokens?: boolean;
            mandatory?: boolean;
          } | null;
        }
      >;
    }
  | undefined;
let catalogRequest: Promise<NonNullable<typeof catalogCache>["value"]> | undefined;

function shouldRetryWithoutJsonObject(status: number, errorText: string) {
  const normalized = errorText.toLowerCase();
  return (
    status === 400 &&
    (normalized.includes("json_object") || normalized.includes("response_format")) &&
    (normalized.includes("not support") || normalized.includes("unsupported") || normalized.includes("no endpoints"))
  );
}

function encodeModelPath(model: string) {
  return model
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function getOpenRouterCapabilities(model: string, apiKey: string): Promise<OpenRouterCapabilities> {
  const cached = capabilityCache.get(model);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const emptyCapabilities: OpenRouterCapabilities = {
    endpointParameterSets: [],
    supportsReasoning: false,
    supportsReasoningMaxTokens: false,
    reasoningMandatory: false,
    supportedReasoningEfforts: undefined
  };

  try {
    const [response, catalog] = await Promise.all([
      fetch(`https://openrouter.ai/api/v1/models/${encodeModelPath(model)}/endpoints`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      }).catch(() => null),
      getOpenRouterModelCatalog(apiKey)
    ]);
    const payload = response?.ok
      ? ((await response.json()) as {
          data?: {
            endpoints?: Array<{
              supported_parameters?: string[];
            }>;
          };
        })
      : undefined;
    const endpointParameterSets = (payload?.data?.endpoints ?? []).map(
      (endpoint) => new Set(endpoint.supported_parameters ?? [])
    );
    const catalogEntry = catalog.get(model);
    const reasoningMetadata = catalogEntry?.reasoning;
    const value = {
      endpointParameterSets,
      supportsReasoning:
        catalogEntry?.supportedParameters.includes("reasoning") ??
        endpointParameterSets.some((parameters) => parameters.has("reasoning")),
      supportsReasoningMaxTokens: reasoningMetadata?.supports_max_tokens === true,
      reasoningMandatory: reasoningMetadata?.mandatory === true,
      supportedReasoningEfforts: reasoningMetadata?.supported_efforts
    };
    capabilityCache.set(model, { expiresAt: Date.now() + CAPABILITY_CACHE_TTL_MS, value });
    return value;
  } catch {
    return emptyCapabilities;
  }
}

async function getOpenRouterModelCatalog(apiKey: string) {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.value;
  }

  if (!catalogRequest) {
    catalogRequest = (async () => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) {
          return new Map();
        }

        const payload = (await response.json()) as {
          data?: Array<{
            id?: string;
            supported_parameters?: string[];
            reasoning?: {
              supported_efforts?: OpenRouterReasoningEffort[] | null;
              supports_max_tokens?: boolean;
              mandatory?: boolean;
            } | null;
          }>;
        };
        const catalog = new Map<
          string,
          {
            supportedParameters: string[];
            reasoning?: {
              supported_efforts?: OpenRouterReasoningEffort[] | null;
              supports_max_tokens?: boolean;
              mandatory?: boolean;
            } | null;
          }
        >();
        for (const item of payload.data ?? []) {
          if (item.id) {
            catalog.set(item.id, {
              supportedParameters: item.supported_parameters ?? [],
              reasoning: item.reasoning
            });
          }
        }
        catalogCache = { expiresAt: Date.now() + CAPABILITY_CACHE_TTL_MS, value: catalog };
        return catalog;
      } catch {
        return new Map();
      }
    })().finally(() => {
      catalogRequest = undefined;
    });
  }

  return catalogRequest;
}

const effortRatio: Record<Exclude<OpenRouterReasoningEffort, "none">, number> = {
  minimal: 0.1,
  low: 0.2,
  medium: 0.5,
  high: 0.8,
  xhigh: 0.95,
  max: 0.95
};

function resolveReasoningConfig(
  capabilities: OpenRouterCapabilities,
  budget: GenerationBudget | undefined,
  retry: boolean
): ReasoningConfig | undefined {
  if (!budget || !capabilities.supportsReasoning) {
    return undefined;
  }

  if (capabilities.supportsReasoningMaxTokens) {
    if (retry && !capabilities.reasoningMandatory) {
      return { effort: "none" };
    }
    return { max_tokens: retry ? Math.max(1024, budget.retryReasoningTokens) : budget.reasoningTokens };
  }

  if (capabilities.supportedReasoningEfforts === undefined) {
    return { max_tokens: retry ? budget.retryReasoningTokens : budget.reasoningTokens };
  }

  const supported = capabilities.supportedReasoningEfforts;

  if (retry) {
    if (supported === null) {
      return { effort: "minimal" };
    }
    const lowerEfforts =
      budget.reasoningEffort === "medium"
        ? (["low", "minimal"] as const)
        : budget.reasoningEffort === "low"
          ? (["minimal"] as const)
          : ([] as const);
    for (const effort of lowerEfforts) {
      if (supported.includes(effort)) {
        return { effort };
      }
    }
    return capabilities.reasoningMandatory ? { effort: supported.at(-1) ?? "low" } : { effort: "none" };
  }

  const availableEfforts = supported ?? (["medium", "low", "minimal"] as const);
  const maximumReasoningRatio = budget.reasoningTokens / budget.totalOutputTokens;
  if (
    availableEfforts.includes(budget.reasoningEffort) &&
    effortRatio[budget.reasoningEffort] <= maximumReasoningRatio
  ) {
    return { effort: budget.reasoningEffort };
  }

  const affordableEffort = (["medium", "low", "minimal"] as const).find(
    (effort) => availableEfforts.includes(effort) && effortRatio[effort] <= maximumReasoningRatio
  );
  if (affordableEffort) {
    return { effort: affordableEffort };
  }

  return capabilities.reasoningMandatory
    ? { effort: supported?.at(-1) ?? "low" }
    : { effort: "none" };
}

function canRequireParameters(capabilities: OpenRouterCapabilities, parameters: string[]) {
  return capabilities.endpointParameterSets.some((supported) =>
    parameters.every((parameter) => supported.has(parameter))
  );
}

function summarizeAttempt(
  response: OpenRouterChatCompletionResponse,
  attempt: AttemptSummary["attempt"],
  requestedReasoning: ReasoningConfig | null
): AttemptSummary {
  const choice = response.choices?.[0];
  const content = choice?.message?.content ?? "";
  const reasoning = choice?.message?.reasoning ?? "";

  return {
    attempt,
    requestedReasoning,
    routedProvider: response.provider ?? null,
    finishReason: choice?.finish_reason ?? "unknown",
    nativeFinishReason: choice?.native_finish_reason ?? null,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    reasoningTokens: response.usage?.completion_tokens_details?.reasoning_tokens ?? null,
    contentChars: content.length,
    reasoningChars: reasoning.length
  };
}

function decorateProviderResponse(
  response: OpenRouterChatCompletionResponse,
  budget: GenerationBudget | undefined,
  attempts: AttemptSummary[]
) {
  return {
    ...response,
    _studio: {
      generationBudget: budget ?? null,
      attempts
    }
  };
}

function readAttemptUsage(response: OpenRouterChatCompletionResponse, promptText: string, model: string) {
  const message = response.choices?.[0]?.message;
  const fallbackOutput = [message?.reasoning, message?.content].filter(Boolean).join("\n");
  const tokensInput = response.usage?.prompt_tokens ?? estimateTokenCount(promptText);
  const tokensOutput = response.usage?.completion_tokens ?? estimateTokenCount(fallbackOutput);
  const estimatedCost = response.usage?.cost ?? estimateCost("openrouter", model, tokensInput, tokensOutput);

  return { tokensInput, tokensOutput, estimatedCost };
}

export const openrouterProvider: LLMProviderAdapter = {
  async generateCharacterTurn(input: GenerateCharacterTurnInput): Promise<GenerateCharacterTurnResult> {
    const apiKey = requireApiKey(process.env.OPENROUTER_API_KEY, "OpenRouter", input.model, "OPENROUTER_API_KEY");

    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    const startedAt = Date.now();
    const totalOutputTokens = getTotalOutputTokens(input);
    const capabilities = await getOpenRouterCapabilities(input.model, apiKey);
    const initialReasoning = resolveReasoningConfig(capabilities, input.generationBudget, false);
    const promptText = `${input.systemPrompt}\n${input.userPrompt}`;

    const buildRequestBody = (includeResponseFormat: boolean, reasoning: ReasoningConfig | undefined) => {
      const requiredParameters = ["max_tokens", "temperature"];
      if (includeResponseFormat) {
        requiredParameters.push("response_format");
      }
      if (reasoning) {
        requiredParameters.push("reasoning");
      }
      const requireParameters = canRequireParameters(capabilities, requiredParameters);

      return {
        model: input.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt }
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: totalOutputTokens,
        ...(reasoning ? { reasoning } : {}),
        ...(includeResponseFormat ? { response_format: { type: "json_object" } } : {}),
        ...(requireParameters ? { provider: { require_parameters: true } } : {})
      };
    };

    const postCompletion = async (includeResponseFormat: boolean, reasoning: ReasoningConfig | undefined) => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody(includeResponseFormat, reasoning))
      });
      return {
        response,
        text: await response.text()
      };
    };

    const requestCompletion = async (reasoning: ReasoningConfig | undefined) => {
      let completion = await postCompletion(true, reasoning);
      if (!completion.response.ok && shouldRetryWithoutJsonObject(completion.response.status, completion.text)) {
        completion = await postCompletion(false, reasoning);
      }
      return completion;
    };

    const parseCompletion = (text: string) => {
      try {
        return JSON.parse(text) as OpenRouterChatCompletionResponse;
      } catch {
        throw new LlmProviderError(
          `OpenRouter 模型 ${input.model} 返回了无法解析的 API 响应。`,
          "provider_invalid_response",
          "openrouter",
          input.model,
          {
            providerResponse: { rawResponse: text.slice(0, 2000) },
            latencyMs: Date.now() - startedAt
          }
        );
      }
    };

    const responses: OpenRouterChatCompletionResponse[] = [];
    const attempts: AttemptSummary[] = [];
    let completion = await requestCompletion(initialReasoning);
    if (!completion.response.ok) {
      throw new LlmProviderError(
        `OpenRouter 调用失败（HTTP ${completion.response.status}）：${completion.text.slice(0, 500)}`,
        "provider_request_failed",
        "openrouter",
        input.model,
        {
          providerResponse: { httpStatus: completion.response.status, body: completion.text.slice(0, 2000) },
          latencyMs: Date.now() - startedAt
        }
      );
    }

    let providerResponse = parseCompletion(completion.text);
    responses.push(providerResponse);
    attempts.push(summarizeAttempt(providerResponse, "initial", initialReasoning ?? null));

    let firstChoice = providerResponse.choices?.[0];
    let finishReason = firstChoice?.finish_reason ?? "unknown";
    let rawText = firstChoice?.message?.content?.trim() ?? "";
    const retryReasoning = resolveReasoningConfig(capabilities, input.generationBudget, true);
    const canReduceReasoning =
      retryReasoning !== undefined && JSON.stringify(retryReasoning) !== JSON.stringify(initialReasoning);

    if (finishReason === "length" && input.generationBudget && initialReasoning && canReduceReasoning) {
      completion = await requestCompletion(retryReasoning);
      if (!completion.response.ok) {
        const usage = responses.map((response) => readAttemptUsage(response, promptText, input.model));
        throw new LlmProviderError(
          `OpenRouter 模型 ${input.model} 首次输出达到长度限制，降低思考预算后重试失败（HTTP ${completion.response.status}）：${completion.text.slice(0, 500)}`,
          "provider_request_failed",
          "openrouter",
          input.model,
          {
            providerResponse: decorateProviderResponse(providerResponse, input.generationBudget, attempts),
            tokensInput: usage.reduce((total, item) => total + item.tokensInput, 0),
            tokensOutput: usage.reduce((total, item) => total + item.tokensOutput, 0),
            estimatedCost: usage.reduce((total, item) => total + item.estimatedCost, 0),
            latencyMs: Date.now() - startedAt
          }
        );
      }

      providerResponse = parseCompletion(completion.text);
      responses.push(providerResponse);
      attempts.push(
        summarizeAttempt(providerResponse, "reduced_reasoning_retry", retryReasoning ?? null)
      );
      firstChoice = providerResponse.choices?.[0];
      finishReason = firstChoice?.finish_reason ?? "unknown";
      rawText = firstChoice?.message?.content?.trim() ?? "";
    }

    const usage = responses.map((response) => readAttemptUsage(response, promptText, input.model));
    const tokensInput = usage.reduce((total, item) => total + item.tokensInput, 0);
    const tokensOutput = usage.reduce((total, item) => total + item.tokensOutput, 0);
    const estimatedCost = usage.reduce((total, item) => total + item.estimatedCost, 0);
    const decoratedResponse = decorateProviderResponse(providerResponse, input.generationBudget, attempts);

    if (!rawText) {
      const retried = attempts.length > 1 ? "，已使用较低思考预算重试一次" : "";
      throw new LlmProviderError(
        `OpenRouter 模型 ${input.model} 未返回可用正文（finish_reason=${finishReason}${
          finishReason === "length" ? "，输出达到长度限制" : ""
        }${retried}）。`,
        finishReason === "length" ? "provider_output_truncated" : "provider_empty_response",
        "openrouter",
        input.model,
        {
          providerResponse: decoratedResponse,
          tokensInput,
          tokensOutput,
          estimatedCost,
          latencyMs: Date.now() - startedAt
        }
      );
    }

    return {
      rawText,
      tokensInput,
      tokensOutput,
      estimatedCost,
      latencyMs: Date.now() - startedAt,
      providerResponse: decoratedResponse,
      provider: "openrouter",
      model: input.model
    };
  }
};
