import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const historyPath = path.join(os.homedir(), ".openaether", "history");
export async function loadHistory(): Promise<string[]> {
  try {
    return (await fs.readFile(historyPath, "utf8")).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
export async function appendHistory(prompt: string): Promise<void> {
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.appendFile(historyPath, `${prompt.replaceAll("\n", " ")}\n`, "utf8");
}
