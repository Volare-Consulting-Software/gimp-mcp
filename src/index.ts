#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { findGimpConsole } from "./gimp/locator.js";
import { registerColorTools } from "./tools/color.js";
import { registerComposeTools } from "./tools/compose.js";
import { registerConvertTools } from "./tools/convert.js";
import { registerFilterTools } from "./tools/filters.js";
import { registerGeometryTools } from "./tools/geometry.js";
import { registerInfoTools } from "./tools/info.js";
import { registerRawTools } from "./tools/raw.js";
import { registerSetupTools } from "./tools/setup.js";
import { registerTransparencyTools } from "./tools/transparency.js";
import { logger } from "./util/logger.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const server = new McpServer({ name: "gimp-mcp", version: VERSION });

  registerSetupTools(server);
  registerInfoTools(server);
  registerConvertTools(server);
  registerGeometryTools(server);
  registerColorTools(server);
  registerFilterTools(server);
  registerComposeTools(server);
  registerTransparencyTools(server);
  registerRawTools(server);

  // Best-effort detection at startup, purely informational (never blocks).
  void findGimpConsole().then((location) => {
    if (!location) {
      logger.warn(
        "GIMP was not detected. Image tools will fail until GIMP is installed; the " +
          "gimp_doctor and install_gimp tools can help.",
      );
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`gimp-mcp v${VERSION} ready on stdio.`);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
