import { describe, expect, test } from "bun:test";
import { privateBeatImportCompleteSchema, privateBeatImportSchema } from "./schemas.ts";

const validImport = {
  title: "Night Drive",
  producer: "Independent producer",
  bpm: 92,
  musical_key: "F# Minor",
  duration_seconds: 184,
  file_name: "night-drive.wav",
  file_size: 24 * 1024 * 1024,
  mime_type: "audio/wav",
  rights_confirmed: true,
};

describe("private beat imports", () => {
  test("accepts an owned MP3 or WAV metadata contract", () => {
    expect(privateBeatImportSchema.safeParse(validImport).success).toBe(true);
    expect(privateBeatImportCompleteSchema.safeParse({
      ...validImport,
      storage_path: "owner-id/beat-id.wav",
      content_type: "audio/wav",
    }).success).toBe(true);
  });

  test("requires rights confirmation and enforces upload limits", () => {
    expect(privateBeatImportSchema.safeParse({ ...validImport, rights_confirmed: false }).success).toBe(false);
    expect(privateBeatImportSchema.safeParse({ ...validImport, file_size: 101 * 1024 * 1024 }).success).toBe(false);
    expect(privateBeatImportSchema.safeParse({ ...validImport, bpm: 300 }).success).toBe(false);
  });
});
