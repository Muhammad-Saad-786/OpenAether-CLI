import { promises as fs } from "node:fs";
import path from "node:path";
import { fail, ok, type Tool, type ToolResult } from "./types.js";

type Input = {
  path: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
};

export class FileEditTool implements Tool<Input> {
  name = "edit_file";
  description = "Make a targeted string replacement in a text file.";
  parameters = {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      oldText: { type: "string", description: "Exact text to replace" },
      newText: { type: "string", description: "Replacement text" },
      replaceAll: { type: "boolean", description: "Replace every occurrence" },
    },
    required: ["path", "oldText", "newText"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      if (!input.oldText) return fail("oldText must not be empty");
      const filePath = path.resolve(input.path);
      const original = await fs.readFile(filePath, "utf8");
      const occurrences = original.split(input.oldText).length - 1;
      if (occurrences === 0) return fail("oldText was not found");
      if (!input.replaceAll && occurrences > 1)
        return fail(
          `oldText matched ${occurrences} times; provide a unique block or set replaceAll`,
        );
      const updated = input.replaceAll
        ? original.replaceAll(input.oldText, input.newText)
        : original.replace(input.oldText, input.newText);
      await fs.writeFile(filePath, updated, "utf8");
      return ok(
        `Edited ${filePath}; replaced ${input.replaceAll ? occurrences : 1} occurrence${occurrences === 1 ? "" : "s"}`,
      );
    } catch (error) {
      return fail(error);
    }
  }
}
