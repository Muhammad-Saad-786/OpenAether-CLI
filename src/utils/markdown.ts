export function cleanMarkdown(text: string): string {
  if (!text) return "";

  return (
    text
      // Remove code blocks and extract content
      .replace(/```\w*\n?([\s\S]*?)```/g, "\n$1\n")
      // Remove inline code markers
      .replace(/`([^`]+)`/g, "$1")
      // Remove bold markers
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      // Remove italic markers
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bullet points
      .replace(/^\s*[-*+]\s+/gm, "• ")
      // Remove ordered list numbers
      .replace(/^\s*\d+\.\s+/gm, "")
      // Remove links
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      // Remove horizontal rules
      .replace(/^\s*[-*_]{3,}\s*$/gm, "")
      // Remove blockquotes
      .replace(/^\s*>\s?/gm, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, "")
      // Clean up extra newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
