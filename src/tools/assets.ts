import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
]);

type Input = { action: "inventory" | "prepare"; directory?: string };

export class AssetsTool implements Tool<Input> {
  name = "assets";
  description =
    "Inventory existing image assets or prepare a standard public/assets directory for frontend work. Reuse existing assets before adding placeholders.";
  sideEffect = "write" as const;
  parameters = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["inventory", "prepare"] },
      directory: {
        type: "string",
        description:
          "Workspace-relative asset directory, defaults to public/assets.",
      },
    },
    required: ["action"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      const directory = input.directory ?? "public/assets";
      const assetPath = workspacePath(directory);
      await fs.mkdir(assetPath, { recursive: true });
      const entries = await fs.readdir(assetPath, { withFileTypes: true });
      const assets = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
        )
        .map((entry) => path.join(directory, entry.name).replaceAll("\\", "/"));
      return {
        ok: true,
        toolName: this.name,
        toolCallId: "",
        summary:
          input.action === "prepare"
            ? `Prepared ${directory} (${assets.length} existing assets)`
            : `Found ${assets.length} image assets in ${directory}`,
        data: { directory, assets, prepared: true },
      };
    } catch (error) {
      return fail(error);
    }
  }
}
