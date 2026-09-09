import { promises as fs } from "node:fs";
import path from "node:path";

export interface ProjectMap {
  cwd: string;
  framework: string;
  language: string;
  files: string[];
  packageScripts: string[];
}

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
]);

async function collectFiles(
  directory: string,
  root: string,
  result: string[],
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolute, root, result);
    } else if (result.length < 500) {
      result.push(path.relative(root, absolute));
    }
  }
}

export async function inspectProject(cwd = process.cwd()): Promise<ProjectMap> {
  const files: string[] = [];
  try {
    await collectFiles(cwd, cwd, files);
  } catch {
    // The agent can still operate with a partial project map.
  }

  let packageScripts: string[] = [];
  let dependencies: Record<string, string> = {};
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    packageScripts = Object.keys(packageJson.scripts ?? {});
    dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
  } catch {
    // Non-Node projects are valid agent workspaces.
  }

  const has = (name: string) =>
    Boolean(dependencies[name]) || files.some((file) => file.includes(name));
  const framework = has("next")
    ? "Next.js"
    : has("react")
      ? "React"
      : has("vue")
        ? "Vue"
        : has("express")
          ? "Express"
          : files.some((file) => file.endsWith(".py"))
            ? "Python"
            : "Unknown";
  const language = files.some((file) => /\.(ts|tsx)$/.test(file))
    ? "TypeScript"
    : files.some((file) => file.endsWith(".js"))
      ? "JavaScript"
      : files.some((file) => file.endsWith(".py"))
        ? "Python"
        : "Unknown";

  return { cwd, framework, language, files, packageScripts };
}

export function formatProjectMap(project: ProjectMap, maxFiles = 120): string {
  return [
    `Project: ${project.framework} / ${project.language}`,
    `Working directory: ${project.cwd}`,
    `Available scripts: ${project.packageScripts.join(", ") || "none"}`,
    `Files:\n${project.files.slice(0, maxFiles).join("\n") || "none"}`,
  ].join("\n");
}
