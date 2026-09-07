import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Message } from "../provider/types.js";

const sessionDir = path.join(os.homedir(), ".openaether", "sessions");
export async function saveSession(
  id: string,
  messages: Message[],
): Promise<void> {
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionDir, `${id}.json`),
    JSON.stringify(messages, null, 2),
    "utf8",
  );
}
export async function loadSession(id: string): Promise<Message[]> {
  return JSON.parse(
    await fs.readFile(path.join(sessionDir, `${id}.json`), "utf8"),
  ) as Message[];
}
