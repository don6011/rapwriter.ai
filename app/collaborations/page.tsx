import type { Metadata } from "next";
import { CollaborationWorkspace } from "@/components/CollaborationWorkspace";

export const metadata: Metadata = {
  title: "Collaborations | RapWriter.ai",
  description: "Private artist and producer collaboration rooms.",
};

export default function CollaborationsPage() {
  return <CollaborationWorkspace />;
}
