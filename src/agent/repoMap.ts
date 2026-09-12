import { promises as fs } from "node:fs";
import path from "node:path";

export interface RepoMap {
  cwd: string;
  framework: string;
  language: string;
  fileCount: number;
  topLevelDirs: string[];
  topLevelFiles: string[];
  packageScripts: string[];
  detectedLibs: string[];
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
  ".parcel-cache",
]);

async function countFiles(dir: string, depth = 0): Promise<number> {
  if (depth > 6) return 0;
  let total = 0;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.isDirectory()) {
        total += await countFiles(path.join(dir, entry.name), depth + 1);
      } else {
        total += 1;
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return total;
}

export async function scanRepo(cwd = process.cwd()): Promise<RepoMap> {
  const topLevelDirs: string[] = [];
  const topLevelFiles: string[] = [];

  try {
    for (const entry of await fs.readdir(cwd, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) topLevelDirs.push(entry.name);
      else topLevelFiles.push(entry.name);
    }
  } catch {
    // partial map is fine
  }

  let packageScripts: string[] = [];
  let dependencies: Record<string, string> = {};
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf8"),
    );
    packageScripts = Object.keys(pkg.scripts ?? {});
    dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    // non-Node project
  }

  const has = (name: string) => Boolean(dependencies[name]);
  const framework = has("next")
    ? "Next.js"
    : has("react")
      ? "React"
      : has("vue")
        ? "Vue"
        : has("svelte")
          ? "Svelte"
          : has("express")
            ? "Express"
            : "Unknown";

  const detectedLibs = Object.keys(dependencies).filter((dep) =>
    [
      "tailwindcss",
      "redux",
      "@reduxjs/toolkit",
      "zustand",
      "mobx",
      "react-query",
      "@tanstack/react-query",
      "prisma",
      "mongoose",
      "sequelize",
      "jest",
      "vitest",
      "mocha",
    ].includes(dep),
  );

  const fileCount = await countFiles(cwd);

  // Detect language by presence of file extensions in top-level or src/
  let language = "Unknown";
  const probe = [cwd, path.join(cwd, "src")];
  for (const dir of probe) {
    try {
      const entries = await fs.readdir(dir);
      if (entries.some((e) => e.endsWith(".ts") || e.endsWith(".tsx"))) {
        language = "TypeScript";
        break;
      }
      if (entries.some((e) => e.endsWith(".js") || e.endsWith(".jsx"))) {
        language = "JavaScript";
        break;
      }
      if (entries.some((e) => e.endsWith(".py"))) {
        language = "Python";
        break;
      }
    } catch {
      // skip
    }
  }

  return {
    cwd,
    framework,
    language,
    fileCount,
    topLevelDirs,
    topLevelFiles,
    packageScripts,
    detectedLibs,
  };
}

export function formatRepoMap(map: RepoMap): string {
  return [
    "── REPOSITORY SUMMARY ──",
    `Framework: ${map.framework} / ${map.language}`,
    `Working directory: ${map.cwd}`,
    `File count (excluding node_modules, dist): ${map.fileCount}`,
    map.packageScripts.length
      ? `Package scripts: ${map.packageScripts.join(", ")}`
      : "Package scripts: none",
    map.detectedLibs.length
      ? `Detected libraries: ${map.detectedLibs.join(", ")}`
      : "",
    map.topLevelDirs.length
      ? `Top-level dirs: ${map.topLevelDirs.join(", ")}`
      : "",
    map.topLevelFiles.length
      ? `Top-level files: ${map.topLevelFiles.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
