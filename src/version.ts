import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Read the package version at runtime from the nearest package.json.
 * This keeps `openaether --version` in sync with what was actually published,
 * so it can never drift from the npm metadata.
 */
function readVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    let dir = here;

    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, "package.json");
      try {
        const raw = readFileSync(candidate, "utf8");
        const pkg = JSON.parse(raw) as { version?: string; name?: string };
        if (pkg.name === "openaether" && pkg.version) {
          return pkg.version;
        }
      } catch {
        // keep walking up
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through
  }
  return "unknown";
}

export const VERSION = readVersion();
