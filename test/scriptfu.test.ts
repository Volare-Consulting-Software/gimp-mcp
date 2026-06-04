import { describe, expect, it } from "vitest";

import {
  ACTIVE_DRAWABLE,
  bool,
  buildLoadOpSave,
  exportExpr,
  num,
  str,
} from "../src/gimp/scriptfu.js";

describe("str_windowsPath_escapesBackslashes", () => {
  it("doubles backslashes and quotes", () => {
    expect(str("C:\\img\\a.png")).toBe('"C:\\\\img\\\\a.png"');
    expect(str('a"b')).toBe('"a\\"b"');
  });
});

describe("num_nonFinite_throws", () => {
  it("emits finite numbers and rejects NaN/Infinity", () => {
    expect(num(3.5)).toBe("3.5");
    expect(() => num(NaN)).toThrow();
    expect(() => num(Infinity)).toThrow();
  });
});

describe("bool_value_mapsToPdbConstants", () => {
  it("maps booleans to TRUE/FALSE", () => {
    expect(bool(true)).toBe("TRUE");
    expect(bool(false)).toBe("FALSE");
  });
});

describe("exportExpr_path_usesGenericSave", () => {
  it("emits the 3-arg GIMP 3.0 gimp-file-save with the escaped path", () => {
    const expr = exportExpr("/out/p.png");
    expect(expr).toContain("gimp-file-save RUN-NONINTERACTIVE image");
    expect(expr).toContain('"/out/p.png"');
    expect(expr).not.toContain("drawable");
  });
});

describe("buildLoadOpSave_spec_producesLifecycle", () => {
  it("includes load, op, flatten, export, and delete", () => {
    const script = buildLoadOpSave({
      inputPath: "/in.png",
      outputPath: "/out.png",
      op: "(gimp-image-scale image 10 10)",
    });
    expect(script).toContain("gimp-file-load");
    expect(script).toContain("(gimp-image-scale image 10 10)");
    expect(script).toContain("gimp-image-flatten");
    expect(script).toContain("gimp-file-save");
    expect(script).toContain("gimp-image-delete");
    expect(script).toContain(ACTIVE_DRAWABLE);
  });

  it("omits the op line when no op is given", () => {
    const script = buildLoadOpSave({ inputPath: "/in.png", outputPath: "/out.png" });
    expect(script).toContain("gimp-file-load");
    expect(script).toContain("gimp-image-flatten");
  });

  it("skips flatten when flatten is false", () => {
    const script = buildLoadOpSave({
      inputPath: "/in.png",
      outputPath: "/out.png",
      op: "(noop)",
      flatten: false,
    });
    expect(script).not.toContain("gimp-image-flatten");
  });
});
