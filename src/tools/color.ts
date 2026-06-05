import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { drawable, evalSf, guard, imageIdArg, layerIdArg, num, str } from "./common.js";

export function registerColorTools(server: McpServer): void {
  server.registerTool(
    "brightness_contrast",
    {
      title: "Brightness & contrast",
      description: "Adjust brightness and contrast of a layer. Both -1.0 to 1.0; 0 = no change.",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        brightness: z.number().min(-1).max(1).default(0),
        contrast: z.number().min(-1).max(1).default(0),
      },
    },
    async ({ imageId, layerId, brightness, contrast }) =>
      guard(async () => {
        await evalSf(
          `(gimp-drawable-brightness-contrast ${drawable(imageId, layerId)} ${num(brightness)} ${num(contrast)})`,
        );
        return `Adjusted brightness/contrast on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "levels",
    {
      title: "Levels",
      description:
        "Levels adjustment on the value channel. Inputs/outputs 0-1; gamma 0.1-10 (1 = none).",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        lowInput: z.number().min(0).max(1).default(0),
        highInput: z.number().min(0).max(1).default(1),
        gamma: z.number().min(0.1).max(10).default(1),
        lowOutput: z.number().min(0).max(1).default(0),
        highOutput: z.number().min(0).max(1).default(1),
      },
    },
    async (a) =>
      guard(async () => {
        await evalSf(
          `(gimp-drawable-levels ${drawable(a.imageId, a.layerId)} HISTOGRAM-VALUE ${num(a.lowInput)} ${num(
            a.highInput,
          )} TRUE ${num(a.gamma)} ${num(a.lowOutput)} ${num(a.highOutput)} TRUE)`,
        );
        return `Applied levels on image ${a.imageId}.`;
      }),
  );

  server.registerTool(
    "hue_saturation",
    {
      title: "Hue / saturation / lightness",
      description: "Shift hue (-180..180), lightness (-100..100), saturation (-100..100).",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        hue: z.number().min(-180).max(180).default(0),
        lightness: z.number().min(-100).max(100).default(0),
        saturation: z.number().min(-100).max(100).default(0),
      },
    },
    async (a) =>
      guard(async () => {
        await evalSf(
          `(gimp-drawable-hue-saturation ${drawable(a.imageId, a.layerId)} HUE-RANGE-ALL ${num(a.hue)} ${num(
            a.lightness,
          )} ${num(a.saturation)} 0)`,
        );
        return `Adjusted hue/saturation on image ${a.imageId}.`;
      }),
  );

  server.registerTool(
    "color_balance",
    {
      title: "Color balance (midtones)",
      description: "Adjust cyan-red, magenta-green, yellow-blue of midtones (each -100..100).",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        cyanRed: z.number().min(-100).max(100).default(0),
        magentaGreen: z.number().min(-100).max(100).default(0),
        yellowBlue: z.number().min(-100).max(100).default(0),
      },
    },
    async (a) =>
      guard(async () => {
        await evalSf(
          `(gimp-drawable-color-balance ${drawable(a.imageId, a.layerId)} TRANSFER-MIDTONES TRUE ${num(
            a.cyanRed,
          )} ${num(a.magentaGreen)} ${num(a.yellowBlue)})`,
        );
        return `Adjusted color balance on image ${a.imageId}.`;
      }),
  );

  server.registerTool(
    "desaturate",
    {
      title: "Desaturate",
      description: "Remove colour from a layer while keeping it in RGB mode (luminance).",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg },
    },
    async ({ imageId, layerId }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-desaturate ${drawable(imageId, layerId)} DESATURATE-LUMINANCE)`);
        return `Desaturated on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "invert",
    {
      title: "Invert colours",
      description: "Invert the colours of a layer (photo negative).",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg },
    },
    async ({ imageId, layerId }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-invert ${drawable(imageId, layerId)} FALSE)`);
        return `Inverted on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "posterize",
    {
      title: "Posterize",
      description: "Reduce a layer to a limited number of tonal levels per channel (2-255).",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg, levels: z.number().int().min(2).max(255).default(8) },
    },
    async ({ imageId, layerId, levels }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-posterize ${drawable(imageId, layerId)} ${num(levels)})`);
        return `Posterized on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "threshold",
    {
      title: "Threshold (black & white)",
      description: "Convert a layer to pure black & white by luminance threshold. low/high 0-1.",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        low: z.number().min(0).max(1).default(0.5),
        high: z.number().min(0).max(1).default(1),
      },
    },
    async ({ imageId, layerId, low, high }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-threshold ${drawable(imageId, layerId)} HISTOGRAM-VALUE ${num(low)} ${num(high)})`);
        return `Thresholded on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "convert_grayscale",
    {
      title: "Convert to grayscale",
      description: "Convert the whole image to grayscale mode.",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-image-convert-grayscale ${num(imageId)})`);
        return `Converted image ${imageId} to grayscale.`;
      }),
  );

  server.registerTool(
    "apply_gegl_filter",
    {
      title: "Apply a GEGL filter (generic)",
      description:
        "Apply any GIMP 3.0 GEGL filter to a layer by operation name and properties — the " +
        'generic filter tool. Examples: operation "gegl:gaussian-blur" with ' +
        '{ "std-dev-x": 5, "std-dev-y": 5 }; "gegl:unsharp-mask" with { "std-dev": 3, ' +
        '"scale": 0.5 }; "gegl:pixelize" with { "size-x": 8, "size-y": 8 }; "gegl:noise-hurl" ' +
        'with { "pct-random": 15 }. Property names/types follow the GEGL operation.',
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        operation: z.string().describe('GEGL operation name, e.g. "gegl:gaussian-blur".'),
        params: z
          .record(z.union([z.number(), z.string(), z.boolean()]))
          .default({})
          .describe("Property name -> value pairs for the operation."),
      },
    },
    async ({ imageId, layerId, operation, params }) =>
      guard(async () => {
        const pairs = Object.entries(params)
          .map(([k, v]) => `${str(k)} ${renderValue(v)}`)
          .join(" ");
        await evalSf(
          `(gimp-drawable-merge-new-filter ${drawable(imageId, layerId)} ${str(operation)} ${str(
            operation,
          )} LAYER-MODE-REPLACE 1.0 ${pairs})`,
        );
        return `Applied ${operation} on image ${imageId}.`;
      }),
  );
}

function renderValue(v: number | string | boolean): string {
  if (typeof v === "number") return num(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return str(v);
}
