/**
 * Logging that never touches stdout.
 *
 * stdout is the MCP stdio channel — writing anything there that is not a
 * protocol message corrupts the connection. All diagnostics go to stderr.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const ENABLED_LEVELS: Record<LogLevel, boolean> = {
  debug: process.env.GIMP_MCP_DEBUG === "1" || process.env.GIMP_MCP_DEBUG === "true",
  info: true,
  warn: true,
  error: true,
};

function emit(level: LogLevel, message: string): void {
  if (!ENABLED_LEVELS[level]) return;
  process.stderr.write(`[gimp-mcp] ${level}: ${message}\n`);
}

export const logger = {
  debug: (message: string): void => emit("debug", message),
  info: (message: string): void => emit("info", message),
  warn: (message: string): void => emit("warn", message),
  error: (message: string): void => emit("error", message),
};
