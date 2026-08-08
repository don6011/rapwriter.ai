import { describe, expect, test } from "bun:test";
import {
  beatLicenseEntitlementId,
  getProducerBeatPreviewDuration,
  getProducerBeatPreviewPath,
  isOwnedProducerPreviewPath,
  producerBeatIdFromCatalogId,
  producerBeatPreviewMetadata,
} from "./producer-beat-media.ts";

const beatId = "f16f5380-6d1a-4b9b-8b4c-880e17f76e32";
const ownerId = "80aa57d3-e657-44d5-a005-a9f955212789";

describe("producer beat media boundary", () => {
  test("normalizes producer catalog IDs", () => {
    expect(producerBeatIdFromCatalogId(`producer-beat-${beatId}`)).toBe(beatId);
    expect(producerBeatIdFromCatalogId(beatId)).toBe(beatId);
    expect(producerBeatIdFromCatalogId("not-a-beat")).toBeNull();
  });

  test("accepts only an owned preview path distinct from the master", () => {
    const previewPath = `${ownerId}/previews/store.wav`;
    expect(isOwnedProducerPreviewPath(previewPath, ownerId, `${ownerId}/beats/master.wav`)).toBe(true);
    expect(isOwnedProducerPreviewPath(`${ownerId}/beats/master.wav`, ownerId, `${ownerId}/beats/master.wav`)).toBe(false);
    expect(isOwnedProducerPreviewPath(`${ownerId}/previews/../beats/master.wav`, ownerId)).toBe(false);
    expect(isOwnedProducerPreviewPath(`someone-else/previews/store.wav`, ownerId)).toBe(false);
  });

  test("stores bounded preview metadata and stable entitlement IDs", () => {
    const metadata = producerBeatPreviewMetadata(`${ownerId}/previews/store.wav`, 42, { featured: true });
    expect(getProducerBeatPreviewPath(metadata)).toBe(`${ownerId}/previews/store.wav`);
    expect(getProducerBeatPreviewDuration(metadata)).toBe(30);
    expect(metadata.featured).toBe(true);
    expect(beatLicenseEntitlementId(beatId, "Premium Lease")).toBe(`beat-license:${beatId}:premium-lease`);
  });
});
