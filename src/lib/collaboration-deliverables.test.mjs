import { describe, expect, test } from "bun:test";
import {
  MAX_COLLABORATION_FILE_BYTES,
  collaborationFileError,
  collaborationFilePath,
  ownsCollaborationFilePath,
} from "./collaboration-deliverables.ts";

const requestId = "11111111-1111-4111-8111-111111111111";
const producerId = "22222222-2222-4222-8222-222222222222";

describe("collaboration deliverable files", () => {
  test("accepts supported audio and archive files", () => {
    expect(collaborationFileError({ name: "final.wav", type: "audio/wav", size: 24_000_000 })).toBeNull();
    expect(collaborationFileError({ name: "stems.zip", type: "application/zip", size: MAX_COLLABORATION_FILE_BYTES })).toBeNull();
  });

  test("rejects unsupported and oversized files", () => {
    expect(collaborationFileError({ name: "notes.pdf", type: "application/pdf", size: 1000 })).toContain("MP3");
    expect(collaborationFileError({ name: "final.wav", type: "audio/wav", size: MAX_COLLABORATION_FILE_BYTES + 1 })).toContain("250 MB");
  });

  test("scopes generated paths to the collaboration and producer", () => {
    const path = collaborationFilePath(requestId, producerId, "audio/mpeg", "33333333-3333-4333-8333-333333333333");
    expect(path).toBe(`${requestId}/${producerId}/33333333-3333-4333-8333-333333333333.mp3`);
    expect(ownsCollaborationFilePath(path, requestId, producerId)).toBe(true);
    expect(ownsCollaborationFilePath(path, requestId, "44444444-4444-4444-8444-444444444444")).toBe(false);
    expect(ownsCollaborationFilePath(`${requestId}/${producerId}/../private.wav`, requestId, producerId)).toBe(false);
  });
});
