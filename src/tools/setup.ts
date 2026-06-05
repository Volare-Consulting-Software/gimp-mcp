import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { currentPlatform, findGimpConsole } from "../gimp/locator.js";
import { formatInstallInstructions } from "../install/installer.js";
import { guard } from "./common.js";

export function registerSetupTools(server: McpServer): void {
  server.registerTool(
    "gimp_doctor",
    {
      title: "Diagnose GIMP installation",
      description:
        "Check whether GIMP is installed and locatable on this machine. Reports the " +
        "console binary path, version, and how it was found. If GIMP is missing, returns " +
        "the official download link and the package-manager commands for this OS. Run " +
        "this first when image tools fail.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      guard(async () => {
        const location = await findGimpConsole(true);
        const lines: string[] = [`Platform: ${currentPlatform()}`];

        if (location) {
          lines.push(
            "GIMP: FOUND",
            `  command: ${location.command}`,
            `  args: ${location.args.join(" ") || "(none)"}`,
            `  version: ${location.version ?? "unknown"}`,
            `  source: ${location.source}`,
          );
        } else {
          lines.push("GIMP: NOT FOUND", "", formatInstallInstructions());
        }
        return lines.join("\n");
      }),
  );

  server.registerTool(
    "gimp_version",
    {
      title: "Get GIMP version",
      description: "Return the version of the located GIMP, or an error if GIMP is not found.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      guard(async () => {
        const location = await findGimpConsole();
        if (!location) throw new Error("GIMP not found. Run gimp_doctor for install guidance.");
        return location.version
          ? `GIMP ${location.version} (${location.source})`
          : `GIMP found at ${location.command} but version could not be determined.`;
      }),
  );

  server.registerTool(
    "install_gimp",
    {
      title: "How to install GIMP",
      description:
        "Return instructions for installing GIMP on this machine: the official download " +
        "link (works on every OS) plus the package-manager commands for the detected OS. " +
        "This tool does NOT install anything itself — run the command in your own terminal, " +
        "or download from the link.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      guard(async () => {
        const existing = await findGimpConsole(true);
        if (existing) {
          return (
            `GIMP is already installed (${existing.version ?? "unknown version"}) at ` +
            `${existing.command}. Nothing to do.`
          );
        }
        return formatInstallInstructions();
      }),
  );
}
