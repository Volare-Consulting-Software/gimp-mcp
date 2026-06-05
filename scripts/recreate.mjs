// Smoke test: drive the built gimp-mcp server over stdio and recreate a
// black-dog-head-with-cape logo FROM SCRATCH (no source image opened), using
// the run_script_fu tool to draw vector shapes, then report image info.
import { readFileSync } from "node:fs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const OUT = "C:/Users/admin/Desktop/dog_recreated.png";
const script = readFileSync("tmp-out/dog.scm", "utf8").replace(
  "C:/git/gimp-mcp/tmp-out/dog.png",
  OUT,
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
});
const client = new Client({ name: "recreate", version: "0.0.0" });
await client.connect(transport);
const text = (r) => r.content.map((c) => c.text).join("\n");

console.log("--- gimp_doctor ---");
console.log(text(await client.callTool({ name: "gimp_doctor", arguments: {} })));

console.log("\n--- run_script_fu (drawing the logo) ---");
const draw = await client.callTool(
  { name: "run_script_fu", arguments: { script } },
  undefined,
  { timeout: 120000 },
);
console.log(`isError: ${Boolean(draw.isError)}`);
console.log(text(draw).slice(0, 400));

console.log("\n--- get_image_info ---");
console.log(text(await client.callTool({ name: "get_image_info", arguments: { inputPath: OUT } })));

await client.close();
process.exit(0);
