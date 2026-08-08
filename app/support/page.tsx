import type { Metadata } from "next";
import { SupportCenter } from "@/components/SupportCenter";

export const metadata: Metadata = { title: "Support Center | RapWriter.ai" };

export default function SupportPage() {
  return <SupportCenter />;
}
