import type { Metadata } from "next";
import { ProducerStorefront } from "@/components/ProducerStorefront";

type ProducerStorefrontPageProps = {
  params: Promise<{ handle: string }>;
};

export const metadata: Metadata = {
  title: "Producer Storefront | RapWriter.ai",
  description: "Preview producer beats and start a writing session in RapWriter.",
};

export default async function ProducerStorefrontPage({ params }: ProducerStorefrontPageProps) {
  const { handle } = await params;
  return <ProducerStorefront handle={handle} />;
}
