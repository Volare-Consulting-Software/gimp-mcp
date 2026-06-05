import { describe, expect, it } from "vitest";

import { parseFrames } from "../src/gimp/session.js";

const MAGIC = 0x47;

/** Build a wire response frame: 'G' | error | len_hi | len_lo | body. */
function frame(message: string, error = 0): Buffer {
  const body = Buffer.from(message, "utf8");
  const header = Buffer.from([MAGIC, error, (body.length >> 8) & 0xff, body.length & 0xff]);
  return Buffer.concat([header, body]);
}

describe("parseFrames_wireProtocol_decodesResponses", () => {
  it("decodes a single success frame and leaves no remainder", () => {
    const { frames, rest } = parseFrames(frame("(1 2 3)"));
    expect(frames).toEqual([{ error: 0, message: "(1 2 3)" }]);
    expect(rest.length).toBe(0);
  });

  it("decodes an error frame (error byte = 1)", () => {
    const { frames } = parseFrames(frame("Error: no such layer", 1));
    expect(frames).toEqual([{ error: 1, message: "Error: no such layer" }]);
  });

  it("decodes multiple frames in one chunk", () => {
    const buf = Buffer.concat([frame("first"), frame("second"), frame("third")]);
    const { frames, rest } = parseFrames(buf);
    expect(frames.map((f) => f.message)).toEqual(["first", "second", "third"]);
    expect(rest.length).toBe(0);
  });

  it("holds back a partial frame split across reads", () => {
    const full = frame("hello world");
    const a = parseFrames(full.subarray(0, 6)); // header + 2 body bytes
    expect(a.frames).toHaveLength(0);
    expect(a.rest.length).toBe(6);

    const b = parseFrames(Buffer.concat([a.rest, full.subarray(6)]));
    expect(b.frames).toEqual([{ error: 0, message: "hello world" }]);
    expect(b.rest.length).toBe(0);
  });

  it("returns no frames when only a partial header is present", () => {
    const { frames, rest } = parseFrames(Buffer.from([MAGIC, 0]));
    expect(frames).toHaveLength(0);
    expect(rest.length).toBe(2);
  });

  it("resynchronizes by dropping leading garbage bytes", () => {
    const buf = Buffer.concat([Buffer.from([0x00, 0xff, 0x12]), frame("recovered")]);
    const { frames } = parseFrames(buf);
    expect(frames).toEqual([{ error: 0, message: "recovered" }]);
  });

  it("decodes a maximum-length (65535-byte) message", () => {
    const big = "x".repeat(0xffff);
    const { frames, rest } = parseFrames(frame(big));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.message.length).toBe(0xffff);
    expect(rest.length).toBe(0);
  });

  it("handles UTF-8 multibyte bodies using byte length, not char length", () => {
    const { frames } = parseFrames(frame("café — ©"));
    expect(frames).toEqual([{ error: 0, message: "café — ©" }]);
  });
});
