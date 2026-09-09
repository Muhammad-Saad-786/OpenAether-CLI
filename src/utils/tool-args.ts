export function parseToolArguments(raw: string): Record<string, unknown> {
  const normalized = raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized || "{}");
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start < 0 || end <= start)
      throw new Error("Invalid tool arguments JSON");
    parsed = JSON.parse(normalized.slice(start, end + 1));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== null),
  );
}
