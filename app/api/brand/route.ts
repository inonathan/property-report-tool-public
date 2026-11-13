import { allowedBrandId, BRAND_COOKIE, defaultBrandId, switchEnabled } from "@/lib/brand";
import { safeNext } from "@/lib/demogate";

export const dynamic = "force-dynamic";

// only works with BRAND_SWITCH=1: remembers which example brand to preview
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const headers: Record<string, string> = { location: next, "cache-control": "no-store" };
  if (switchEnabled()) {
    const id = allowedBrandId(url.searchParams.get("id"));
    const secure = (req.headers.get("x-forwarded-proto") ?? "").includes("https");
    headers["set-cookie"] =
      id === defaultBrandId()
        ? `${BRAND_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`
        : `${BRAND_COOKIE}=${id}; Path=/; Max-Age=86400; SameSite=Lax${secure ? "; Secure" : ""}`;
  }
  return new Response(null, { status: 303, headers });
}
