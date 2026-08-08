import { describe, expect, test } from "bun:test";
import { collaborationRoomIsOpen, collaborationTransition } from "./collaboration.ts";

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

  test("reserves completion for artist approval of a delivered file", () => {
    expect(collaborationTransition("accepted", "complete", "producer")).toBeNull();
    expect(collaborationTransition("accepted", "complete", "artist")).toBeNull();
  });

  test("opens the private room only after agreement", () => {
    expect(collaborationRoomIsOpen("submitted")).toBe(false);
    expect(collaborationRoomIsOpen("countered")).toBe(false);
    expect(collaborationRoomIsOpen("accepted")).toBe(true);
    expect(collaborationRoomIsOpen("completed")).toBe(true);
  });
});
