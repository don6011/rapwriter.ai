import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("collaboration rollout boundary", () => {
  const producerPortal = readFileSync(new URL("../components/ProducerPortal.tsx", import.meta.url), "utf8");
  const storefront = readFileSync(new URL("../components/ProducerStorefront.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/CollaborationWorkspace.tsx", import.meta.url), "utf8");

  test("hides unfinished collaboration entry points", () => {
    expect(producerPortal).not.toContain('href="/collaborations');
    expect(producerPortal).not.toContain("ProducerCollaborationPanel");
    expect(storefront).not.toContain("Work Together");
    expect(storefront).not.toContain("Request a session with this beat");
    expect(storefront).not.toContain("WorkRequestSheet");
  });

  test("preserves the collaboration implementation for a later rollout", () => {
    expect(workspace).toContain('fetch("/api/collaborations"');
    expect(workspace).toContain("CollaborationHandoff");
  });
});
