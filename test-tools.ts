import { ToolRegistry } from "./src/tools/registry";

async function main() {
  console.log("Testing tools...");
  const registry = new ToolRegistry();
  const tools = registry.getAll();
  console.log(
    "Registered tools:",
    tools.map((t) => t.name),
  );

  // Test file reading
  const readTool = registry.get("read_file");
  if (readTool) {
    console.log("\nTesting read_file...");
    const result = await readTool.execute({ path: "./package.json" });
    console.log("Success:", result.ok);
    console.log(
      "Content preview:",
      String(result.data ?? "").substring(0, 200),
    );
  }

  // Test grep
  const grepTool = registry.get("grep");
  if (grepTool) {
    console.log("\nTesting grep...");
    const result = await grepTool.execute({
      pattern: "import",
      path: "./src",
      include: "*.ts",
    });
    console.log("Success:", result.ok);
    console.log("Matches found:", String(result.data ?? "").substring(0, 200));
  }
}

main().catch(console.error);
