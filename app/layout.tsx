import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brandStyle } from "@/lib/brand";
import { requestBrand } from "@/lib/brand-request";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await requestBrand();
  return {
    title: `Instant property estimate | ${brand.name}`,
    description: `Get a free instant property estimate and report from ${brand.name}.`,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await requestBrand();
  return (
    <html lang="en-NZ">
      <body style={brandStyle(brand)}>{children}</body>
    </html>
  );
}
