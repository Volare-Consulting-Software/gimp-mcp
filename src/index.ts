#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { findGimpConsole } from "./gimp/locator.js";
import { session } from "./gimp/session.js";
import { registerColorTools } from "./tools/color.js";
import { registerEditTools } from "./tools/edit.js";
import { registerImageTools } from "./tools/images.js";
import { registerLayerTools } from "./tools/layers.js";
import { registerRawTools } from "./tools/raw.js";
import { registerSelectionTools } from "./tools/selection.js";
import { registerSetupTools } from "./tools/setup.js";
import { registerTransformTools } from "./tools/transform.js";
import { logger } from "./util/logger.js";

const VERSION = "0.3.0";

async function main(): Promise<void> {
  const server = new McpServer({ name: "gimp-mcp", version: VERSION });

  registerSetupTools(server);
  registerImageTools(server);
  registerSelectionTools(server);
  registerEditTools(server);
  registerLayerTools(server);
  registerTransformTools(server);
  registerColorTools(server);
  registerRawTools(server);

  // Eagerly warm the GIMP session so the first real tool call isn't blocked by
  // the one-time (~30-60s) Script-Fu server startup. Non-blocking; any failure
  // surfaces on the first real tool call (or via gimp_doctor).
  void findGimpConsole()
    .then((loc) => {
      if (loc) {
        void session.eval("(gimp-version)").catch(() => {});
      } else {
        logger.warn(
          "GIMP not detected. Image tools will fail until GIMP is installed; run gimp_doctor.",
        );
      }
    })
    .catch((err) => {
      logger.debug(`session warm-up skipped: ${err instanceof Error ? err.message : String(err)}`);
    });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`gimp-mcp v${VERSION} ready on stdio.`);

  const shutdown = (): void => {
    session.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
