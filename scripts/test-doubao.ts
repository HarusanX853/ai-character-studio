import { resolve } from "node:path";
import { doubaoProvider } from "@/lib/llm/providers/doubao";
import { extractFirstJsonObject, safeJsonParse } from "@/lib/utils/safe-parse";

const defaultModel = "doubao-seed-evolving";

function redact(value: string, apiKey: string) {
  return value
    .replaceAll(apiKey, "[REDACTED]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
}

function printFailure(message: string) {
  console.error(`Doubao test failed: ${message}`);
  process.exitCode = 1;
}

async function main() {
  process.loadEnvFile(resolve(process.cwd(), ".env"));

  const apiKey = process.env.DOUBAO_API_KEY?.trim();
  if (!apiKey) {
    printFailure("DOUBAO_API_KEY is not configured. The test did not call the mock provider.");
    return;
  }

  const model = process.argv[2]?.trim() || process.env.DOUBAO_TEST_MODEL?.trim() || defaultModel;

  try {
    const result = await doubaoProvider.generateCharacterTurn({
      provider: "doubao",
      model,
      systemPrompt: 'You are a connectivity test. Return exactly {"status":"ok","message":"reachable"} and nothing else.',
      userPrompt: "Return the required JSON now.",
      temperature: 0,
      maxTokens: 120
    });

    const directJson = safeJsonParse(result.rawText);
    const parsedJson = directJson.ok ? directJson : extractFirstJsonObject(result.rawText);
    if (!parsedJson.ok) {
      const preview = result.rawText.replace(/\s+/g, " ").slice(0, 300);
      printFailure(`The endpoint responded, but the model did not return parseable JSON. Response preview: ${preview}`);
      return;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          tokensInput: result.tokensInput,
          tokensOutput: result.tokensOutput,
          response: parsedJson.data
        },
        null,
        2
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printFailure(redact(message, apiKey));
  }
}

void main();
