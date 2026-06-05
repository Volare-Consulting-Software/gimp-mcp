import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { extractPayload, messageExpr } from "../gimp/message.js";
import { runBatch } from "../gimp/runner.js";
import { buildInspect, str } from "../gimp/scriptfu.js";
import { guard, inputPath } from "./common.js";

export function registerInfoTools(server: McpServer): void {
  server.registerTool(
    "get_image_info",
    {
      title: "Get image info",
      description:
        "Read dimensions, base type, precision, and layer count of an image file " +
        "without modifying it.",
      inputSchema: { inputPath },
      annotations: { readOnlyHint: true },
    },
    async ({ inputPath: path }) =>
      guard(async () => {
        const body = messageExpr(
          "(string-append " +
            '"width=" (number->string (car (gimp-image-get-width image))) "\\n" ' +
            '"height=" (number->string (car (gimp-image-get-height image))) "\\n" ' +
            '"base_type=" (number->string (car (gimp-image-get-base-type image))) "\\n" ' +
            '"precision=" (number->string (car (gimp-image-get-precision image))) "\\n" ' +
            '"layers=" (number->string (vector-length (car (gimp-image-get-layers image)))))',
        );
        const { stdout, stderr } = await runBatch(buildInspect(path, body));
        const payload = extractPayload(stdout, stderr).trim();
        return `${path}\n${payload}\n\n(base_type: 0=RGB 1=GRAY 2=INDEXED)`;
      }),
  );

  server.registerTool(
    "list_fonts",
    {
      title: "List available fonts",
      description:
        "List the font names available to GIMP on this machine (use these with the " +
        "`font` parameter of add_text / watermark_text). Pass an optional `filter` " +
        "regular expression to narrow the list (e.g. \"Sans\").",
      inputSchema: {
        filter: z
          .string()
          .optional()
          .describe("Regex matched against font names. Omit to list all fonts."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filter }) =>
      guard(async () => {
        const scheme =
          `(let* ((fonts (car (gimp-fonts-get-list ${str(filter ?? "")})))` +
          " (n (vector-length fonts)))" +
          " (let loop ((i 0) (acc \"\"))" +
          `   (if (>= i n) ${messageExpr("acc")}` +
          "       (loop (+ i 1) (string-append acc (car (gimp-resource-get-name (vector-ref fonts i))) \"\\n\")))))";
        const { stdout, stderr } = await runBatch(scheme);
        const names = extractPayload(stdout, stderr)
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (names.length === 0) {
          return filter ? `No fonts matched /${filter}/.` : "No fonts found.";
        }
        return `${names.length} font(s):\n${names.join("\n")}`;
      }),
  );
}
