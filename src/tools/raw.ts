import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { extractPayload, messageExpr } from "../gimp/message.js";
import { runBatch } from "../gimp/runner.js";
import { guard } from "./common.js";

export function registerRawTools(server: McpServer): void {
  server.registerTool(
    "run_script_fu",
    {
      title: "Run arbitrary Script-Fu",
      description:
        "Evaluate an arbitrary Script-Fu (Scheme) snippet in a fresh headless GIMP " +
        "process. This is the escape hatch for anything the curated tools do not cover. " +
        "Your script is responsible for loading and saving any images. To return data to " +
        "the caller, wrap it in a gimp-message call. The snippet runs, then GIMP quits.\n\n" +
        'Example: (let* ((image (car (gimp-file-load RUN-NONINTERACTIVE "/a.png" "/a.png"))))' +
        ' (gimp-image-flatten image) (gimp-file-save RUN-NONINTERACTIVE image ' +
        '(car (gimp-image-get-active-drawable image)) "/b.jpg" "/b.jpg") (gimp-image-delete image))',
      inputSchema: {
        script: z.string().describe("The Script-Fu (Scheme) code to evaluate."),
        captureMessage: z
          .boolean()
          .default(false)
          .describe(
            "If true, wraps the script so a single trailing gimp-message payload is " +
              "extracted and returned. If false, returns raw stdout/stderr.",
          ),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Override the execution timeout in milliseconds."),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ script, captureMessage, timeoutMs }) =>
      guard(async () => {
        if (!captureMessage) {
          const { stdout, stderr } = await runBatch(script, { timeoutMs });
          const out = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n---stderr---\n");
          return out || "Script completed with no output.";
        }
        // Best-effort: assume the user's script computes a string and we message it.
        const wrapped = `(let ((gimpmcp-result (begin ${script}))) ${messageExpr(
          "(if (string? gimpmcp-result) gimpmcp-result (number->string gimpmcp-result))",
        )})`;
        const { stdout, stderr } = await runBatch(wrapped, { timeoutMs });
        return extractPayload(stdout, stderr).trim() || "Script completed with no message.";
      }),
  );
}
