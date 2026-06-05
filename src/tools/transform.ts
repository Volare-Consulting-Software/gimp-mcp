import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { evalSf, guard, imageIdArg, num } from "./common.js";

export function registerTransformTools(server: McpServer): void {
  server.registerTool(
    "scale_image",
    {
      title: "Scale image",
      description: "Scale the whole image to exact pixel dimensions (Image ▸ Scale Image).",
      inputSchema: {
        imageId: imageIdArg,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      },
    },
    async ({ imageId, width, height }) =>
      guard(async () => {
        await evalSf(`(gimp-image-scale ${num(imageId)} ${num(width)} ${num(height)})`);
        return `Scaled image ${imageId} to ${width}x${height}.`;
      }),
  );

  server.registerTool(
    "crop_image",
    {
      title: "Crop image",
      description: "Crop the image to a rectangle of width x height at offset (x, y).",
      inputSchema: {
        imageId: imageIdArg,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        x: z.number().int().min(0).default(0),
        y: z.number().int().min(0).default(0),
      },
    },
    async ({ imageId, width, height, x, y }) =>
      guard(async () => {
        await evalSf(`(gimp-image-crop ${num(imageId)} ${num(width)} ${num(height)} ${num(x)} ${num(y)})`);
        return `Cropped image ${imageId} to ${width}x${height}+${x}+${y}.`;
      }),
  );

  server.registerTool(
    "resize_canvas",
    {
      title: "Resize canvas",
      description:
        "Change the canvas size without scaling the content, placing the existing layers at " +
        "offset (x, y). New area is transparent (or background on flatten). Image ▸ Canvas Size.",
      inputSchema: {
        imageId: imageIdArg,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        x: z.number().int().default(0),
        y: z.number().int().default(0),
      },
    },
    async ({ imageId, width, height, x, y }) =>
      guard(async () => {
        await evalSf(`(gimp-image-resize ${num(imageId)} ${num(width)} ${num(height)} ${num(x)} ${num(y)})`);
        return `Resized canvas of image ${imageId} to ${width}x${height}.`;
      }),
  );

  server.registerTool(
    "rotate_image",
    {
      title: "Rotate image",
      description: "Rotate the whole image by 90, 180, or 270 degrees clockwise.",
      inputSchema: {
        imageId: imageIdArg,
        degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
      },
    },
    async ({ imageId, degrees }) =>
      guard(async () => {
        const c = degrees === 90 ? "ROTATE-DEGREES90" : degrees === 180 ? "ROTATE-DEGREES180" : "ROTATE-DEGREES270";
        await evalSf(`(gimp-image-rotate ${num(imageId)} ${c})`);
        return `Rotated image ${imageId} by ${degrees} degrees.`;
      }),
  );

  server.registerTool(
    "flip_image",
    {
      title: "Flip image",
      description: "Flip the whole image horizontally or vertically.",
      inputSchema: {
        imageId: imageIdArg,
        direction: z.enum(["horizontal", "vertical"]),
      },
    },
    async ({ imageId, direction }) =>
      guard(async () => {
        const o = direction === "horizontal" ? "ORIENTATION-HORIZONTAL" : "ORIENTATION-VERTICAL";
        await evalSf(`(gimp-image-flip ${num(imageId)} ${o})`);
        return `Flipped image ${imageId} ${direction}.`;
      }),
  );
}
