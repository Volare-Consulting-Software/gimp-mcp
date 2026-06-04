import { describe, expect, it } from "vitest";

import { extractPayload, messageExpr, MSG_END, MSG_START } from "../src/gimp/message.js";

describe("messageExpr_payload_wrapsInMarkers", () => {
  it("wraps the payload expression in a gimp-message with markers", () => {
    const expr = messageExpr('"hello"');
    expect(expr).toContain("gimp-message");
    expect(expr).toContain(MSG_START);
    expect(expr).toContain(MSG_END);
  });
});

describe("extractPayload_markers_returnsInnerText", () => {
  it("extracts text between the markers from mixed output", () => {
    const stderr = `noise\n${MSG_START}width=10\nheight=20${MSG_END}\nmore noise`;
    expect(extractPayload("", stderr)).toBe("width=10\nheight=20");
  });

  it("falls back to trimmed haystack when markers are absent", () => {
    expect(extractPayload("out", "err")).toBe("out\nerr");
  });
});
