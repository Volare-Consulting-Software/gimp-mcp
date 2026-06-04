import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runLoadOpSave } from "../gimp/runner.js";
import { num } from "../gimp/scriptfu.js";
import { guard, inputPath, outputPath, resolveOutput } from "./common.js";

export function registerColorTools(server: McpServer): void {
  server.registerTool(
    "brightness_contrast",
    {
      title: "Brightness & contrast",
      description:
        "Adjust brightness and contrast. Both values range -1.0 (min) to 1.0 (max); 0 is no change.",
      inputSchema: {
        inputPath,
        outputPath,
        brightness: z.number().min(-1).max(1).default(0),
        contrast: z.number().min(-1).max(1).default(0),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-brightness-contrast drawable ${num(args.brightness)} ${num(args.contrast)})`,
        });
        return `Adjusted brightness/contrast -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "levels",
    {
      title: "Adjust levels",
      description:
        "Apply a levels adjustment on the value channel. Inputs/outputs are 0.0-1.0; gamma " +
        "is 0.1-10.0 (1.0 = no change).",
      inputSchema: {
        inputPath,
        outputPath,
        lowInput: z.number().min(0).max(1).default(0),
        highInput: z.number().min(0).max(1).default(1),
        gamma: z.number().min(0.1).max(10).default(1),
        lowOutput: z.number().min(0).max(1).default(0),
        highOutput: z.number().min(0).max(1).default(1),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-levels drawable HISTOGRAM-VALUE ${num(args.lowInput)} ${num(
            args.highInput,
          )} TRUE ${num(args.gamma)} ${num(args.lowOutput)} ${num(args.highOutput)} TRUE)`,
        });
        return `Applied levels -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "gamma",
    {
      title: "Adjust gamma",
      description:
        "Apply a gamma correction. value > 1 brightens midtones, < 1 darkens. 1.0 = no change.",
      inputSchema: {
        inputPath,
        outputPath,
        value: z.number().min(0.1).max(10).default(1),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-levels drawable HISTOGRAM-VALUE 0 1 TRUE ${num(args.value)} 0 1 TRUE)`,
        });
        return `Applied gamma -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "hue_saturation",
    {
      title: "Hue / saturation / lightness",
      description:
        "Shift hue (-180..180), lightness (-100..100), and saturation (-100..100) across all hues.",
      inputSchema: {
        inputPath,
        outputPath,
        hue: z.number().min(-180).max(180).default(0),
        lightness: z.number().min(-100).max(100).default(0),
        saturation: z.number().min(-100).max(100).default(0),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-hue-saturation drawable HUE-RANGE-ALL ${num(args.hue)} ${num(
            args.lightness,
          )} ${num(args.saturation)} 0)`,
        });
        return `Adjusted hue/saturation -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "color_balance",
    {
      title: "Color balance (midtones)",
      description:
        "Adjust the cyan-red, magenta-green, and yellow-blue balance of the midtones " +
        "(each -100..100), preserving luminosity.",
      inputSchema: {
        inputPath,
        outputPath,
        cyanRed: z.number().min(-100).max(100).default(0),
        magentaGreen: z.number().min(-100).max(100).default(0),
        yellowBlue: z.number().min(-100).max(100).default(0),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-color-balance drawable TRANSFER-MIDTONES TRUE ${num(
            args.cyanRed,
          )} ${num(args.magentaGreen)} ${num(args.yellowBlue)})`,
        });
        return `Adjusted color balance -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "desaturate",
    {
      title: "Desaturate (keep RGB)",
      description: "Remove colour while keeping the image in RGB mode, using luminance weighting.",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: "(gimp-drawable-desaturate drawable DESATURATE-LUMINANCE)",
        });
        return `Desaturated -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "grayscale",
    {
      title: "Convert to grayscale",
      description: "Convert the image to true grayscale mode.",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: "(gimp-image-convert-grayscale image)",
        });
        return `Converted to grayscale -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "invert",
    {
      title: "Invert colors",
      description: "Invert the image colours (photo negative).",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: "(gimp-drawable-invert drawable FALSE)",
        });
        return `Inverted -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "posterize",
    {
      title: "Posterize",
      description: "Reduce the image to a limited number of tonal levels per channel (2-255).",
      inputSchema: {
        inputPath,
        outputPath,
        levels: z.number().int().min(2).max(255).default(8),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-posterize drawable ${num(args.levels)})`,
        });
        return `Posterized -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "threshold",
    {
      title: "Threshold to black & white",
      description:
        "Convert to pure black and white using a luminance threshold. low/high are 0.0-1.0.",
      inputSchema: {
        inputPath,
        outputPath,
        low: z.number().min(0).max(1).default(0.5),
        high: z.number().min(0).max(1).default(1),
      },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: `(gimp-drawable-threshold drawable HISTOGRAM-VALUE ${num(args.low)} ${num(args.high)})`,
        });
        return `Thresholded -> ${resolveOutput(args)}`;
      }),
  );

  server.registerTool(
    "stretch_contrast",
    {
      title: "Auto stretch contrast",
      description: "Automatically stretch the histogram to use the full tonal range (auto-levels).",
      inputSchema: { inputPath, outputPath },
    },
    async (args) =>
      guard(async () => {
        await runLoadOpSave({
          inputPath: args.inputPath,
          outputPath: resolveOutput(args),
          op: "(gimp-drawable-levels-stretch drawable)",
        });
        return `Stretched contrast -> ${resolveOutput(args)}`;
      }),
  );
}
