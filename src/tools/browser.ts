import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { fail, type Tool, type ToolResult } from "./types.js";
import { workspacePath } from "./workspace.js";

type Input = {
  action: "inspect" | "screenshot" | "accessibility" | "visual_diff";
  url: string;
  path?: string;
  baseline?: string;
  fullPage?: boolean;
  width?: number;
  height?: number;
};

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

async function withPage<T>(url: string, work: (page: Page) => Promise<T>, viewport = { width: 1440, height: 900 }): Promise<T> {
  const context = await (await getBrowser()).newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    return await work(page);
  } finally {
    await context.close();
  }
}

export class BrowserTool implements Tool<Input> {
  name = "browser";
  description =
    "Inspect a running web app. Capture screenshots, inspect rendered DOM, run basic accessibility checks, or compare a screenshot with a baseline.";
  sideEffect = "exec" as const;
  parameters = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["inspect", "screenshot", "accessibility", "visual_diff"] },
      url: { type: "string", description: "Local or remote URL to inspect." },
      path: { type: "string", description: "Workspace-relative screenshot output path." },
      baseline: { type: "string", description: "Workspace-relative baseline screenshot path." },
      fullPage: { type: "boolean", description: "Capture the full page instead of the viewport." },
      width: { type: "number", description: "Viewport width, defaults to 1440." },
      height: { type: "number", description: "Viewport height, defaults to 900." },
    },
    required: ["action", "url"],
  };

  async execute(input: Input): Promise<ToolResult> {
    try {
      if (input.action === "inspect") {
              const result = await withPage(input.url, async (page) => ({
          title: await page.title(),
          url: page.url(),
          text: (await page.locator("body").innerText()).slice(0, 12_000),
          headings: await page.locator("h1,h2,h3").allTextContents(),
          links: await page.locator("a").count(),
          buttons: await page.locator("button").count(),
                consoleErrors: [],
        }), viewportFor(input));
        return { ok: true, toolName: this.name, toolCallId: "", summary: `Inspected ${input.url}`, data: result };
      }

      if (input.action === "accessibility") {
        const result = await withPage(input.url, async (page) => {
                const issues = await page.evaluate(() => {
            const findings: string[] = [];
            document.querySelectorAll("img").forEach((img) => { if (!img.getAttribute("alt")) findings.push(`Image missing alt: ${img.getAttribute("src") ?? "unknown"}`); });
            document.querySelectorAll("button,a,input,select,textarea").forEach((el) => {
              const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el as HTMLElement).innerText || (el as HTMLInputElement).placeholder;
              if (!labelled) findings.push(`${el.tagName.toLowerCase()} has no accessible label`);
            });
            if (!document.querySelector("main, [role=main]")) findings.push("Page has no main landmark");
            if (!document.querySelector("h1")) findings.push("Page has no h1 heading");
            return findings;
          });
          return { issues, passed: issues.length === 0 };
        }, viewportFor(input));
        return { ok: result.passed, toolName: this.name, toolCallId: "", summary: result.passed ? "Basic accessibility audit passed" : `${result.issues.length} accessibility issue(s) found`, data: result, error: result.passed ? undefined : result.issues.join("; ") };
      }

      const output = input.path ?? `artifacts/${Date.now()}.png`;
      const outputPath = workspacePath(output);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      const buffer = await withPage(input.url, (page) => page.screenshot({ path: outputPath, fullPage: input.fullPage ?? true }), viewportFor(input));
      const currentHash = createHash("sha256").update(buffer).digest("hex");

      if (input.action === "visual_diff") {
        if (!input.baseline) return fail("baseline is required for visual_diff");
        const baselinePath = workspacePath(input.baseline);
        const baseline = await fs.readFile(baselinePath);
        const baselineHash = createHash("sha256").update(baseline).digest("hex");
        const same = currentHash === baselineHash;
        return { ok: same, toolName: this.name, toolCallId: "", summary: same ? "Visual regression passed" : `Visual regression detected; screenshot saved to ${output}`, data: { output, baseline: input.baseline, same, currentHash, baselineHash }, error: same ? undefined : "Screenshot bytes differ from baseline" };
      }
      return { ok: true, toolName: this.name, toolCallId: "", summary: `Screenshot saved to ${output}`, data: { output, sha256: currentHash } };
    } catch (error) {
      return fail(error instanceof Error && /Executable doesn't exist|browserType.launch/.test(error.message) ? `${error.message}. Run npx playwright install chromium.` : error);
    }
  }
}

function viewportFor(input: Input): { width: number; height: number } {
  return {
    width: Math.max(320, Math.min(2560, input.width ?? 1440)),
    height: Math.max(480, Math.min(1600, input.height ?? 900)),
  };
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}
