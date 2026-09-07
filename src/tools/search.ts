import { promises as fs } from "node:fs";
import path from "node:path";

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}
export async function searchCode(
  query: string,
  directory = ".",
): Promise<string> {
  const result: string[] = [];
  for (const file of await walk(path.resolve(process.cwd(), directory))) {
    try {
      const lines = (await fs.readFile(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(query.toLowerCase()))
          result.push(
            `${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`,
          );
      });
    } catch {
      /* binary or unreadable */
    }
    if (result.length >= 100) break;
  }
  return result.join("\n") || "No matches found.";
}
