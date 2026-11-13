import { cookies } from "next/headers";
import { allowedBrandId, BRAND_COOKIE, getBrand, type Brand } from "./brand";

// ?brand= wins, then the preview cookie, then the deployment default
export async function requestBrand(queryBrand?: string | null): Promise<Brand> {
  const jar = await cookies();
  return getBrand(allowedBrandId(queryBrand ?? jar.get(BRAND_COOKIE)?.value));
}
