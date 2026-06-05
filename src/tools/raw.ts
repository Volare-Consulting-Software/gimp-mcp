import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { session } from "../gimp/session.js";
import { evalSf, guard } from "./common.js";

export function registerRawTools(server: McpServer): void {
  server.registerTool(
    "run_script_fu",
    {
      title: "Run Script-Fu",
      description:
        "Evaluate an arbitrary Script-Fu (Scheme) expression in the LIVE session and return " +
        "its result. Runs against the same open images / selections / context as the other " +
        "tools, so you can mix raw PDB calls with them. Example: " +
        '"(gimp-image-get-layers 1)". The return value is the Scheme result as text.',
      inputSchema: {
        script: z.string().describe("Script-Fu (Scheme) code to evaluate."),
      },
      annotations: { destructiveHint: true },
    },
    async ({ script }) =>
      guard(async () => {
        const result = await evalSf(script);
        return result.trim() || "(no result)";
      }),
  );

  server.registerTool(
    "end_session",
    {
      title: "End the GIMP session",
      description:
        "Shut down the live GIMP process, discarding any unsaved open images. The session " +
        "restarts automatically on the next tool call. Use this to reset state.",
      inputSchema: {},
    },
    async () =>
      guard(async () => {
        session.stop();
        return "GIMP session ended. It will restart on the next command.";
      }),
  );
}
