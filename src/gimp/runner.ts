import { FAIL_MARKER } from "./message.js";
import { requireGimp } from "./locator.js";
import { runProcess } from "./process.js";
import { buildLoadOpSave, type LoadOpSaveSpec } from "./scriptfu.js";
import type { RunResult } from "./types.js";

export interface RunOptions {
  timeoutMs?: number;
}

/**
 * Wrap a script so the process ALWAYS quits, even on a Script-Fu error.
 *
 * An uncaught error aborts the batch and leaves headless GIMP sitting in its
 * main loop forever (a separate `-b "(gimp-quit)"` is skipped once a command
 * fails). Wrapping in `catch` regains control: on error we print FAIL_MARKER
 * and quit; on success we fall through and quit. `gimp-quit`'s argument is a
 * force flag, not an exit code, so failure is signalled by the marker.
 */
function wrapScript(scheme: string): string {
  return (
    `(begin (catch (begin (gimp-message "${FAIL_MARKER}") (gimp-quit TRUE)) ` +
    `${scheme}) (gimp-quit TRUE))`
  );
}

/**
 * Flags for fast, headless batch execution:
 *   -n new instance (never attach to a running GIMP — by default GIMP defers
 *      to an existing instance, which makes concurrent batch calls hang),
 *   -i no interface, -d no data (patterns/gradients/palettes/brushes).
 *
 * Note: we deliberately do NOT pass -f (no-fonts); GIMP disables all text
 * functionality without fonts, breaking the text/watermark tools.
 */
function batchArgs(scheme: string): string[] {
  return [
    "-n",
    "-i",
    "-d",
    "--batch-interpreter=plug-in-script-fu-eval",
    "-b",
    wrapScript(scheme),
  ];
}

/** Detect a Script-Fu failure in captured output. */
function findError(stdout: string, stderr: string): string | null {
  const haystack = `${stdout}\n${stderr}`;
  if (haystack.includes(FAIL_MARKER)) {
    // catch swallows the underlying message; surface any leaked detail if present.
    const detail = haystack.match(/Error:\s*(.+)/);
    return detail
      ? `operation failed: ${detail[1]!.trim()}`
      : "operation failed (Script-Fu execution error). Check the file paths and " +
          "parameters; use pdb_search/pdb_describe to confirm procedure names.";
  }
  // Fallback for an error that somehow escaped the wrapper.
  const uncaught = haystack.match(/experienced an execution error[:\s]*(.*)/i);
  return uncaught ? (uncaught[1]?.trim() || uncaught[0].trim()) : null;
}

// Serialise GIMP invocations. Each batch run is a separate GIMP process that
// writes shared per-user config files (unitrc, parserc, pluginrc, ...) at
// startup; two running at once race and fail with "Error renaming temporary
// file: Permission denied". Spawn-per-command has no reason to run GIMP
// concurrently, so we queue every invocation behind the previous one.
let queueTail: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(fn, fn);
  // Keep the chain alive regardless of this run's outcome.
  queueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Evaluate a Script-Fu snippet in a fresh headless GIMP process. Invocations
 * are serialised (see `serialize`).
 *
 * Throws with the GIMP error message if the script fails, the process is
 * killed by timeout, or GIMP cannot be located.
 */
export async function runBatch(scheme: string, options: RunOptions = {}): Promise<RunResult> {
  const location = await requireGimp();
  const result = await serialize(() =>
    runProcess(location.command, [...location.args, ...batchArgs(scheme)], {
      timeoutMs: options.timeoutMs,
    }),
  );

  if (result.timedOut) {
    throw new Error("GIMP timed out and was terminated. Try a longer timeout or a simpler script.");
  }

  const errorMessage = findError(result.stdout, result.stderr);
  if (errorMessage) {
    throw new Error(`GIMP Script-Fu error: ${errorMessage}`);
  }
  if (result.code !== 0) {
    throw new Error(
      `GIMP exited with code ${result.code}. stderr: ${result.stderr.trim() || "(empty)"}`,
    );
  }

  return { stdout: result.stdout, stderr: result.stderr };
}

/** Run a standard load -> operate -> export pipeline against a file on disk. */
export async function runLoadOpSave(
  spec: LoadOpSaveSpec,
  options: RunOptions = {},
): Promise<RunResult> {
  return runBatch(buildLoadOpSave(spec), options);
}
