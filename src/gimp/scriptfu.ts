/**
 * Helpers for building Script-Fu (Scheme) snippets safely.
 *
 * The dominant correctness hazard is string escaping: GIMP file paths on
 * Windows contain backslashes, which are escape characters inside a Scheme
 * string literal. Every path/string passed into a script MUST go through
 * `str()`.
 */

/** Quote and escape a JS string as a Scheme string literal. */
export function str(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Render a number for Scheme, guarding against NaN/Infinity. */
export function num(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Refusing to emit non-finite number into Script-Fu: ${value}`);
  }
  return String(value);
}

/** GIMP PDB boolean constants. */
export function bool(value: boolean): string {
  return value ? "TRUE" : "FALSE";
}

/**
 * GIMP 3.0 Script-Fu expression for the active/first drawable of `image`.
 *
 * GIMP 3.0 removed `gimp-image-get-active-drawable`. PDB procedures that return
 * arrays now return a single list whose first element is a *vector*, so the
 * first layer is `(vector-ref (car (gimp-image-get-layers image)) 0)`.
 */
export const ACTIVE_DRAWABLE = "(vector-ref (car (gimp-image-get-layers image)) 0)";

/**
 * Build the export S-expression for an image to `outputPath`.
 *
 * Uses GIMP 3.0's generic `gimp-file-save` (run-mode, image, file), which
 * dispatches on the file extension — robust across the many format-specific
 * plug-in signatures.
 */
export function exportExpr(outputPath: string): string {
  return `(gimp-file-save RUN-NONINTERACTIVE image ${str(outputPath)})`;
}

/**
 * Build a GIMP 3.0 GEGL-filter application on the bound `drawable`.
 *
 * GIMP 3.0 removed the legacy `plug-in-*` filters; filters are now GEGL
 * operations applied via `gimp-drawable-merge-new-filter`:
 *   (gimp-drawable-merge-new-filter drawable OP NAME mode opacity k v k v ...)
 *
 * `params` are [propertyName, schemeValue] pairs; values must already be
 * rendered (e.g. via num()).
 */
export function geglFilter(operation: string, params: Array<[string, string]>): string {
  const pairs = params.map(([key, value]) => `${str(key)} ${value}`).join(" ");
  return `(gimp-drawable-merge-new-filter drawable ${str(operation)} ${str(
    operation,
  )} LAYER-MODE-REPLACE 1.0 ${pairs})`;
}

export interface LoadOpSaveSpec {
  inputPath: string;
  outputPath: string;
  /**
   * Operation S-expression(s). May reference the bound variables `image` and
   * `drawable`. Runs after load, before flatten/export. Omit for a pure
   * load -> export (e.g. format conversion).
   */
  op?: string;
  /** Flatten before export (default true). Disable for formats that keep layers. */
  flatten?: boolean;
}

/**
 * Wrap an operation in the standard load -> operate -> (flatten) -> export ->
 * delete lifecycle. `drawable` is bound to the active drawable (see
 * ACTIVE_DRAWABLE) — the single place that resolution lives.
 */
export function buildLoadOpSave(spec: LoadOpSaveSpec): string {
  const { inputPath, outputPath } = spec;
  const op = spec.op?.trim() ?? "";
  const flatten = spec.flatten !== false;
  const input = str(inputPath);

  return [
    "(let* (",
    `  (image (car (gimp-file-load RUN-NONINTERACTIVE ${input} ${input})))`,
    `  (drawable ${ACTIVE_DRAWABLE}))`,
    op ? `  ${op}` : "",
    flatten ? "  (gimp-image-flatten image)" : "",
    `  ${exportExpr(outputPath)}`,
    "  (gimp-image-delete image))",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Build a script that loads an image purely to read information, printing a
 * result via `gimp-message` (which GIMP echoes to stderr in batch mode).
 */
export function buildInspect(inputPath: string, body: string): string {
  const input = str(inputPath);
  return [
    "(let* (",
    `  (image (car (gimp-file-load RUN-NONINTERACTIVE ${input} ${input})))`,
    `  (drawable ${ACTIVE_DRAWABLE}))`,
    `  ${body}`,
    "  (gimp-image-delete image))",
  ].join("\n");
}
