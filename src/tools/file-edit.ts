import { promises as fs } from "node:fs";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = {
  path: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
};

const BANNED_DIRECTIVES = [
  { pattern: /@ts-nocheck/, name: "@ts-nocheck" },
  { pattern: /@ts-ignore/, name: "@ts-ignore" },
  { pattern: /@ts-expect-error/, name: "@ts-expect-error" },
  { pattern: /\/\*\s*eslint-disable\s*\*\//, name: "blanket eslint-disable" },
];

function findBannedDirective(content: string): string | null {
  for (const { pattern, name } of BANNED_DIRECTIVES) {
    if (pattern.test(content)) return name;
  }
  return null;
}

export class FileEditTool implements Tool<Input> {
  name = "edit_file";
  description =
    "Replace an exact block of text in a file. oldText must match the file byte-for-byte, but whitespace-only differences are tolerated. Do NOT introduce directives like @ts-ignore or @ts-nocheck — fix the underlying problem instead.";
  sideEffect = "write" as const;
  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path to the file." },
      oldText: { type: "string", description: "Exact text to replace." },
      newText: { type: "string", description: "Replacement text." },
      replaceAll: {
        type: "boolean",
        description: "Replace every occurrence (default: false).",
      },
    },
    required: ["path", "oldText", "newText"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      if (!input.oldText) return fail("oldText must not be empty");

      const filePath = workspacePath(input.path);
      const original = await fs.readFile(filePath, "utf8");

      // 1. Try exact match first.
      let matchCount = countOccurrences(original, input.oldText);
      let strategy: "exact" | "whitespace" = "exact";
      let updated: string | null = null;

      if (matchCount === 0) {
        // 2. Fallback: whitespace-normalized match.
        const norm = normalizeWhitespace(original);
        const normOld = normalizeWhitespace(input.oldText);
        if (norm.includes(normOld)) {
          updated = replaceNormalized(original, input.oldText, input.newText);
          strategy = "whitespace";
          matchCount = 1;
        }
      }

      if (matchCount === 0) {
        return fail(
          `oldText not found in ${input.path}. Read the file first and copy the exact text you want to replace.`,
          `oldText not found in ${input.path}`,
        );
      }

      if (matchCount > 1 && !input.replaceAll) {
        return fail(
          `oldText matched ${matchCount} times in ${input.path}. Provide a unique block or set replaceAll=true.`,
          `Ambiguous edit (${matchCount} matches)`,
        );
      }

      if (updated === null) {
        updated = input.replaceAll
          ? original.split(input.oldText).join(input.newText)
          : original.replace(input.oldText, input.newText);
      }

      // 3. Banned-directive check — BEFORE writing.
      const banned = findBannedDirective(updated);
      if (banned) {
        return fail(
          `Refused to edit ${input.path}: result would contain banned directive "${banned}". ` +
            `Fix the underlying problem instead of suppressing it.`,
          `Banned directive: ${banned}`,
        );
      }

      await fs.writeFile(filePath, updated, "utf8");

      const diff = makeDiff(original, updated);

      return {
        ok: true,
        toolName: "edit_file",
        toolCallId: "",
        summary: `Edited ${input.path} (${strategy === "whitespace" ? "whitespace-tolerant match" : "exact match"})`,
        data: {
          path: input.path,
          absolutePath: filePath,
          replacements: input.replaceAll ? matchCount : 1,
          strategy,
        },
        meta: {
          filesAffected: [input.path],
          diff,
        },
      };
    } catch (error) {
      return fail(error);
    }
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Replace a region in `original` that matches `oldText` when whitespace is
 * normalized. Tries to preserve surrounding indentation from the file.
 */
function replaceNormalized(
  original: string,
  oldText: string,
  newText: string,
): string | null {
  const lines = original.split("\n");
  const oldLines = oldText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!oldLines.length) return null;

  for (let i = 0; i <= lines.length - oldLines.length; i++) {
    let ok = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (lines[i + j].trim() !== oldLines[j]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const indent = lines[i].match(/^\s*/)?.[0] ?? "";
    const newLines = newText
      .split("\n")
      .map((line, idx) => (idx === 0 ? line : indent + line));
    const before = lines.slice(0, i);
    const after = lines.slice(i + oldLines.length);
    return [...before, ...newLines, ...after].join("\n");
  }
  return null;
}

function makeDiff(before: string, after: string): string {
  const b = before.split("\n");
  const a = after.split("\n");
  const out: string[] = [];
  const max = Math.max(b.length, a.length);
  for (let i = 0; i < max; i++) {
    if (b[i] === a[i]) continue;
    if (b[i] !== undefined) out.push(`- ${b[i]}`);
    if (a[i] !== undefined) out.push(`+ ${a[i]}`);
  }
  return out.join("\n");
}
