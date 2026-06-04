import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { num } from "../gimp/scriptfu.js";
import { guard, inputPath, outputPath, resolveOutput } from "./common.js";

export function registerGeometryTools(server: McpServer): void {
  server.registerTool(
    "resize",
    {
      title: "Resize image",
      description:
        "Scale an image to exact pixel dimensions. Does not preserve aspect ratio — use " +
        "scale_to_fit for that.",
      inputSchema: {
        inputPath,
        outputPath,
        width: z.number().int().positive().describe("Target width in pixels."),
        height: z.number().int().positive().describe("Target height in pixels."),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-image-scale image ${num(args.width)} ${num(args.height)})`,
        });
        return `Resized to ${args.width}x${args.height} -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "scale_to_fit",
    {
      title: "Scale to fit",
      description:
        "Proportionally scale an image so it fits within maxWidth x maxHeight, preserving " +
        "aspect ratio. Never enlarges beyond the bounding box.",
      inputSchema: {
        inputPath,
        outputPath,
        maxWidth: z.number().int().positive().describe("Maximum width in pixels."),
        maxHeight: z.number().int().positive().describe("Maximum height in pixels."),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          "(let* ((w (car (gimp-image-get-width image)))",
          "       (h (car (gimp-image-get-height image)))",
          `       (scale (min (/ ${num(args.maxWidth)} w) (/ ${num(args.maxHeight)} h)))`,
          "       (nw (max 1 (round (* w scale))))",
          "       (nh (max 1 (round (* h scale)))))",
          "  (gimp-image-scale image nw nh))",
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Scaled to fit ${args.maxWidth}x${args.maxHeight} -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "crop",
    {
      title: "Crop image",
      description: "Crop to a rectangle of the given size at offset (offsetX, offsetY).",
      inputSchema: {
        inputPath,
        outputPath,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        offsetX: z.number().int().min(0).default(0),
        offsetY: z.number().int().min(0).default(0),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-image-crop image ${num(args.width)} ${num(args.height)} ${num(args.offsetX)} ${num(args.offsetY)})`,
        });
        return `Cropped to ${args.width}x${args.height}+${args.offsetX}+${args.offsetY} -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "rotate",
    {
      title: "Rotate image",
      description:
        "Rotate the image by the given number of degrees clockwise. 90/180/270 are exact " +
        "lossless rotations; other angles rotate the layer and expand the canvas.",
      inputSchema: {
        inputPath,
        outputPath,
        degrees: z.number().describe("Degrees clockwise. Use 90, 180, or 270 for lossless."),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          `(let ((deg ${num(args.degrees)}))`,
          "  (cond ((= deg 90) (gimp-image-rotate image ROTATE-DEGREES90))",
          "        ((= deg 180) (gimp-image-rotate image ROTATE-DEGREES180))",
          "        ((= deg 270) (gimp-image-rotate image ROTATE-DEGREES270))",
          "        (else (gimp-item-transform-rotate drawable (/ (* deg 3.14159265358979) 180) TRUE 0 0))))",
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: resolveOutput(args), op });
        return `Rotated ${args.degrees}deg -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "flip",
    {
      title: "Flip image",
      description: "Flip the image horizontally or vertically (mirror).",
      inputSchema: {
        inputPath,
        outputPath,
        direction: z.enum(["horizontal", "vertical"]).describe("Axis to mirror across."),
      },
    },
    async (args) =>
      guard(async () => {
        const orientation =
          args.direction === "horizontal" ? "ORIENTATION-HORIZONTAL" : "ORIENTATION-VERTICAL";
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-image-flip image ${orientation})`,
        });
        return `Flipped ${args.direction} -> ${resolveOutput(args)}`;
      }),
  );
}
