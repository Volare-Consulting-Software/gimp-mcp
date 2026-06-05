import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { colorList, drawable, evalSf, guard, imageIdArg, layerIdArg, num, str } from "./common.js";

/** Scheme expression resolving a GimpFont object by name, or the context default. */
function fontExpr(fontName?: string): string {
  if (!fontName || !fontName.trim()) return "(car (gimp-context-get-font))";
  const rx = fontName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    `(let ((m (car (gimp-fonts-get-list ${str(rx)})))) ` +
    "(if (> (vector-length m) 0) (vector-ref m 0) (car (gimp-context-get-font))))"
  );
}

export function registerLayerTools(server: McpServer): void {
  server.registerTool(
    "add_alpha_channel",
    {
      title: "Add alpha channel",
      description: "Add an alpha (transparency) channel to a layer (Layer ▸ Transparency ▸ Add).",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg },
    },
    async ({ imageId, layerId }) =>
      guard(async () => {
        await evalSf(`(gimp-layer-add-alpha ${drawable(imageId, layerId)})`);
        return `Added alpha channel on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "new_layer",
    {
      title: "New transparent layer",
      description:
        "Add a new transparent layer at the top of the image. Width/height default to the " +
        "image size. Returns the new layer ID.",
      inputSchema: {
        imageId: imageIdArg,
        name: z.string().default("Layer"),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      },
    },
    async ({ imageId, name, width, height }) =>
      guard(async () => {
        const id = num(imageId);
        const w = width !== undefined ? num(width) : `(car (gimp-image-get-width ${id}))`;
        const h = height !== undefined ? num(height) : `(car (gimp-image-get-height ${id}))`;
        const layer = await evalSf(
          `(let ((l (car (gimp-layer-new ${id} ${str(name)} ${w} ${h} RGBA-IMAGE 100 LAYER-MODE-NORMAL))))` +
            ` (gimp-image-insert-layer ${id} l 0 -1) (gimp-drawable-fill l FILL-TRANSPARENT) l)`,
        );
        return `Added layer ${layer.trim()} to image ${imageId}.`;
      }),
  );

  server.registerTool(
    "add_layer_from_file",
    {
      title: "Add image as a layer",
      description:
        "Load an image file as a new layer on top of an open image (for compositing / " +
        "watermarks / overlays). Returns the new layer ID; position it with set_layer_offsets.",
      inputSchema: { imageId: imageIdArg, path: z.string().describe("Path to the image to place.") },
    },
    async ({ imageId, path }) =>
      guard(async () => {
        const id = num(imageId);
        const layer = await evalSf(
          `(let ((l (car (gimp-file-load-layer RUN-NONINTERACTIVE ${id} ${str(path)}))))` +
            ` (gimp-image-insert-layer ${id} l 0 -1) l)`,
        );
        return `Added ${path} as layer ${layer.trim()} on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "add_text_layer",
    {
      title: "Add a text layer",
      description:
        "Add a text layer (the Text tool) at (x, y) with a font, size, and colour, and return " +
        "its layer ID. Font is matched by name via list_fonts; omit for GIMP's default. The " +
        "layer is NOT flattened — merge_visible or flatten when done (merge_visible keeps alpha).",
      inputSchema: {
        imageId: imageIdArg,
        text: z.string(),
        x: z.number().int().default(10),
        y: z.number().int().default(10),
        fontSize: z.number().positive().default(36),
        color: z.string().default("#000000").describe("#RRGGBB or r,g,b"),
        font: z.string().optional().describe("Font name (see list_fonts). Default: GIMP's font."),
      },
    },
    async ({ imageId, text, x, y, fontSize, color, font }) =>
      guard(async () => {
        const id = num(imageId);
        const layer = await evalSf(
          `(let ((tl (car (gimp-text-layer-new ${id} ${str(text)} ${fontExpr(font)} ${num(fontSize)} UNIT-PIXEL))))` +
            ` (gimp-image-insert-layer ${id} tl 0 -1)` +
            ` (gimp-text-layer-set-color tl ${colorList(color)})` +
            ` (gimp-layer-set-offsets tl ${num(x)} ${num(y)}) tl)`,
        );
        return `Added text layer ${layer.trim()} on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "set_layer_opacity",
    {
      title: "Set layer opacity",
      description: "Set a layer's opacity (0-100).",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg, opacity: z.number().min(0).max(100) },
    },
    async ({ imageId, layerId, opacity }) =>
      guard(async () => {
        await evalSf(`(gimp-layer-set-opacity ${drawable(imageId, layerId)} ${num(opacity)})`);
        return `Set layer opacity to ${opacity} on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "set_layer_offsets",
    {
      title: "Move a layer",
      description: "Set a layer's top-left position within the canvas.",
      inputSchema: { imageId: imageIdArg, layerId: layerIdArg, x: z.number().int(), y: z.number().int() },
    },
    async ({ imageId, layerId, x, y }) =>
      guard(async () => {
        await evalSf(`(gimp-layer-set-offsets ${drawable(imageId, layerId)} ${num(x)} ${num(y)})`);
        return `Moved layer to (${x}, ${y}) on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "delete_layer",
    {
      title: "Delete a layer",
      description: "Remove a layer from the image.",
      inputSchema: { imageId: imageIdArg, layerId: z.number().int() },
    },
    async ({ imageId, layerId }) =>
      guard(async () => {
        await evalSf(`(gimp-image-remove-layer ${num(imageId)} ${num(layerId)})`);
        return `Removed layer ${layerId} from image ${imageId}.`;
      }),
  );

  server.registerTool(
    "merge_visible",
    {
      title: "Merge visible layers",
      description: "Merge all visible layers into one, KEEPING the alpha channel (transparency).",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        const id = num(imageId);
        await evalSf(
          `(if (> (vector-length (car (gimp-image-get-layers ${id}))) 1) (gimp-image-merge-visible-layers ${id} CLIP-TO-IMAGE) #t)`,
        );
        return `Merged visible layers on image ${imageId}.`;
      }),
  );

  server.registerTool(
    "flatten",
    {
      title: "Flatten image",
      description:
        "Flatten all layers into one, DROPPING transparency (fills with the background colour). " +
        "Use merge_visible instead if you need to keep an alpha channel.",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-image-flatten ${num(imageId)})`);
        return `Flattened image ${imageId}.`;
      }),
  );
}
