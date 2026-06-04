// Real end-to-end verification against an installed GIMP. Creates a test
// image, runs a battery of tools, and reports pass/fail per tool.
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const OUT = join(process.cwd(), "tmp-out");
try {
  rmSync(OUT, { recursive: true, force: true });
} catch {
  // A previous (timed-out) GIMP may still hold a handle; reuse the dir.
}
mkdirSync(OUT, { recursive: true });

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: { ...process.env, GIMP_MCP_TIMEOUT_MS: "45000" },
});
const client = new Client({ name: "verify", version: "0.0.0" });
await client.connect(transport);

const text = (r) => r.content.map((c) => c.text).join("\n");

async function call(name, args) {
  try {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60000 });
    return { ok: !r.isError, out: text(r) };
  } catch (err) {
    return { ok: false, out: `client error: ${err?.message ?? String(err)}` };
  }
}

const src = join(OUT, "src.png");

// 1) Build a test image with run_script_fu (GIMP 3.x PDB).
const srcEsc = src.replace(/\\/g, "\\\\");
const createScript = `
(let* ((image (car (gimp-image-new 200 120 RGB)))
       (layer (car (gimp-layer-new image "bg" 200 120 RGB-IMAGE 100 LAYER-MODE-NORMAL))))
  (gimp-image-insert-layer image layer 0 -1)
  (gimp-context-set-foreground '(60 120 200))
  (gimp-drawable-fill layer FILL-FOREGROUND)
  (gimp-image-flatten image)
  (gimp-file-save RUN-NONINTERACTIVE image "${srcEsc}")
  (gimp-image-delete image))`;

const created = await call("run_script_fu", { script: createScript });
console.log(`create test image: ${created.ok && existsSync(src) ? "OK" : "FAIL"}`);
if (!created.ok) console.log(created.out);

const info = await call("get_image_info", { inputPath: src });
console.log(`get_image_info: ${info.ok ? "OK" : "FAIL"}\n${info.out}\n`);

// 2) Battery of operations, each to its own output file.
const cases = [
  ["resize", { inputPath: src, outputPath: join(OUT, "resize.png"), width: 100, height: 60 }],
  ["scale_to_fit", { inputPath: src, outputPath: join(OUT, "fit.png"), maxWidth: 80, maxHeight: 80 }],
  ["crop", { inputPath: src, outputPath: join(OUT, "crop.png"), width: 50, height: 50, offsetX: 10, offsetY: 10 }],
  ["rotate", { inputPath: src, outputPath: join(OUT, "rot90.png"), degrees: 90 }],
  ["rotate", { inputPath: src, outputPath: join(OUT, "rot45.png"), degrees: 45 }],
  ["flip", { inputPath: src, outputPath: join(OUT, "flip.png"), direction: "horizontal" }],
  ["convert_format", { inputPath: src, outputPath: join(OUT, "out.jpg") }],
  ["convert_format", { inputPath: src, outputPath: join(OUT, "out.webp") }],
  ["make_thumbnail", { inputPath: src, outputPath: join(OUT, "thumb.png"), size: 64 }],
  ["brightness_contrast", { inputPath: src, outputPath: join(OUT, "bc.png"), brightness: 0.2, contrast: 0.1 }],
  ["levels", { inputPath: src, outputPath: join(OUT, "levels.png"), gamma: 1.2 }],
  ["gamma", { inputPath: src, outputPath: join(OUT, "gamma.png"), value: 1.5 }],
  ["hue_saturation", { inputPath: src, outputPath: join(OUT, "hue.png"), hue: 30, saturation: 20 }],
  ["color_balance", { inputPath: src, outputPath: join(OUT, "cb.png"), cyanRed: 20 }],
  ["desaturate", { inputPath: src, outputPath: join(OUT, "desat.png") }],
  ["grayscale", { inputPath: src, outputPath: join(OUT, "gray.png") }],
  ["invert", { inputPath: src, outputPath: join(OUT, "invert.png") }],
  ["posterize", { inputPath: src, outputPath: join(OUT, "poster.png"), levels: 4 }],
  ["threshold", { inputPath: src, outputPath: join(OUT, "thresh.png"), low: 0.4 }],
  ["stretch_contrast", { inputPath: src, outputPath: join(OUT, "stretch.png") }],
  ["gaussian_blur", { inputPath: src, outputPath: join(OUT, "blur.png"), radius: 4 }],
  ["sharpen", { inputPath: src, outputPath: join(OUT, "sharp.png"), amount: 0.6 }],
  ["median_blur", { inputPath: src, outputPath: join(OUT, "median.png"), radius: 2 }],
  ["pixelize", { inputPath: src, outputPath: join(OUT, "pixel.png"), blockSize: 8 }],
  ["oilify", { inputPath: src, outputPath: join(OUT, "oil.png"), maskSize: 6 }],
  ["emboss", { inputPath: src, outputPath: join(OUT, "emboss.png") }],
  ["edge_detect", { inputPath: src, outputPath: join(OUT, "edge.png"), amount: 2 }],
  ["add_noise", { inputPath: src, outputPath: join(OUT, "noise.png"), amount: 20 }],
  ["add_text", { inputPath: src, outputPath: join(OUT, "text.png"), text: "Hi", x: 10, y: 10, fontSize: 24, color: "#ffffff" }],
  ["watermark_text", { inputPath: src, outputPath: join(OUT, "wmtext.png"), text: "(c)", opacity: 50, position: "bottom-right" }],
  ["watermark_image", { inputPath: src, outputPath: join(OUT, "wmimg.png"), watermarkPath: src, opacity: 40, position: "top-left" }],
  ["overlay_image", { inputPath: src, outputPath: join(OUT, "overlay.png"), overlayPath: src, x: 5, y: 5, opacity: 50 }],
  ["add_border", { inputPath: src, outputPath: join(OUT, "border.png"), width: 10, color: "#000000" }],
  ["flatten", { inputPath: src, outputPath: join(OUT, "flat.png") }],
];

let pass = 0;
const failures = [];
for (const [name, args] of cases) {
  const r = await call(name, args);
  const fileOk = args.outputPath ? existsSync(args.outputPath) : true;
  const good = r.ok && fileOk;
  if (good) {
    pass += 1;
  } else {
    failures.push(`${name}: ${r.out.split("\n")[0]}${!fileOk ? " [no output file]" : ""}`);
  }
  console.log(`${good ? "OK  " : "FAIL"} ${name}${args.outputPath ? " -> " + args.outputPath.split(/[\\/]/).pop() : ""}`);
}

console.log(`\n${pass}/${cases.length} passed.`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  " + f);
}

await client.close();
process.exit(failures.length ? 1 : 0);
