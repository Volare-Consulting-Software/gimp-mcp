import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { num } from "../gimp/scriptfu.js";
import { colorList, guard, inputPath, outputPath, resolveOutput } from "./common.js";

export function registerTransparencyTools(server: McpServer): void {
  server.registerTool(
    "make_transparent",
    {
      title: "Make a colour transparent",
      description:
        "Make a solid background colour transparent by adding an alpha channel and clearing " +
        "every pixel matching the colour. Best for logos/icons on a flat background. Save " +
        "to a format that supports transparency (.png, .webp). `threshold` (0-1) widens the " +
        "colour match for anti-aliased edges.",
      inputSchema: {
        inputPath,
        outputPath,
        color: z
          .string()
          .default("#FFFFFF")
          .describe("Background colour to remove (#RRGGBB or r,g,b)."),
        threshold: z
          .number()
          .min(0)
          .max(1)
          .default(0.15)
          .describe("Colour-match tolerance, 0 (exact) to 1 (loose)."),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          "(gimp-layer-add-alpha drawable)",
          `(gimp-context-set-sample-threshold ${num(args.threshold)})`,
          `(gimp-image-select-color image CHANNEL-OP-REPLACE drawable ${colorList(args.color)})`,
          "(gimp-drawable-edit-clear drawable)",
          "(gimp-selection-none image)",
        ].join("\n");
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op,
          preserveAlpha: true,
        });
        return `Made ${args.color} transparent -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "add_alpha",
    {
      title: "Add an alpha channel",
      description:
        "Add an alpha (transparency) channel to the image without changing pixels. Useful " +
        "before compositing. Save to a format that supports transparency (.png, .webp).",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: "(gimp-layer-add-alpha drawable)",
          preserveAlpha: true,
        });
        return `Added alpha channel -> ${resolveOutput(args)}`;
      }),
  );
}
