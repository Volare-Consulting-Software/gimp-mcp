// Smoke test of the real use cases: drive the built gimp-mcp server over stdio
// to (1) draw a logo from scratch, (2) make its background transparent, and
// (3) add "Super Diego" in Times New Roman at the bottom — all via MCP tools.
import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const OUT = "C:/Users/admin/Desktop/super_diego.png";
const CREAM = "#F3EFE2";
const drawScript = readFileSync("tmp-out/dog2.scm", "utf8").replace(
  "C:/git/gimp-mcp/tmp-out/dog2.png",
  OUT,
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
});
const client = new Client({ name: "superdiego", version: "0.0.0" });
await client.connect(transport);
const text = (r) => r.content.map((c) => c.text).join("\n");
const call = (name, args, ms = 120000) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: ms });

console.log("1) draw logo from scratch (run_script_fu)");
const r1 = await call("run_script_fu", { script: drawScript });
console.log(`   isError=${Boolean(r1.isError)}  ${text(r1).split("\n").pop()}`);

console.log("2) make background transparent (make_transparent)");
const r2 = await call("make_transparent", { inputPath: OUT, color: CREAM, threshold: 0.18 });
console.log(`   isError=${Boolean(r2.isError)}  ${text(r2)}`);

console.log('3) add "Super Diego" in Times New Roman (add_text)');
const r3 = await call("add_text", {
  inputPath: OUT,
  text: "Super Diego",
  font: "Times New Roman",
  fontSize: 72,
  color: "#1a1a1a",
  x: 470,
  y: 672,
});
console.log(`   isError=${Boolean(r3.isError)}  ${text(r3)}`);

console.log("4) get_image_info");
console.log(text(await call("get_image_info", { inputPath: OUT })));

await client.close();
process.exit(0);
