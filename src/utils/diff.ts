/**
 * Render a unified-style diff with ANSI colors.
 * Input is the compact diff format produced by file-write.ts / file-edit.ts:
 *   "- old line"
 *   "+ new line"
 * Lines with neither prefix are context (skipped by our producer).
 */
export function renderDiff(
  diff: string,
  options: { maxLines?: number; color?: boolean } = {},
): string {
  if (!diff || !diff.trim()) return "";

  const maxLines = options.maxLines ?? 40;
  const useColor = options.color ?? true;

  const lines = diff.split("\n");
  const shown = lines.slice(0, maxLines);
  const omitted = lines.length - shown.length;

  const paint = (line: string, color: "green" | "red" | "gray"): string => {
    if (!useColor) return line;
    const codes: Record<string, string> = {
      green: "\x1b[32m",
      red: "\x1b[31m",
      gray: "\x1b[90m",
    };
    return `${codes[color]}${line}\x1b[0m`;
  };

  const out: string[] = [];
  for (const line of shown) {
    if (line.startsWith("- ")) out.push(paint(line, "red"));
    else if (line.startsWith("+ ")) out.push(paint(line, "green"));
    else out.push(paint(line, "gray"));
  }

  if (omitted > 0) {
    out.push(
      paint(`... ${omitted} more line${omitted === 1 ? "" : "s"}`, "gray"),
    );
  }

  return out.join("\n");
}

/**
 * Count added and removed lines in a diff string.
 */
export function diffStats(diff: string): { added: number; removed: number } {
  if (!diff) return { added: 0, removed: 0 };
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+ ")) added++;
    else if (line.startsWith("- ")) removed++;
  }
  return { added, removed };
}
