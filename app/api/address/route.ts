import { NextResponse } from "next/server";
import { allowedBrandId, getBrand } from "@/lib/brand";
import { getProvider } from "@/lib/providers";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  // lookups can be billed by the provider, so keep autocomplete on a short leash
  if (!rateLimit(`addr:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ matches: [] }, { status: 429 });
  }
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.slice(0, 120) ?? "";
  const providerName = getBrand(allowedBrandId(params.get("brand"))).provider;
  if (q.trim().length < 3) return NextResponse.json({ matches: [] });
  try {
    const matches = await getProvider(providerName).searchAddresses(q, 6);
    return NextResponse.json({
      matches: matches.map((m) => ({ id: m.id, full: m.full })),
    });
  } catch (e) {
    console.error("[address]", e instanceof Error ? e.message : e);
    return NextResponse.json({ matches: [], error: "Address search is temporarily unavailable." }, { status: 503 });
  }
}
