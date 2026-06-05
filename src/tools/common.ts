import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { session } from "../gimp/session.js";

/** Standard text success result. */
export function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/** Standard error result. */
export function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Run a handler, converting thrown errors into an error result. */
export async function guard(fn: () => Promise<string>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** Evaluate one Script-Fu command in the live session and return its result. */
export async function evalSf(command: string): Promise<string> {
  return session.eval(command);
}

export const imageIdArg = z
  .number()
  .int()
  .describe("Image ID returned by open_image or new_image.");

export const layerIdArg = z
  .number()
  .int()
  .optional()
  .describe("Layer (drawable) ID. Defaults to the image's top layer.");

/** Scheme expression for the target drawable: an explicit layer, or the top layer. */
export function drawable(image: number, layer?: number): string {
  return layer === undefined
    ? `(vector-ref (car (gimp-image-get-layers ${image})) 0)`
    : String(layer);
}

const CHANNEL_OPS: Record<string, string> = {
  replace: "CHANNEL-OP-REPLACE",
  add: "CHANNEL-OP-ADD",
  subtract: "CHANNEL-OP-SUBTRACT",
  intersect: "CHANNEL-OP-INTERSECT",
};

export const selectModeArg = z
  .enum(["replace", "add", "subtract", "intersect"])
  .default("replace")
  .describe("How this selection combines with the current selection.");

export function channelOp(mode: string): string {
  return CHANNEL_OPS[mode] ?? "CHANNEL-OP-REPLACE";
}

/** Quote/escape a JS string as a Scheme string literal (handles Windows paths). */
export function str(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Render a finite number for Scheme. */
export function num(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Non-finite number: ${value}`);
  return String(value);
}

/**
 * Parse `#RRGGBB`, `#RGB`, or `r,g,b` into a Script-Fu colour list `'(r g b)`.
 */
export function colorList(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) throw new Error(`Invalid hex colour: ${color}`);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `'(${r} ${g} ${b})`;
  }
  const parts = trimmed.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`Invalid colour "${color}". Use #RRGGBB or "r,g,b" (0-255).`);
  }
  return `'(${parts[0]} ${parts[1]} ${parts[2]})`;
}
