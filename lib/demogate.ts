// Helpers for the optional password gate on demo hosting. Web Crypto only, so they run in middleware too.
export const DEMO_COOKIE = "demo_session";

// cookie value: an HMAC keyed with DEMO_SESSION_SECRET (falls back to the password)
export async function sessionValue(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.DEMO_SESSION_SECRET || password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`demo-session:${password}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// relative paths only, so the login can't be used as an open redirect
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/demo-login") || next.startsWith("/api/demo-login")) return "/";
  return next;
}
