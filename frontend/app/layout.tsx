import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "EPIONA — Academic Literature Research Assistant",
  description: "AI Literature Assistant for Pharmacy with Grounded Citations & Native PDF Deep-Linking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
