import { describe, expect, it } from "vitest";

import { channelOp, colorList, drawable, num, str } from "../src/tools/common.js";

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
  });
});

describe("drawable_layerId_resolvesTarget", () => {
  it("uses the explicit layer id when given", () => {
    expect(drawable(1, 5)).toBe("5");
  });
  it("falls back to the image's top layer", () => {
    expect(drawable(3)).toBe("(vector-ref (car (gimp-image-get-layers 3)) 0)");
  });
});

describe("channelOp_mode_mapsToConstant", () => {
  it("maps known modes and defaults to replace", () => {
    expect(channelOp("add")).toBe("CHANNEL-OP-ADD");
    expect(channelOp("subtract")).toBe("CHANNEL-OP-SUBTRACT");
    expect(channelOp("nonsense")).toBe("CHANNEL-OP-REPLACE");
  });
});

describe("str_and_num_emitScheme", () => {
  it("escapes backslashes and quotes for paths", () => {
    expect(str("C:\\a\\b.png")).toBe('"C:\\\\a\\\\b.png"');
  });
  it("emits finite numbers and rejects NaN", () => {
    expect(num(3.5)).toBe("3.5");
    expect(() => num(NaN)).toThrow();
  });
});
