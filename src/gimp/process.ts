import { spawn } from "node:child_process";

import { logger } from "../util/logger.js";

export interface SpawnOptions {
  /** Milliseconds before the child is killed and the call rejects. */
  timeoutMs?: number;
  /** Extra environment variables merged over the current process env. */
  env?: Record<string, string>;
}

export interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** True when the process was killed because it exceeded `timeoutMs`. */
  timedOut: boolean;
}

// Generous default: a fresh GIMP install registers all plug-ins on its first
// batch launch (writing pluginrc), which can take well over a minute on Windows.
// Subsequent calls are fast. Override with GIMP_MCP_TIMEOUT_MS.
const DEFAULT_TIMEOUT_MS = (() => {
  const fromEnv = Number(process.env["GIMP_MCP_TIMEOUT_MS"]);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 240_000;
})();

/**
 * Spawn a child process (no shell) and collect its output.
 *
 * Never rejects on a non-zero exit code — callers inspect `code`/`stderr` and
 * decide what counts as failure. Rejects only when the process cannot be
 * spawned at all (e.g. ENOENT), which callers use for binary detection.
 */
export function runProcess(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    logger.debug(`spawn: ${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}
