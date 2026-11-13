import { clientIp, rateLimit } from "@/lib/ratelimit";
import { DEMO_COOKIE, safeEqual, safeNext, sessionValue } from "@/lib/demogate";

export const dynamic = "force-dynamic";

const redirect = (to: string, extra: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { location: to, "cache-control": "no-store", ...extra } });

export async function POST(req: Request) {
  const password = process.env.DEMO_PASSWORD;
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!password) return redirect(next);

  const rl = rateLimit(`demo-login:${clientIp(req.headers)}`, 10, 10 * 60_000);
  if (!rl.ok) return redirect(`/demo-login?error=wait&next=${encodeURIComponent(next)}`);

  const given = String(form.get("password") ?? "");
  if (!safeEqual(given, password)) return redirect(`/demo-login?error=1&next=${encodeURIComponent(next)}`);

  const secure = (req.headers.get("x-forwarded-proto") ?? "").includes("https");
  const expires = process.env.DEMO_EXPIRES_AT ? new Date(process.env.DEMO_EXPIRES_AT) : null;
  const maxAge = Math.max(60, Math.min(60 * 60 * 24 * 21, expires ? Math.floor((expires.getTime() - Date.now()) / 1000) : 60 * 60 * 24 * 21));
  const cookie = `${DEMO_COOKIE}=${await sessionValue(password)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  return redirect(next, { "set-cookie": cookie });
}
