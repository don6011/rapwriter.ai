import { describe, expect, test } from "bun:test";
import {
  accountTypeLabel,
  hasArtistWorkspace,
  hasProducerWorkspace,
  producerUpgradeAccountType,
} from "./account-role.ts";

describe("account roles", () => {
  test("only producer-capable accounts expose the producer workspace", () => {
    expect(hasProducerWorkspace("artist")).toBe(false);
    expect(hasProducerWorkspace("producer")).toBe(true);
    expect(hasProducerWorkspace("artist_producer")).toBe(true);
    expect(hasProducerWorkspace("admin")).toBe(true);
  });

  test("artist activation only appears for artist-capable accounts", () => {
    expect(hasArtistWorkspace("artist")).toBe(true);
    expect(hasArtistWorkspace("artist_producer")).toBe(true);
    expect(hasArtistWorkspace("admin")).toBe(true);
    expect(hasArtistWorkspace("producer")).toBe(false);
  });

  test("creating a producer profile preserves broader account access", () => {
    expect(producerUpgradeAccountType("artist")).toBe("artist_producer");
    expect(producerUpgradeAccountType("producer")).toBe("producer");
    expect(producerUpgradeAccountType("artist_producer")).toBe("artist_producer");
    expect(producerUpgradeAccountType("admin")).toBe("admin");
  });

  test("labels describe the workspace without overpromising verification", () => {
    expect(accountTypeLabel("artist")).toBe("Artist profile");
    expect(accountTypeLabel("producer")).toBe("Producer account");
    expect(accountTypeLabel("artist_producer")).toBe("Artist + Producer");
  });
});
