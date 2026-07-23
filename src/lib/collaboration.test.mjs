import { describe, expect, test } from "bun:test";
import { collaborationTransition } from "./collaboration.ts";

describe("producer collaboration transitions", () => {
  test("lets a producer accept or counter a submitted request", () => {
    expect(collaborationTransition("submitted", "accept", "producer")).toBe("accepted");
    expect(collaborationTransition("submitted", "counter", "producer")).toBe("countered");
  });

  test("lets the artist accept a producer counter", () => {
    expect(collaborationTransition("countered", "accept_counter", "artist")).toBe("accepted");
  });

  test("rejects actions from the wrong participant or status", () => {
    expect(collaborationTransition("submitted", "accept", "artist")).toBeNull();
    expect(collaborationTransition("accepted", "cancel", "artist")).toBeNull();
    expect(collaborationTransition("declined", "accept", "producer")).toBeNull();
  });

  test("only producers complete accepted work", () => {
    expect(collaborationTransition("accepted", "complete", "producer")).toBe("completed");
    expect(collaborationTransition("accepted", "complete", "artist")).toBeNull();
  });
});
