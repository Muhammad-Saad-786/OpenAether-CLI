import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = {
  sources: string[];
  target: string;
  separator?: string;
  overwrite?: boolean;
};

export class MergeTool implements Tool<Input> {
  name = "merge_files";
  description = "Combine text files in order into a target file.";
  sideEffect = "write" as const;

  parameters = {
    type: "object",
    properties: {
      sources: {
        type: "array",
        items: { type: "string" },
        description: "Source file paths in merge order",
      },
      target: { type: "string", description: "Destination file path" },
      separator: {
        type: "string",
        description: "Text inserted between source files",
      },
      overwrite: {
        type: "boolean",
        description: "Allow replacing an existing target",
      },
    },
    required: ["sources", "target"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      if (input.sources.length === 0)
        return fail("At least one source file is required");
      const target = workspacePath(input.target);
      const targetExists = await fs
        .stat(target)
        .then(() => true)
        .catch(() => false);
      if (targetExists && input.overwrite !== true) {
        return fail("Target already exists; set overwrite=true to replace it");
      }
      const contents = await Promise.all(
        input.sources.map(async (source) => {
          const sourcePath = workspacePath(source);
          if (sourcePath === target)
            throw new Error("Target cannot also be a source file");
          return fs.readFile(sourcePath, "utf8");
        }),
      );
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(
        target,
        contents.join(input.separator ?? "\n"),
        "utf8",
      );
      return ok(`Merged ${input.sources.length} files into ${target}`);
    } catch (error) {
      return fail(error);
    }
  }
}
