export function cleanMarkdown(text: string): string {
  return (
    text
      // Remove bold **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      // Remove italic *text* or _text_
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      // Remove inline code `text`
      .replace(/`([^`]+)`/g, "$1")
      // Remove headers # ## ### etc
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bullet points
      .replace(/^\s*[-*+]\s+/gm, "• ")
      // Remove ordered list numbers
      .replace(/^\s*\d+\.\s+/gm, "")
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      // Remove horizontal rules
      .replace(/^\s*[-*_]{3,}\s*$/gm, "")
      // Remove blockquotes
      .replace(/^\s*>\s?/gm, "")
      // Remove code block markers
      .replace(/```\w*\n?/g, "")
      .replace(/```/g, "")
      // Clean up extra newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function formatResponse(text: string): string {
  // Add colors for code blocks
  const lines = text.split("\n");
  let inCodeBlock = false;

  return lines
    .map((line) => {
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return inCodeBlock
          ? "\x1b[90m┌─────────────────────────────────────────┐\x1b[0m"
          : "\x1b[90m└─────────────────────────────────────────┘\x1b[0m";
      }
      if (inCodeBlock) {
        return `\x1b[90m ${line}\x1b[0m`;
      }
      return line;
    })
    .join("\n");
}
