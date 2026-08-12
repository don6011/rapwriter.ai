import { describe, expect, test } from "bun:test";
import { preferredRoughTakeMimeType, resolvedRoughTakeMimeType } from "./rough-take-mime";

describe("rough take recording format selection", () => {
  test("prefers Safari's AAC/MP4 recording format", () => {
    expect(preferredRoughTakeMimeType((mimeType) => mimeType.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  test("falls back to Chromium's Opus/WebM recording format", () => {
    expect(preferredRoughTakeMimeType((mimeType) => mimeType === "audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
  });

  test("preserves the negotiated MP4 container when WebKit leaves recorder metadata blank", () => {
    expect(resolvedRoughTakeMimeType("", "audio/mp4;codecs=mp4a.40.2")).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  test("uses recorder metadata when it is present", () => {
    expect(resolvedRoughTakeMimeType("audio/webm;codecs=opus", "audio/mp4")).toBe("audio/webm;codecs=opus");
  });
});
