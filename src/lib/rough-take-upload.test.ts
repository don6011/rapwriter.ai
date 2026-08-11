import { describe, expect, test } from "bun:test";
import { normalizeRoughTakeMimeType, roughTakeExtension } from "./rough-take-upload";

describe("rough take browser audio formats", () => {
  test("accepts Chrome Opus recordings with codec parameters", () => {
    expect(normalizeRoughTakeMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(roughTakeExtension("audio/webm")).toBe("webm");
  });

  test("accepts Safari MP4 recordings with codec parameters", () => {
    expect(normalizeRoughTakeMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(roughTakeExtension("audio/mp4")).toBe("m4a");
  });

  test("rejects non-audio and unsupported formats", () => {
    expect(normalizeRoughTakeMimeType("video/webm;codecs=opus")).toBeNull();
    expect(normalizeRoughTakeMimeType("application/octet-stream")).toBeNull();
  });
});
