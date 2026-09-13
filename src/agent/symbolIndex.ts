import { promises as fs } from "node:fs";
import path from "node:path";

export interface Symbol {
  name: string;
  kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "const"
    | "let"
    | "var"
    | "enum"
    | "method";
  file: string; // relative to workspace root
  line: number; // 1-indexed
  exported: boolean;
  signature?: string;
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
  ".turbo",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".rb",
]);

/**
 * Regex patterns for common declarations across languages. We keep these
 * deliberately loose — the goal is discovery, not perfect parsing.
 */
const PATTERNS: Array<{
  re: RegExp;
  kind: Symbol["kind"];
  exportedGroup?: boolean;
}> = [
  // JavaScript / TypeScript
  {
    re: /^\s*export\s+(?:async\s+)?function\s+(\w+)\s*\(/,
    kind: "function",
    exportedGroup: true,
  },
  { re: /^\s*export\s+class\s+(\w+)/, kind: "class", exportedGroup: true },
  {
    re: /^\s*export\s+interface\s+(\w+)/,
    kind: "interface",
    exportedGroup: true,
  },
  { re: /^\s*export\s+type\s+(\w+)/, kind: "type", exportedGroup: true },
  { re: /^\s*export\s+enum\s+(\w+)/, kind: "enum", exportedGroup: true },
  { re: /^\s*export\s+const\s+(\w+)/, kind: "const", exportedGroup: true },
  { re: /^\s*export\s+let\s+(\w+)/, kind: "let", exportedGroup: true },
  { re: /^\s*export\s+var\s+(\w+)/, kind: "var", exportedGroup: true },
  {
    re: /^\s*export\s+default\s+(?:async\s+)?function\s+(\w+)/,
    kind: "function",
    exportedGroup: true,
  },
  {
    re: /^\s*export\s+default\s+class\s+(\w+)/,
    kind: "class",
    exportedGroup: true,
  },

  { re: /^\s*(?:async\s+)?function\s+(\w+)\s*\(/, kind: "function" },
  { re: /^\s*class\s+(\w+)/, kind: "class" },
  { re: /^\s*interface\s+(\w+)/, kind: "interface" },
  { re: /^\s*type\s+(\w+)\s*=/, kind: "type" },
  { re: /^\s*enum\s+(\w+)/, kind: "enum" },

  // Methods inside classes (4-space or tab indented)
  { re: /^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/, kind: "method" },

  // Python
  { re: /^\s*def\s+(\w+)\s*\(/, kind: "function" },
  { re: /^\s*class\s+(\w+)\s*[:(]/, kind: "class" },

  // Go
  { re: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/, kind: "function" },
  { re: /^\s*type\s+(\w+)\s+struct/, kind: "class" },

  // Rust
  { re: /^\s*pub\s+fn\s+(\w+)/, kind: "function", exportedGroup: true },
  { re: /^\s*fn\s+(\w+)/, kind: "function" },
  { re: /^\s*pub\s+struct\s+(\w+)/, kind: "class", exportedGroup: true },
  { re: /^\s*struct\s+(\w+)/, kind: "class" },
];

function isSource(file: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function extractSymbols(filePath: string, relPath: string): Symbol[] {
  const symbols: Symbol[] = [];
  let content: string;
  try {
    content = require("node:fs").readFileSync(filePath, "utf8");
  } catch {
    return symbols;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { re, kind, exportedGroup } of PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      const name = m[1];
      if (!name) continue;

      // Skip JS keywords that look like methods
      if (
        kind === "method" &&
        ["if", "for", "while", "switch", "return", "catch"].includes(name)
      ) {
        continue;
      }

      symbols.push({
        name,
        kind,
        file: relPath,
        line: i + 1,
        exported: Boolean(exportedGroup),
        signature: line.trim().slice(0, 120),
      });
      break; // first matching pattern wins
    }
  }

  return symbols;
}

export class SymbolIndex {
  private symbols = new Map<string, Symbol[]>(); // file → symbols
  private byName = new Map<string, Symbol[]>();
  private root: string;
  private built = false;

  constructor(root = process.cwd()) {
    this.root = root;
  }

  async build(): Promise<void> {
    this.symbols.clear();
    this.byName.clear();
    await this.walk(this.root);
    this.built = true;
  }

  private async walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(full);
      } else if (entry.isFile() && isSource(full)) {
        const rel = path.relative(this.root, full).replace(/\\/g, "/");
        const syms = extractSymbols(full, rel);
        if (syms.length) {
          this.symbols.set(rel, syms);
          for (const s of syms) {
            const list = this.byName.get(s.name) ?? [];
            list.push(s);
            this.byName.set(s.name, list);
          }
        }
      }
    }
  }

  /**
   * Re-scan a single file after it changes. Called by the loop when a
   * write_file / edit_file tool succeeds.
   */
  async refreshFile(relPath: string): Promise<void> {
    const normalized = relPath.replace(/\\/g, "/");

    // Drop old entries for this file.
    const old = this.symbols.get(normalized);
    if (old) {
      for (const s of old) {
        const list = this.byName.get(s.name);
        if (!list) continue;
        const filtered = list.filter((x) => x.file !== normalized);
        if (filtered.length) this.byName.set(s.name, filtered);
        else this.byName.delete(s.name);
      }
    }
    this.symbols.delete(normalized);

    const full = path.join(this.root, normalized);
    try {
      await fs.access(full);
    } catch {
      return; // file was deleted
    }

    const syms = extractSymbols(full, normalized);
    if (!syms.length) return;
    this.symbols.set(normalized, syms);
    for (const s of syms) {
      const list = this.byName.get(s.name) ?? [];
      list.push(s);
      this.byName.set(s.name, list);
    }
  }

  find(name: string): Symbol[] {
    return this.byName.get(name) ?? [];
  }

  search(pattern: string, max = 50): Symbol[] {
    let re: RegExp;
    try {
      re = new RegExp(pattern, "i");
    } catch {
      return [];
    }
    const seen = new Set<string>();
    const results: Symbol[] = [];
    for (const [, syms] of this.symbols) {
      for (const s of syms) {
        if (re.test(s.name) && !seen.has(`${s.file}:${s.line}:${s.name}`)) {
          seen.add(`${s.file}:${s.line}:${s.name}`);
          results.push(s);
          if (results.length >= max) return results;
        }
      }
    }
    return results;
  }

  getAll(): Symbol[] {
    const out: Symbol[] = [];
    for (const [, syms] of this.symbols) out.push(...syms);
    return out;
  }

  /** Top N exported symbols across the project, sorted by file path. */
  topExports(limit = 30): Symbol[] {
    const exported = this.getAll().filter((s) => s.exported);
    return exported.slice(0, limit);
  }

  get fileCount(): number {
    return this.symbols.size;
  }

  isBuilt(): boolean {
    return this.built;
  }
}
