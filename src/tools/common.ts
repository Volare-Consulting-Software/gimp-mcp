import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/** Standard text success result. */
export function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/** Standard error result (sets isError so the client can surface it). */
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

export const inputPath = z
  .string()
  .describe("Absolute path to the source image file.");

export const outputPath = z
  .string()
  .optional()
  .describe(
    "Destination path. If omitted, the input file is overwritten. The output " +
      "format is chosen from the file extension (e.g. .png, .jpg, .webp, .tiff).",
  );

/** Resolve the effective output path (defaults to overwriting the input). */
export function resolveOutput(args: { inputPath: string; outputPath?: string }): string {
  return args.outputPath ?? args.inputPath;
}

/**
 * Parse a colour given as `#RRGGBB`, `#RGB`, or `r,g,b` into a Script-Fu
 * colour list literal `'(r g b)`.
 */
export function colorList(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
      throw new Error(`Invalid hex colour: ${color}`);
    }
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
