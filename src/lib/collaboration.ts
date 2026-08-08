export const collaborationStatuses = ["submitted", "countered", "accepted", "declined", "canceled", "completed"] as const;
export type CollaborationStatus = (typeof collaborationStatuses)[number];
export type CollaborationAction = "accept" | "counter" | "decline" | "accept_counter" | "cancel";

const transitions: Record<CollaborationAction, { from: CollaborationStatus[]; to: CollaborationStatus; actor: "artist" | "producer" }> = {
  accept: { from: ["submitted"], to: "accepted", actor: "producer" },
  counter: { from: ["submitted"], to: "countered", actor: "producer" },
  decline: { from: ["submitted", "countered"], to: "declined", actor: "producer" },
  accept_counter: { from: ["countered"], to: "accepted", actor: "artist" },
  cancel: { from: ["submitted", "countered"], to: "canceled", actor: "artist" },
};

export function collaborationTransition(status: CollaborationStatus, action: CollaborationAction, actor: "artist" | "producer") {
  const transition = transitions[action];
  if (!transition || transition.actor !== actor || !transition.from.includes(status)) return null;
  return transition.to;
}

export function collaborationRoomIsOpen(status: CollaborationStatus) {
  return status === "accepted" || status === "completed";
}
