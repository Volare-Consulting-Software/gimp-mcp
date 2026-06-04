/**
 * GIMP echoes `gimp-message` output to the console when running headless. We
 * use that to get structured data out of a batch script: wrap a payload in
 * unique markers and extract it from the captured stdout/stderr.
 */

export const MSG_START = "@@GIMPMCP_START@@";
export const MSG_END = "@@GIMPMCP_END@@";

/**
 * Emitted by the batch wrapper's error handler. A Script-Fu error otherwise
 * aborts the batch and leaves headless GIMP hanging, so every script is run
 * inside a `catch` that prints this marker and quits on failure.
 */
export const FAIL_MARKER = "@@GIMPMCP_FAIL@@";

/**
 * Build a `(gimp-message ...)` call whose argument is a Scheme string
 * expression, wrapped in the extraction markers.
 */
export function messageExpr(payloadExpr: string): string {
  return `(gimp-message (string-append "${MSG_START}" ${payloadExpr} "${MSG_END}"))`;
}

/** Extract the marker-wrapped payload from captured output. */
export function extractPayload(stdout: string, stderr: string): string {
  const haystack = `${stdout}\n${stderr}`;
  const start = haystack.indexOf(MSG_START);
  const end = haystack.indexOf(MSG_END);
  if (start === -1 || end === -1 || end < start) {
    return haystack.trim();
  }
  return haystack.slice(start + MSG_START.length, end);
}
