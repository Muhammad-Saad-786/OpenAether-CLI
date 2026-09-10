import { AgentSession } from "../AgentSession.js";
import { AgentLoop } from "../AgentLoop.js";
import type { ChatProvider } from "../../provider/client.js";
import type { Message } from "../../provider/types.js";
import type { AgentEvent, ToolResult } from "../types.js";

/**
 * Minimal in-memory registry for the test. Avoids filesystem / providers.
 */
class FakeRegistry {
  private tools = new Map<string, any>();
  register(tool: any) {
    this.tools.set(tool.name, tool);
  }
  get(name: string) {
    return this.tools.get(name);
  }
  getAll() {
    return [...this.tools.values()];
  }
  toOpenAIFormat() {
    return this.getAll().map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.get(name);
    if (!tool) return `Unknown tool: ${name}`;
    const r: ToolResult = await tool.execute(args);
    return r.summary;
  }
}

/**
 * A scripted provider that returns pre-canned chunks.
 */
function scriptedProvider(scripts: any[][]): ChatProvider {
  let call = 0;
  return {
    async *stream(_messages: Message[]) {
      const chunks = scripts[call++] ?? [];
      for (const c of chunks) yield c;
    },
    async complete() {
      throw new Error("not used");
    },
  } as unknown as ChatProvider;
}

function textChunk(text: string) {
  return { choices: [{ delta: { content: text } }] };
}

function toolChunk(index: number, id: string, name: string, argsChunk: string) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [{ index, id, function: { name, arguments: argsChunk } }],
        },
      },
    ],
  };
}

async function collect(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

async function main() {
  // ─── Test 1: plain chat → no tools → done ─────────────────
  {
    const registry = new FakeRegistry();
    const session = new AgentSession(registry as any, {
      systemPrompt: "test",
      model: "test-model",
      maxTokens: 100,
      temperature: 0,
    });
    const provider = scriptedProvider([[textChunk("Hi there!")]]);
    const loop = new AgentLoop(session, provider, {
      maxIterations: 3,
      maxToolRoundsWithoutProgress: 2,
      verbose: false,
    });
    const events = await collect(loop.run("hello"));
    const done = events.find((e) => e.type === "done");
    if (!done) throw new Error("Test 1 failed: no done event");
    if (!events.some((e) => e.type === "assistant_text"))
      throw new Error("Test 1: no text");
    console.log("✅ Test 1 passed (plain chat)");
  }

  // ─── Test 2: one tool call, then finish ───────────────────
  {
    const registry = new FakeRegistry();
    registry.register({
      name: "read_file",
      description: "read",
      sideEffect: "read",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        return {
          ok: true,
          toolName: "read_file",
          toolCallId: "x",
          summary: "file content",
          data: { path: "a.ts" },
        };
      },
    });
    const session = new AgentSession(registry as any, {
      systemPrompt: "test",
      model: "test-model",
      maxTokens: 100,
      temperature: 0,
    });
    const provider = scriptedProvider([
      [toolChunk(0, "c1", "read_file", "{}")],
      [textChunk("The file contains X.")],
    ]);
    const loop = new AgentLoop(session, provider, {
      maxIterations: 3,
      maxToolRoundsWithoutProgress: 2,
      verbose: false,
    });
    const events = await collect(loop.run("read a.ts"));
    if (!events.some((e) => e.type === "tool_call_start"))
      throw new Error("Test 2: no tool call event");
    if (!events.some((e) => e.type === "tool_result"))
      throw new Error("Test 2: no tool result");
    if (!events.some((e) => e.type === "done"))
      throw new Error("Test 2: no done");
    console.log("✅ Test 2 passed (single tool)");
  }

  // ─── Test 3: done() tool exits loop ───────────────────────
  {
    const registry = new FakeRegistry();
    registry.register({
      name: "done",
      description: "finish",
      sideEffect: "meta",
      parameters: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: [],
      },
      async execute(args: any) {
        return {
          ok: true,
          toolName: "done",
          toolCallId: "x",
          summary: "done",
          data: args,
        };
      },
    });
    const session = new AgentSession(registry as any, {
      systemPrompt: "test",
      model: "test-model",
      maxTokens: 100,
      temperature: 0,
    });
    const provider = scriptedProvider([
      [toolChunk(0, "c1", "done", '{"summary":"all set"}')],
    ]);
    const loop = new AgentLoop(session, provider);
    const events = await collect(loop.run("do it"));
    const done = events.find((e) => e.type === "done");
    if (!done || !("summary" in done) || done.summary !== "all set")
      throw new Error("Test 3: done summary mismatch");
    console.log("✅ Test 3 passed (done tool)");
  }

  // ─── Test 4: no-progress termination ──────────────────────
  {
    const registry = new FakeRegistry();
    registry.register({
      name: "boom",
      description: "always fails",
      sideEffect: "exec",
      parameters: { type: "object", properties: {}, required: [] },
      async execute() {
        return {
          ok: false,
          toolName: "boom",
          toolCallId: "x",
          summary: "fail",
          error: "nope",
        };
      },
    });
    const session = new AgentSession(registry as any, {
      systemPrompt: "test",
      model: "test-model",
      maxTokens: 100,
      temperature: 0,
    });
    const provider = scriptedProvider([
      [toolChunk(0, "c1", "boom", "{}")],
      [toolChunk(0, "c2", "boom", "{}")],
      [toolChunk(0, "c3", "boom", "{}")],
    ]);
    const loop = new AgentLoop(session, provider, {
      maxIterations: 10,
      maxToolRoundsWithoutProgress: 2,
      verbose: false,
    });
    const events = await collect(loop.run("try"));
    const done = events.find((e) => e.type === "done");
    if (!done || !("summary" in done) || !done.summary.includes("No progress"))
      throw new Error("Test 4: expected no-progress termination");
    console.log("✅ Test 4 passed (no-progress termination)");
  }

  console.log("\n🎉 All agent loop tests passed.");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
