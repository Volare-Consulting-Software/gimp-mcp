import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { colorList, drawable, evalSf, guard, imageIdArg, layerIdArg, num } from "./common.js";

const FILL_TYPES: Record<string, string> = {
  foreground: "FILL-FOREGROUND",
  background: "FILL-BACKGROUND",
  white: "FILL-WHITE",
  transparent: "FILL-TRANSPARENT",
  pattern: "FILL-PATTERN",
};

export function registerEditTools(server: McpServer): void {
  server.registerTool(
    "edit_clear",
    {
      title: "Clear (Edit ▸ Clear)",
      description:
        "Clear the current selection (or the whole layer if nothing is selected). On a layer " +
        "with alpha this erases to transparency; otherwise it fills with the background colour.",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg },
    },
    async ({ imageId, layerId }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-edit-clear ${drawable(imageId, layerId)})`);
        return `Cleared on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "edit_fill",
    {
      title: "Fill (Edit ▸ Fill)",
      description:
        "Fill the current selection (or whole layer) with the foreground/background/white/" +
        "transparent/pattern. Set colours first with set_foreground / set_background.",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        fill: z.enum(["foreground", "background", "white", "transparent", "pattern"]).default("foreground"),
      },
    },
    async ({ imageId, layerId, fill }) =>
      guard(async () => {
        await evalSf(`(gimp-drawable-edit-fill ${drawable(imageId, layerId)} ${FILL_TYPES[fill]})`);
        return `Filled with ${fill} on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "bucket_fill",
    {
      title: "Bucket fill",
      description:
        "Flood-fill from point (x, y) with the current foreground colour, spreading to " +
        "similar contiguous pixels (set tolerance with set_sample_threshold).",
      inputSchema: {
        imageId: imageIdArg,
        layerId: layerIdArg,
        x: z.number(),
        y: z.number(),
      },
    },
    async ({ imageId, layerId, x, y }) =>
      guard(async () => {
        await evalSf(
          `(gimp-drawable-edit-bucket-fill ${drawable(imageId, layerId)} FILL-FOREGROUND ${num(x)} ${num(y)})`,
        );
        return `Bucket-filled at (${x}, ${y}) on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "set_foreground",
    {
      title: "Set foreground colour",
      description: "Set GIMP's foreground colour (used by fills, text, painting).",
      inputSchema: { color: z.string().describe("#RRGGBB or r,g,b") },
    },
    async ({ color }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-foreground ${colorList(color)})`);
        return `Foreground set to ${color}.`;
      }),
  );

  server.registerTool(
    "set_background",
    {
      title: "Set background colour",
      description: "Set GIMP's background colour (used by clear on non-alpha layers, canvas grow).",
      inputSchema: { color: z.string().describe("#RRGGBB or r,g,b") },
    },
    async ({ color }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-background ${colorList(color)})`);
        return `Background set to ${color}.`;
      }),
  );

  server.registerTool(
    "set_sample_threshold",
    {
      title: "Set selection colour tolerance",
      description:
        "Set the colour tolerance (0-1) used by select_by_color, fuzzy_select, and bucket_fill.",
      inputSchema: { threshold: z.number().min(0).max(1) },
    },
    async ({ threshold }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-sample-threshold ${num(threshold)})`);
        return `Sample threshold set to ${threshold}.`;
      }),
  );

  server.registerTool(
    "set_opacity",
    {
      title: "Set paint opacity",
      description: "Set the global paint/fill opacity (0-100).",
      inputSchema: { opacity: z.number().min(0).max(100) },
    },
    async ({ opacity }) =>
      guard(async () => {
        await evalSf(`(gimp-context-set-opacity ${num(opacity)})`);
        return `Opacity set to ${opacity}.`;
      }),
  );
}
