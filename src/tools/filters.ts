import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { geglFilter, num } from "../gimp/scriptfu.js";
import { guard, inputPath, outputPath, resolveOutput } from "./common.js";

export function registerFilterTools(server: McpServer): void {
  server.registerTool(
    "gaussian_blur",
    {
      title: "Gaussian blur",
      description: "Apply a Gaussian blur. radius is the blur strength (standard deviation) in pixels.",
      inputSchema: {
        inputPath,
        outputPath,
        radius: z.number().min(0).max(1500).default(5),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:gaussian-blur", [
            ["std-dev-x", num(args.radius)],
            ["std-dev-y", num(args.radius)],
          ]),
        });
        return `Blurred -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "sharpen",
    {
      title: "Sharpen (unsharp mask)",
      description:
        "Sharpen using an unsharp mask. radius controls the effect radius (standard " +
        "deviation); amount controls the strength.",
      inputSchema: {
        inputPath,
        outputPath,
        radius: z.number().min(0).max(300).default(3),
        amount: z.number().min(0).max(300).default(0.5),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:unsharp-mask", [
            ["std-dev", num(args.radius)],
            ["scale", num(args.amount)],
          ]),
        });
        return `Sharpened -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "median_blur",
    {
      title: "Median blur (denoise)",
      description:
        "Reduce noise and speckles with a median filter of the given radius. (Replaces the " +
        "old despeckle.)",
      inputSchema: {
        inputPath,
        outputPath,
        radius: z.number().int().min(1).max(100).default(3),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:median-blur", [["radius", num(args.radius)]]),
        });
        return `Denoised -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "pixelize",
    {
      title: "Pixelize",
      description: "Apply a mosaic / pixelation effect with the given block size in pixels.",
      inputSchema: {
        inputPath,
        outputPath,
        blockSize: z.number().int().min(1).max(500).default(10),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:pixelize", [
            ["size-x", num(args.blockSize)],
            ["size-y", num(args.blockSize)],
          ]),
        });
        return `Pixelized -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "oilify",
    {
      title: "Oil painting",
      description: "Apply an oil-painting effect with the given mask radius.",
      inputSchema: {
        inputPath,
        outputPath,
        maskSize: z.number().int().min(1).max(200).default(8),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:oilify", [["mask-radius", num(args.maskSize)]]),
        });
        return `Oilified -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "emboss",
    {
      title: "Emboss",
      description:
        "Apply an emboss effect. azimuth/elevation are light angles in degrees; depth is " +
        "the relief depth.",
      inputSchema: {
        inputPath,
        outputPath,
        azimuth: z.number().min(0).max(360).default(30),
        elevation: z.number().min(0).max(180).default(45),
        depth: z.number().int().min(1).max(100).default(20),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:emboss", [
            ["azimuth", num(args.azimuth)],
            ["elevation", num(args.elevation)],
            ["depth", num(args.depth)],
          ]),
        });
        return `Embossed -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "edge_detect",
    {
      title: "Edge detect",
      description: "Detect edges in the image. amount controls sensitivity.",
      inputSchema: {
        inputPath,
        outputPath,
        amount: z.number().min(0).max(10).default(2),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:edge", [["amount", num(args.amount)]]),
        });
        return `Edges detected -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "add_noise",
    {
      title: "Add noise",
      description:
        "Add random (hurl) noise. amount is the percentage of pixels randomized (0-100).",
      inputSchema: {
        inputPath,
        outputPath,
        amount: z.number().min(0).max(100).default(15).describe("Percent of pixels randomized."),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: geglFilter("gegl:noise-hurl", [["pct-random", num(args.amount)]]),
        });
        return `Noise added -> ${resolveOutput(args)}`;
      }),
  );
}
