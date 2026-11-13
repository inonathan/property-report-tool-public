/** @type {import('next').NextConfig} */

// sites allowed to put the form in an iframe, comma-separated; "*" allows any
const embedOrigins = (process.env.ALLOWED_EMBED_ORIGINS || "*").split(",").map((s) => s.trim()).filter(Boolean);
const frameAncestors = embedOrigins.includes("*") ? "*" : embedOrigins.join(" ");

const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  async headers() {
    return [
      // only /embed may be framed
      {
        source: "/((?!embed).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/embed",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }],
      },
      // report URLs hold a secret token, so no referrer and no indexing
      {
        source: "/report/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
