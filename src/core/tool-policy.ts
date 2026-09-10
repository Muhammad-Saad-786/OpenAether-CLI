const TOOL_INTENT =
  /\b(create|write|edit|update|modify|delete|remove|read|open|find|search|grep|glob|run|execute|build|test|debug|generate|implement|fix|add|install|move|rename|make|code|file|folder|directory|project|test\.ts)\b/i;

export function shouldUseTools(prompt: string): boolean {
  return TOOL_INTENT.test(prompt);
}

const ALLOWED_TOOLS = new Set([
  "read_file",
  "write_file",
  "edit_file",
  "delete_file",
  "grep",
  "glob",
  "bash",
  "merge_files",
]);

export function isAllowedTool(name: string): boolean {
  return ALLOWED_TOOLS.has(name);
}

export function requestedFilePaths(prompt: string): string[] {
  const matches =
    prompt.match(/(?:^|[\s`"'])([\w./\\-]+\.[a-z0-9]+)(?=$|[\s`"'])/gi) ?? [];
  return [
    ...new Set(matches.map((match) => match.trim().replace(/["'`]/g, ""))),
  ];
}

export function toolNamesForPrompt(prompt: string): string[] {
  if (requestedFilePaths(prompt).length > 0) {
    return ["read_file", "write_file", "edit_file", "delete_file", "bash"];
  }
  return [
    "read_file",
    "write_file",
    "edit_file",
    "delete_file",
    "grep",
    "glob",
    "bash",
    "merge_files",
  ];
}
