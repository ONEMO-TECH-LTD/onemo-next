import type { Metadata } from "next";
import "./globals.css";
// DS token cascade — imported DIRECTLY (not via globals.css's Tailwind @theme pipeline) so the
// full primitive→alias→semantic :root cascade is delivered app-wide UN-TREE-SHAKEN. Every consumer
// (app body + all converted screens) uses plain var(--sem-…); routing these through Tailwind @theme
// purged the ~1450 tokens the app doesn't globally reference, breaking converted screens.
import "./tokens/tokens.css";

export const metadata: Metadata = {
  title: "ONEMO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
