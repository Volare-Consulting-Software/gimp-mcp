import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { extractPayload, messageExpr } from "../gimp/message.js";
import { runBatch } from "../gimp/runner.js";
import { buildInspect } from "../gimp/scriptfu.js";
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
            '"base_type=" (number->string (car (gimp-image-base-type image))) "\\n" ' +
            '"precision=" (number->string (car (gimp-image-get-precision image))) "\\n" ' +
            '"layers=" (number->string (vector-length (car (gimp-image-get-layers image)))))',
        );
        const { stdout, stderr } = await runBatch(buildInspect(path, body));
        const payload = extractPayload(stdout, stderr).trim();
        return `${path}\n${payload}\n\n(base_type: 0=RGB 1=GRAY 2=INDEXED)`;
      }),
  );
}
