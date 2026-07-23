import { describe, expect, test } from "bun:test";
import { generateProducerAction, producerActionEntitlement } from "./producer-actions.ts";

const lyrics = [
  "I think diamonds dancing in the dark and they know the vibes",
  "City lights late nights I'm chasing bigger dreams",
].join("\n");

function generate(actionType, attempt = 0) {
  return generateProducerAction({
    actionType,
    sectionName: "Hook",
    sectionContent: lyrics,
    attempt,
    beat: { bpm: 84 },
    studioDna: {
      environment: "Midnight Session",
      goal: "Hit Record",
      style: "Street",
      mood: "Pain",
      producer: "Hook Doctor",
    },
  });
}

describe("producer action engine", () => {
  test("maps each action to its server-enforced membership capability", () => {
    expect(producerActionEntitlement("pocket")).toBe("ghostwriter");
    expect(producerActionEntitlement("hook")).toBe("hook_doctor");
    expect(producerActionEntitlement("rewrite")).toBe("rewrite");
    expect(producerActionEntitlement("commercial")).toBe("commercial_pass");
  });

  test.each(["hook", "rewrite", "commercial", "pocket"])("builds a usable %s proposal", (actionType) => {
    const proposal = generate(actionType);

    expect(proposal.proposedContent.trim().length).toBeGreaterThan(0);
    expect(proposal.rationale.trim().length).toBeGreaterThan(0);
    expect(proposal.changes.length).toBeGreaterThan(0);
    expect(proposal.provider).toBe("local");
    expect(proposal.proposedContent.toLowerCase()).toMatch(/diamonds|city lights/);
  });

  test("hook doctor creates a memorable return pattern", () => {
    expect(generate("hook").proposedContent.split("\n")).toHaveLength(4);
  });

  test("producer rewrite changes a soft opening without replacing the artist's image", () => {
    const proposal = generate("rewrite");

    expect(proposal.proposedContent).not.toBe(lyrics);
    expect(proposal.proposedContent).toContain("diamonds dancing in the dark");
  });

  test("pocket adjustment splits an overpacked line", () => {
    const proposal = generateProducerAction({
      actionType: "pocket",
      sectionName: "Verse 1",
      sectionContent: "Every word that I remember from the winter made me stronger when the pressure started building in the city",
      attempt: 0,
      beat: { bpm: 128 },
      studioDna: {
        environment: "Midnight Session",
        goal: "Hit Record",
        style: "Street",
        mood: "Pain",
        producer: "Hook Doctor",
      },
    });

    expect(proposal.proposedContent.split("\n").length).toBeGreaterThan(1);
  });

  test("try another rotates the selected hook landing", () => {
    expect(generate("hook", 1).proposedContent).not.toBe(generate("hook", 0).proposedContent);
  });
});
