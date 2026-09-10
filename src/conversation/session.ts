import type { Message } from "../provider/types.js";

export class Session {
  readonly messages: Message[];
  model: string;

  constructor(systemPrompt: string, model = "") {
    this.messages = [{ role: "system", content: systemPrompt }];
    this.model = model;
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

  clear(): void {
    const system = this.messages[0];
    this.messages.length = 0;
    if (system) this.messages.push(system);
  }
}
