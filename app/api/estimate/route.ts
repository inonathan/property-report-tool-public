import { after, NextResponse } from "next/server";
import { processReport } from "@/lib/pipeline";
import { getProvider } from "@/lib/providers";
import { allowedBrandId, getBrand } from "@/lib/brand";
import { clientIp, rateLimit, verifyTurnstile } from "@/lib/ratelimit";
import { createLeadAndReport } from "@/lib/store";
import { newToken } from "@/lib/tokens";
import { estimateRequestSchema } from "@/lib/validation";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = estimateRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Please check your details.", field: first?.path[0] }, { status: 400 });
  }
  const input = parsed.data;

  // pretend it worked so bots learn nothing
  if (input.website) return NextResponse.json({ ok: true, token: "x".repeat(43), status: "queued" }, { status: 202 });

  // each report can cost a provider call
  const perIp = rateLimit(`est-ip:${ip}`, 6, 3_600_000);
  const perEmail = rateLimit(`est-email:${input.email}`, 4, 86_400_000);
  if (!perIp.ok || !perEmail.ok) {
    const retry = Math.max(perIp.retryAfterSec, perEmail.retryAfterSec);
    return NextResponse.json(
      { error: "You've requested several reports recently. Please try again later, or call us and we'll help you directly." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }

  if (!(await verifyTurnstile(input.turnstileToken, ip))) {
    return NextResponse.json({ error: "Verification failed. Please refresh the page and try again." }, { status: 400 });
  }

  // resolve the id again on the server instead of trusting the label from the browser
  const provider = getProvider(getBrand(allowedBrandId(input.brand)).provider);
  let address;
  try {
    address = await provider.resolveAddress(input.addressId);
  } catch (e) {
    console.error("[estimate:resolve]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "We couldn't look up that address right now. Please try again shortly." }, { status: 503 });
  }
  if (!address) {
    return NextResponse.json({ error: "Please choose your address from the suggestions.", field: "addressId" }, { status: 400 });
  }

  const token = newToken();
  const { report } = await createLeadAndReport({
    name: input.name,
    email: input.email,
    phone: input.phone,
    marketingConsent: input.marketingConsent,
    source: input.source ?? null,
    addressId: address.id,
    addressFull: address.full,
    address,
    provider: provider.id,
    brandId: allowedBrandId(input.brand),
    token,
    ttlDays: Number(process.env.REPORT_TTL_DAYS || 90),
  });

  // answer now, do the slow work after the response
  after(() => processReport(report.id, token));

  return NextResponse.json({ ok: true, token, status: "queued" }, { status: 202 });
}
