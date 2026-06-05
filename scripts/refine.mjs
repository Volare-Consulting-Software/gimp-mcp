// Drive the built session-based MCP server over stdio, composing ATOMIC GIMP
// tools (like a user in the GIMP UI) to: open the real logo, knock out its
// background with the fuzzy-select tool, and add a Times New Roman caption.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SRC = "C:/Users/admin/Desktop/lyw9406w53bi1cwrbkw7efgk.png";
const OUT = "C:/Users/admin/Desktop/super_diego_final.png";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
});
const client = new Client({ name: "refine", version: "0.0.0" });
await client.connect(transport);
const text = (r) => r.content.map((c) => c.text).join("\n");
const call = async (name, args = {}, ms = 120000) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: ms });
  const t = text(r);
  console.log(`${r.isError ? "ERR " : "ok  "}${name}: ${t}`);
  if (r.isError) throw new Error(`${name} failed: ${t}`);
  return t;
};
const idFrom = (s) => parseInt(s.match(/\b(\d+)\b/)[1], 10);

try {
  const img = idFrom(await call("open_image", { path: SRC })); // session warms (~40s first time)
  await call("get_image_info", { imageId: img });
  const W = 1408, H = 768;

  // Make the background transparent — the exact GIMP steps, as atomic tools:
  await call("add_alpha_channel", { imageId: img });
  await call("fuzzy_select", { imageId: img, x: 4, y: 4, threshold: 0.22 });
  await call("fuzzy_select", { imageId: img, x: W - 4, y: 4, threshold: 0.22, mode: "add" });
  await call("fuzzy_select", { imageId: img, x: 4, y: H - 4, threshold: 0.22, mode: "add" });
  await call("fuzzy_select", { imageId: img, x: W - 4, y: H - 4, threshold: 0.22, mode: "add" });
  await call("edit_clear", { imageId: img });
  await call("select_none", { imageId: img });

  // Add the caption with a specific font, then merge keeping transparency.
  await call("add_text_layer", {
    imageId: img,
    text: "Super Diego",
    font: "Times New Roman",
    fontSize: 76,
    color: "#161616",
    x: 430,
    y: 672,
  });
  await call("merge_visible", { imageId: img });
  await call("export_image", { imageId: img, path: OUT });
  console.log("\nDONE ->", OUT);
} catch (e) {
  console.log("\nWORKFLOW FAILED:", e.message);
} finally {
  await call("end_session").catch(() => {});
  await client.close();
  process.exit(0);
}
