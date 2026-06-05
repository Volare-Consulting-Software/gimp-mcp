// Throwaway smoke test: spin up the built server over stdio, list tools,
// and call gimp_doctor. Not part of the published package.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
});
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(`TOOL COUNT: ${tools.tools.length}`);
console.log(tools.tools.map((t) => t.name).sort().join(", "));

const doctor = await client.callTool({ name: "gimp_doctor", arguments: {} });
console.log("\n--- gimp_doctor ---");
console.log(doctor.content.map((c) => c.text).join("\n"));

const install = await client.callTool({ name: "install_gimp", arguments: {} });
console.log("\n--- install_gimp (instructions) ---");
console.log(install.content.map((c) => c.text).join("\n"));

await client.close();
process.exit(0);
