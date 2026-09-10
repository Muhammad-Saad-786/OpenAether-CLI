import path from "node:path";

export function workspacePath(inputPath: string): string {
  const root = path.resolve(process.cwd());
  const resolved = path.resolve(root, inputPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path must remain inside the current workspace");
  }
  return resolved;
}
