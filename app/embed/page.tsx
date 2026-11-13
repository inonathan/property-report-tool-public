import EstimateForm from "@/components/EstimateForm";
import { brandStyle } from "@/lib/brand";
import { requestBrand } from "@/lib/brand-request";

export const dynamic = "force-dynamic";

// just the form, meant for the iframe that public/embed.js creates
export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ src?: string; brand?: string }> }) {
  const { src, brand: queryBrand } = await searchParams;
  const brand = await requestBrand(queryBrand);
  return (
    <div style={brandStyle(brand)}>
      <EstimateForm
        embed
        brandId={brand.id}
        source={src?.slice(0, 500)}
        privacyUrl={brand.privacyUrl}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || undefined}
      />
    </div>
  );
}
