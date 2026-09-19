import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../../version.js";

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(here, "../../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

  if (VERSION !== pkg.version) {
    console.error(
      `❌ Version mismatch: VERSION="${VERSION}" package.json="${pkg.version}"`,
    );
    process.exit(1);
  }
  console.log(`✅ Version matches: ${VERSION}`);
}

main();
