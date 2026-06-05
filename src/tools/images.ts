import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { evalSf, guard, imageIdArg, num, str } from "./common.js";

export function registerImageTools(server: McpServer): void {
  server.registerTool(
    "open_image",
    {
      title: "Open an image",
      description:
        "Load an image file into the live GIMP session and return its image ID. Use that ID " +
        "with the other tools. The session keeps the image open until you export/close it.",
      inputSchema: { path: z.string().describe("Absolute path to the image file.") },
    },
    async ({ path }) =>
      guard(async () => {
        const id = await evalSf(`(car (gimp-file-load RUN-NONINTERACTIVE ${str(path)} ${str(path)}))`);
        return `Opened ${path} as image ${id.trim()}.`;
      }),
  );

  server.registerTool(
    "new_image",
    {
      title: "Create a new image",
      description:
        "Create a new blank image in the session and return its ID. It starts with no " +
        "layers — add one with new_layer (or it will be created on first paint).",
      inputSchema: {
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        type: z.enum(["RGB", "GRAY"]).default("RGB"),
      },
    },
    async ({ width, height, type }) =>
      guard(async () => {
        const id = await evalSf(`(car (gimp-image-new ${num(width)} ${num(height)} ${type}))`);
        return `Created ${type} image ${id.trim()} (${width}x${height}).`;
      }),
  );

  server.registerTool(
    "export_image",
    {
      title: "Export / save an image",
      description:
        "Write an image to disk. The format is chosen from the file extension (.png, .jpg, " +
        ".webp, .tiff, ...). Exports the visible composite; transparency is kept for formats " +
        "that support it (.png, .webp).",
      inputSchema: {
        imageId: imageIdArg,
        path: z.string().describe("Destination path; extension sets the format."),
      },
    },
    async ({ imageId, path }) =>
      guard(async () => {
        await evalSf(`(gimp-file-save RUN-NONINTERACTIVE ${num(imageId)} ${str(path)})`);
        return `Exported image ${imageId} -> ${path}`;
      }),
  );

  server.registerTool(
    "duplicate_image",
    {
      title: "Duplicate an image",
      description: "Duplicate an open image and return the new image ID (e.g. to keep an original).",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        const id = await evalSf(`(car (gimp-image-duplicate ${num(imageId)}))`);
        return `Duplicated image ${imageId} -> ${id.trim()}`;
      }),
  );

  server.registerTool(
    "close_image",
    {
      title: "Close an image",
      description: "Delete an image from the session, freeing memory. Does not touch any file.",
      inputSchema: { imageId: imageIdArg },
    },
    async ({ imageId }) =>
      guard(async () => {
        await evalSf(`(gimp-image-delete ${num(imageId)})`);
        return `Closed image ${imageId}.`;
      }),
  );

  server.registerTool(
    "list_images",
    {
      title: "List open images",
      description: "List the IDs of all images currently open in the session.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () =>
      guard(async () => {
        const r = await evalSf("(vector->list (car (gimp-get-images)))");
        return `Open image IDs: ${r.trim()}`;
      }),
  );

  server.registerTool(
    "get_image_info",
    {
      title: "Get image info",
      description:
        "Report width, height, base type, precision, and the layers (id and name) of an open " +
        "image. Use the layer IDs to target specific layers in other tools.",
      inputSchema: { imageId: imageIdArg },
      annotations: { readOnlyHint: true },
    },
    async ({ imageId }) =>
      guard(async () => {
        const id = num(imageId);
        const info = await evalSf(
          `(list (car (gimp-image-get-width ${id})) (car (gimp-image-get-height ${id}))` +
            ` (car (gimp-image-get-base-type ${id})) (car (gimp-image-get-precision ${id})))`,
        );
        const layers = await evalSf(
          `(map (lambda (l) (list l (car (gimp-item-get-name l))))` +
            ` (vector->list (car (gimp-image-get-layers ${id}))))`,
        );
        return (
          `image ${imageId}: (width height base_type precision) = ${info.trim()}\n` +
          `layers (id name): ${layers.trim()}\n` +
          `(base_type: 0=RGB 1=GRAY 2=INDEXED)`
        );
      }),
  );

  server.registerTool(
    "list_fonts",
    {
      title: "List available fonts",
      description:
        "List font names available to GIMP (use with add_text_layer's font). Optional " +
        "`filter` is a regex matched against names.",
      inputSchema: {
        filter: z.string().optional().describe("Regex to filter font names. Omit for all."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filter }) =>
      guard(async () => {
        const r = await evalSf(
          `(map (lambda (f) (car (gimp-resource-get-name f)))` +
            ` (vector->list (car (gimp-fonts-get-list ${str(filter ?? "")}))))`,
        );
        return r.trim();
      }),
  );
}
