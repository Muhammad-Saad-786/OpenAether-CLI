export function parseToolArguments(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== null),
  );
}
