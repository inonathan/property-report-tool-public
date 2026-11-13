import type { CSSProperties } from "react";
import defaultBrand from "@/brands/default.json";
import harbourCo from "@/brands/harbour-co.json";
import kauriLane from "@/brands/kauri-lane.json";

// One JSON file per agency in /brands, registered below. BRAND_ID picks the one a deployment uses.
// BRAND_SWITCH=1 lets visitors preview the other brands, meant for demos only.
export type Brand = {
  id: string;
  label: string;
  name: string;
  logoText: string;
  logoUrl: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  // target of the contact and appraisal buttons; empty falls back to /contact
  appraisalUrl: string;
  defaultSuburb: string;
  privacyUrl: string;
  font: string;
  // "mock" | "cotality" | "valocity"; empty means the PROVIDER env var
  provider?: string;
  colors: { ink: string; accent: string; accentDark: string; panel: string; muted: string; line: string };
  // printed on every report
  reportDisclaimer: string;
};

export const BRANDS: Record<string, Brand> = {
  [defaultBrand.id]: defaultBrand,
  [harbourCo.id]: harbourCo,
  [kauriLane.id]: kauriLane,
};

export const BRAND_COOKIE = "brand_id";

export const switchEnabled = () => process.env.BRAND_SWITCH === "1";

export function defaultBrandId(): string {
  const id = process.env.BRAND_ID || "default";
  return BRANDS[id] ? id : "default";
}

// unknown ids fall back to the default; APPRAISAL_URL overrides the contact link
export function getBrand(id?: string | null): Brand {
  const b = (id && BRANDS[id]) || BRANDS[defaultBrandId()];
  return { ...b, appraisalUrl: process.env.APPRAISAL_URL || b.appraisalUrl || "/contact" };
}

// a requested brand is only honoured when previewing is on
export function allowedBrandId(requested?: string | null): string {
  return switchEnabled() && requested && BRANDS[requested] ? requested : defaultBrandId();
}

// the colours and font reach the CSS through variables
export function brandStyle(b: Brand): CSSProperties {
  return {
    "--ink": b.colors.ink,
    "--accent": b.colors.accent,
    "--accent-dark": b.colors.accentDark,
    "--panel": b.colors.panel,
    "--muted": b.colors.muted,
    "--line": b.colors.line,
    "--font": b.font,
  } as CSSProperties;
}
