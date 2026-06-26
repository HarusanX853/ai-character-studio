export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function safeJsonParse<T = unknown>(text: string): SafeParseResult<T> {
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}

export function extractFirstJsonObject(text: string): SafeParseResult<unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "No JSON object found" };
  }

  return safeJsonParse(text.slice(start, end + 1));
}
