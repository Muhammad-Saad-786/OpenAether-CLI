export function parseToolArguments(raw: string): Record<string, unknown> {
  const normalized = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  // Try direct parse first.
  const direct = tryParse(normalized);
  if (direct) return direct;

  // Extract the first { ... } block.
  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const extracted = normalized.slice(start, end + 1);
    const extracted_parsed = tryParse(extracted);
    if (extracted_parsed) return extracted_parsed;
  }

  throw new Error(
    `Could not parse tool arguments as JSON. Received: ${normalized.slice(0, 200)}`,
  );
}

function tryParse(text: string): Record<string, unknown> | null {
  const candidates: string[] = [
    text,
    // Strip trailing commas before closing braces/brackets.
    text.replace(/,\s*([}\]])/g, "$1"),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter(([, v]) => v !== null),
        );
      }
    } catch {
      // try next candidate
    }
  }

  // Single-quote fallback: swap single-quoted strings to double-quoted.
  try {
    const swapped = text
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(swapped);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v !== null),
      );
    }
  } catch {
    // give up
  }

  return null;
}
