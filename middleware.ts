import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, safeEqual, sessionValue } from "@/lib/demogate";

// Optional password gate for demo hosting, only active when DEMO_PASSWORD is set.
// Visitors sign in on /demo-login; Basic auth also works for scripts and the PDF renderer.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};

const OPEN_PATHS = ["/demo-login", "/api/demo-login"];

export async function middleware(req: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return NextResponse.next();

  const expires = process.env.DEMO_EXPIRES_AT;
  if (expires && Date.now() > new Date(expires).getTime()) {
    return new NextResponse("This demonstration has ended. Please contact the sender for a new link.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" },
    });
  }

  const { pathname, search } = req.nextUrl;
  if (OPEN_PATHS.includes(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-robots-tag", "noindex, nofollow");
    return res;
  }

  let authed = false;

  const cookie = req.cookies.get(DEMO_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await sessionValue(password))) authed = true;

  if (!authed) {
    const header = req.headers.get("authorization") || "";
    if (header.startsWith("Basic ")) {
      try {
        const [u, ...rest] = atob(header.slice(6)).split(":");
        if (safeEqual(u, process.env.DEMO_USER || "demo") && safeEqual(rest.join(":"), password)) authed = true;
      } catch {
        /* not authed */
      }
    }
  }

  if (authed) {
    const res = NextResponse.next();
    res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return res;
  }

  // pages go to the sign-in form, API calls get a 401
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json", "x-robots-tag": "noindex, nofollow" },
    });
  }
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const res = NextResponse.redirect(`${proto}://${host}/demo-login?next=${encodeURIComponent(pathname + search)}`, 303);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "no-store");
  return res;
}
