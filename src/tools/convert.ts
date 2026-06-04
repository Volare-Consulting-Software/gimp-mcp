import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { fail, guard, inputPath, ok } from "./common.js";

export function registerConvertTools(server: McpServer): void {
  server.registerTool(
    "convert_format",
    {
      title: "Convert image format",
      description:
        "Convert an image to a different format. The target format is determined by the " +
        "outputPath extension (e.g. .png, .jpg, .webp, .tiff, .bmp).",
      inputSchema: {
        inputPath,
        outputPath: z.string().describe("Destination path; extension sets the output format."),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: args.outputPath });
        return `Converted ${args.inputPath} -> ${args.outputPath}`;
      }),
  );

  server.registerTool(
    "export_as",
    {
      title: "Export image",
      description:
        "Export an image to a specific path and format. Equivalent to convert_format; " +
        "provided as a familiar name.",
      inputSchema: {
        inputPath,
        outputPath: z.string().describe("Destination path; extension sets the output format."),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: args.outputPath });
        return `Exported -> ${args.outputPath}`;
      }),
  );

  server.registerTool(
    "make_thumbnail",
    {
      title: "Make thumbnail",
      description:
        "Create a thumbnail that fits within size x size pixels, preserving aspect ratio.",
      inputSchema: {
        inputPath,
        outputPath: z.string().describe("Destination path for the thumbnail."),
        size: z.number().int().positive().default(256).describe("Bounding box edge in pixels."),
      },
    },
    async (args) =>
      guard(async () => {
        const op = [
          "(let* ((w (car (gimp-image-get-width image)))",
          "       (h (car (gimp-image-get-height image)))",
          `       (scale (min (/ ${args.size} w) (/ ${args.size} h) 1))`,
          "       (nw (max 1 (round (* w scale))))",
          "       (nh (max 1 (round (* h scale)))))",
          "  (gimp-image-scale image nw nh))",
        ].join("\n");
        await runLoadOpSave({ inputPath: args.inputPath, outputPath: args.outputPath, op });
        return `Thumbnail (<=${args.size}px) -> ${args.outputPath}`;
      }),
  );

  server.registerTool(
    "batch_convert",
    {
      title: "Batch convert a folder",
      description:
        "Convert every image in a source directory to a target format, writing results to " +
        "an output directory. Matches files by extension. Returns a per-file summary.",
      inputSchema: {
        sourceDir: z.string().describe("Directory containing source images."),
        outputDir: z.string().describe("Directory to write converted images into (must exist)."),
        targetExtension: z
          .string()
          .describe('Target extension including the dot, e.g. ".png", ".jpg", ".webp".'),
        sourceExtensions: z
          .array(z.string())
          .optional()
          .describe(
            'Source extensions to include (with dots). Defaults to common raster types.',
          ),
      },
    },
    async (args) => {
      try {
        const sources = (
          args.sourceExtensions ?? [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif", ".bmp", ".gif"]
        ).map((e) => e.toLowerCase());
        const targetExt = args.targetExtension.startsWith(".")
          ? args.targetExtension
          : `.${args.targetExtension}`;

        let entries: string[];
        try {
          entries = readdirSync(args.sourceDir);
        } catch (err) {
          return fail(`Cannot read sourceDir "${args.sourceDir}": ${String(err)}`);
        }

        const files = entries.filter((name) => {
          try {
            return statSync(join(args.sourceDir, name)).isFile() && sources.includes(extname(name).toLowerCase());
          } catch {
            return false;
          }
        });

        if (files.length === 0) {
          return fail(`No matching images in ${args.sourceDir} (looked for ${sources.join(", ")}).`);
        }

        const results: string[] = [];
        let failures = 0;
        for (const file of files) {
          const inPath = join(args.sourceDir, file);
          const outPath = join(args.outputDir, `${basename(file, extname(file))}${targetExt}`);
          try {
            await runLoadOpSave({ inputPath: inPath, outputPath: outPath });
            results.push(`  OK   ${file} -> ${basename(outPath)}`);
          } catch (err) {
            failures += 1;
            results.push(`  FAIL ${file}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        const summary = `Converted ${files.length - failures}/${files.length} file(s) to ${targetExt}.`;
        return failures > 0
          ? fail(`${summary}\n${results.join("\n")}`)
          : ok(`${summary}\n${results.join("\n")}`);
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
