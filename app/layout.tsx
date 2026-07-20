import type { Metadata, Viewport } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rapwriter.ai"),
  title: "RapWriter.ai - Sharpen Your Pen",
  description:
    "The Prep Studio. A premium digital environment where artists go from idea to Booth Ready.",
  icons: {
    icon: "/brand/rapwriter-192.png",
    apple: "/brand/rapwriter-180.png",
  },
  openGraph: {
    title: "RapWriter.ai - The Prep Studio",
    description:
      "Go from idea to Booth Ready. Not an AI lyric generator - a luxury prep studio for artists.",
    type: "website",
    images: ["/brand/rapwriter-logo-tight.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070708",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
