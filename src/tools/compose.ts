import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { num, str } from "../gimp/scriptfu.js";
import { colorList, guard, inputPath, outputPath, resolveOutput } from "./common.js";

const positionSchema = z
  .enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"])
  .default("bottom-right")
  .describe("Where to place the overlay relative to the image.");

/** Build a Scheme cond that sets x/y for a positioned layer named `layerVar`. */
function positionExpr(
  position: string,
  layerVar: string,
  margin: number,
): string {
  const ww = `(car (gimp-drawable-get-width ${layerVar}))`;
  const wh = `(car (gimp-drawable-get-height ${layerVar}))`;
  const iw = "(car (gimp-image-get-width image))";
  const ih = "(car (gimp-image-get-height image))";
  const m = num(margin);
  const coords: Record<string, [string, string]> = {
    "top-left": [m, m],
    "top-right": [`(- ${iw} ${ww} ${m})`, m],
    "bottom-left": [m, `(- ${ih} ${wh} ${m})`],
    "bottom-right": [`(- ${iw} ${ww} ${m})`, `(- ${ih} ${wh} ${m})`],
    center: [`(quotient (- ${iw} ${ww}) 2)`, `(quotient (- ${ih} ${wh}) 2)`],
  };
  const [x, y] = coords[position] ?? coords["bottom-right"]!;
  return `(gimp-layer-set-offsets ${layerVar} ${x} ${y})`;
}

export function registerComposeTools(server: McpServer): void {
  server.registerTool(
    "add_text",
    {
      title: "Add text",
      description:
        "Draw text onto the image at (x, y) and flatten it in, using GIMP's current default " +
        'font. Colour accepts #RRGGBB or "r,g,b".',
      inputSchema: {
        inputPath,
        outputPath,
        text: z.string().describe("The text to render."),
        x: z.number().int().default(10),
        y: z.number().int().default(10),
        fontSize: z.number().positive().default(36),
        color: z.string().default("#000000").describe("Text colour (#RRGGBB or r,g,b)."),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(let ((tl (car (gimp-text-layer-new image ${str(args.text)} (car (gimp-context-get-font)) ${num(
            args.fontSize,
          )} UNIT-PIXEL))))`,
          "  (gimp-image-insert-layer image tl 0 -1)",
          `  (gimp-text-layer-set-color tl ${colorList(args.color)})`,
          `  (gimp-layer-set-offsets tl ${num(args.x)} ${num(args.y)}))`,
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Added text -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "watermark_text",
    {
      title: "Watermark with text",
      description:
        "Overlay semi-transparent text as a watermark at a chosen corner/center, then " +
        "flatten, using GIMP's current default font. opacity is 0-100.",
      inputSchema: {
        inputPath,
        outputPath,
        text: z.string(),
        fontSize: z.number().positive().default(36),
        color: z.string().default("#FFFFFF"),
        opacity: z.number().min(0).max(100).default(50),
        position: positionSchema,
        margin: z.number().int().min(0).default(20),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(let ((tl (car (gimp-text-layer-new image ${str(args.text)} (car (gimp-context-get-font)) ${num(
            args.fontSize,
          )} UNIT-PIXEL))))`,
          "  (gimp-image-insert-layer image tl 0 -1)",
          `  (gimp-text-layer-set-color tl ${colorList(args.color)})`,
          `  ${positionExpr(args.position, "tl", args.margin)}`,
          `  (gimp-layer-set-opacity tl ${num(args.opacity)}))`,
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Added text watermark -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "watermark_image",
    {
      title: "Watermark with an image",
      description:
        "Composite a watermark/logo image onto the base image at a chosen corner/center " +
        "with the given opacity (0-100), then flatten.",
      inputSchema: {
        inputPath,
        outputPath,
        watermarkPath: z.string().describe("Path to the watermark/logo image (PNG with alpha ideal)."),
        opacity: z.number().min(0).max(100).default(100),
        position: positionSchema,
        margin: z.number().int().min(0).default(20),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(let ((wm (car (gimp-file-load-layer RUN-NONINTERACTIVE image ${str(args.watermarkPath)}))))`,
          "  (gimp-image-insert-layer image wm 0 -1)",
          `  ${positionExpr(args.position, "wm", args.margin)}`,
          `  (gimp-layer-set-opacity wm ${num(args.opacity)}))`,
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Applied image watermark -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "overlay_image",
    {
      title: "Overlay an image at coordinates",
      description:
        "Composite another image on top of the base image at explicit (x, y) pixel offsets " +
        "with the given opacity (0-100), then flatten.",
      inputSchema: {
        inputPath,
        outputPath,
        overlayPath: z.string().describe("Path to the image to overlay."),
        x: z.number().int().default(0),
        y: z.number().int().default(0),
        opacity: z.number().min(0).max(100).default(100),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(let ((ov (car (gimp-file-load-layer RUN-NONINTERACTIVE image ${str(args.overlayPath)}))))`,
          "  (gimp-image-insert-layer image ov 0 -1)",
          `  (gimp-layer-set-offsets ov ${num(args.x)} ${num(args.y)})`,
          `  (gimp-layer-set-opacity ov ${num(args.opacity)}))`,
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Overlaid image -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "add_border",
    {
      title: "Add a solid border",
      description:
        "Expand the canvas by `width` pixels on every side and fill the new area with a " +
        "solid colour (#RRGGBB or r,g,b).",
      inputSchema: {
        inputPath,
        outputPath,
        width: z.number().int().positive().default(20).describe("Border thickness in pixels."),
        color: z.string().default("#FFFFFF"),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(gimp-context-set-background ${colorList(args.color)})`,
          `(let* ((w (car (gimp-image-get-width image))) (h (car (gimp-image-get-height image))) (b ${num(
            args.width,
          )}))`,
          "  (gimp-image-resize image (+ w (* 2 b)) (+ h (* 2 b)) b b))",
        ].join("\n");
        // Flatten fills the expanded canvas with the background colour.
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Added ${args.width}px border -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "flatten",
    {
      title: "Flatten image",
      description: "Flatten all layers into a single layer and save (useful before exporting).",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args) });
        return `Flattened -> ${resolveOutput(args)}`;
      }),
  );
}
