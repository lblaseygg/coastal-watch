import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Puerto Rico Coastal Watch",
  description:
    "Map coastal access and development cases across Puerto Rico using source-backed public reporting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
