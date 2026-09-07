import type { Message } from "../provider/types.js";

export class Session {
  readonly messages: Message[];

  constructor(systemPrompt: string) {
    this.messages = [{ role: "system", content: systemPrompt }];
  }

  add(message: Message): void {
    this.messages.push(message);
  }
  addUser(content: string): void {
    this.add({ role: "user", content });
  }
  addToolResult(toolCallId: string, content: string, name?: string): void {
    this.add({ role: "tool", content, tool_call_id: toolCallId, name });
  }
}
