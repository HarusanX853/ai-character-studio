export type LlmFailureDetails = {
  providerResponse?: unknown;
  tokensInput?: number;
  tokensOutput?: number;
  estimatedCost?: number;
  latencyMs?: number;
};

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly model: string,
    public readonly details?: LlmFailureDetails
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}

export function requireApiKey(value: string | undefined, provider: string, model: string, envName: string) {
  const apiKey = value?.trim();
  if (!apiKey) {
    throw new LlmProviderError(
      `${provider} 调用失败：未配置 ${envName}。`,
      "provider_not_configured",
      provider,
      model
    );
  }

  return apiKey;
}

export async function throwProviderResponseError(
  response: Response,
  provider: string,
  model: string
): Promise<never> {
  const body = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 500);
  const detail = body ? `：${body}` : "";
  throw new LlmProviderError(
    `${provider} 调用失败（HTTP ${response.status}）${detail}`,
    "provider_request_failed",
    provider,
    model
  );
}

export function requireMessageContent(
  content: string | undefined | null,
  provider: string,
  model: string,
  detail?: string
) {
  if (!content?.trim()) {
    throw new LlmProviderError(
      `${provider} 模型 ${model} 未返回可用正文${detail ? `（${detail}）` : ""}。`,
      detail?.includes("finish_reason=length") ? "provider_output_truncated" : "provider_empty_response",
      provider,
      model
    );
  }

  return content;
}

export function getLlmErrorCode(error: unknown) {
  return error instanceof LlmProviderError ? error.code : "model_call_failed";
}

export function getLlmFailureDetails(error: unknown) {
  return error instanceof LlmProviderError ? error.details : undefined;
}
