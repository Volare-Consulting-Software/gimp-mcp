import { describe, expect, it } from "vitest";

import { colorList, resolveOutput } from "../src/tools/common.js";

describe("colorList_format_parsesToSchemeList", () => {
  it("parses #RRGGBB", () => {
    expect(colorList("#ff8800")).toBe("'(255 136 0)");
  });

  it("parses shorthand #RGB", () => {
    expect(colorList("#f80")).toBe("'(255 136 0)");
  });

  it("parses r,g,b", () => {
    expect(colorList("10, 20, 30")).toBe("'(10 20 30)");
  });

  it("rejects malformed colours", () => {
    expect(() => colorList("#xyzxyz")).toThrow();
    expect(() => colorList("300,0,0")).toThrow();
    expect(() => colorList("nope")).toThrow();
  });
});

describe("resolveOutput_outputPath_defaultsToInput", () => {
  it("returns outputPath when provided", () => {
    expect(resolveOutput({ inputPath: "/a.png", outputPath: "/b.png" })).toBe("/b.png");
  });

  it("falls back to inputPath when omitted", () => {
    expect(resolveOutput({ inputPath: "/a.png" })).toBe("/a.png");
  });
});
