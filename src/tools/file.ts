import { promises as fs } from "node:fs";
import path from "node:path";

const safePath = (filePath: string) => path.resolve(process.cwd(), filePath);
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(safePath(filePath), "utf8");
}
export async function writeFile(
  filePath: string,
  content: string,
): Promise<string> {
  await fs.writeFile(safePath(filePath), content, "utf8");
  return `Wrote ${filePath}`;
}
export async function editFile(
  filePath: string,
  oldText: string,
  newText: string,
): Promise<string> {
  const fullPath = safePath(filePath);
  const content = await fs.readFile(fullPath, "utf8");
  if (!content.includes(oldText)) throw new Error("oldText was not found");
  await fs.writeFile(fullPath, content.replace(oldText, newText), "utf8");
  return `Edited ${filePath}`;
}
