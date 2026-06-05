import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  channelOp,
  colorList,
  drawable,
  evalSf,
  guard,
  imageIdArg,
  layerIdArg,
  num,
  selectModeArg,
} from "./common.js";

export function registerSelectionTools(server: McpServer): void {
  server.registerTool(
    "select_none",
    {
      title: "Select none (clear selection)",
      description: "Clear the current selection (Select ▸ None).",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-none ${num(imageId)})`);
        return `Cleared selection on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_all",
    {
      title: "Select all",
      description: "Select the entire canvas (Select ▸ All).",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-all ${num(imageId)})`);
        return `Selected all on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_invert",
    {
      title: "Invert selection",
      description: "Invert the current selection (Select ▸ Invert).",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-invert ${num(imageId)})`);
        return `Inverted selection on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_rectangle",
    {
      title: "Rectangle select",
      description: "Make a rectangular selection at (x, y) of the given width and height.",
      inputSchema: {
        imageId: imageIdArg,
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        mode: selectModeArg,
      },
    },
    async ({ imageId, x, y, width, height, mode }) =>
      guard(async () => {
        await evalSf(
          `(gimp-image-select-rectangle ${num(imageId)} ${channelOp(mode)} ${num(x)} ${num(y)} ${num(width)} ${num(height)})`,
        );
        return `Rectangle selection on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_ellipse",
    {
      title: "Ellipse select",
      description: "Make an elliptical selection in the bounding box at (x, y) width x height.",
      inputSchema: {
        imageId: imageIdArg,
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        mode: selectModeArg,
      },
    },
    async ({ imageId, x, y, width, height, mode }) =>
      guard(async () => {
        await evalSf(
          `(gimp-image-select-ellipse ${num(imageId)} ${channelOp(mode)} ${num(x)} ${num(y)} ${num(width)} ${num(height)})`,
        );
        return `Ellipse selection on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_by_color",
    {
      title: "Select by colour",
      description:
        "Select ALL pixels matching a colour anywhere in the layer (Select ▸ By Color). " +
        "`threshold` (0-1) sets the match tolerance.",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        color: z.string().describe("Colour to match (#RRGGBB or r,g,b)."),
        threshold: z.number().min(0).max(1).default(0.15),
        mode: selectModeArg,
      },
    },
    async ({ imageId, layerId, color, threshold, mode }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-sample-threshold ${num(threshold)})`);
        await evalSf(
          `(gimp-image-select-color ${num(imageId)} ${channelOp(mode)} ${drawable(imageId, layerId)} ${colorList(color)})`,
        );
        return `Selected colour ${color} on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "fuzzy_select",
    {
      title: "Fuzzy select (magic wand)",
      description:
        "Select a CONTIGUOUS region of similar colour starting at (x, y) — the magic-wand / " +
        "fuzzy-select tool. Ideal for backgrounds: seed from a corner. `threshold` (0-1) sets " +
        "the tolerance.",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        x: z.number(),
        y: z.number(),
        threshold: z.number().min(0).max(1).default(0.15),
        mode: selectModeArg,
      },
    },
    async ({ imageId, layerId, x, y, threshold, mode }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-sample-threshold ${num(threshold)})`);
        await evalSf(
          `(gimp-image-select-contiguous-color ${num(imageId)} ${channelOp(mode)} ${drawable(imageId, layerId)} ${num(x)} ${num(y)})`,
        );
        return `Fuzzy-selected from (${x}, ${y}) on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_grow",
    {
      title: "Grow selection",
      description: "Grow the current selection by `pixels`.",
      inputSchema: { imageId: imageIdArg, pixels: z.number().int().positive() },
    },
    async ({ imageId, pixels }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-grow ${num(imageId)} ${num(pixels)})`);
        return `Grew selection by ${pixels}px on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_shrink",
    {
      title: "Shrink selection",
      description: "Shrink the current selection by `pixels`.",
      inputSchema: { imageId: imageIdArg, pixels: z.number().int().positive() },
    },
    async ({ imageId, pixels }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-shrink ${num(imageId)} ${num(pixels)})`);
        return `Shrank selection by ${pixels}px on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "select_feather",
    {
      title: "Feather selection",
      description: "Soften (feather) the selection edge by `radius` pixels.",
      inputSchema: { imageId: imageIdArg, radius: z.number().positive() },
    },
    async ({ imageId, radius }) =>
      guard(async () => {
        await evalSf(`(gimp-selection-feather ${num(imageId)} ${num(radius)})`);
        return `Feathered selection by ${radius}px on image ${imageId}.`;
      }),
  );
}
