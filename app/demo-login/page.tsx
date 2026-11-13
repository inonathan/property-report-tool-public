import type { Metadata } from "next";
import { safeNext } from "@/lib/demogate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo access", robots: { index: false, follow: false } };

export default async function DemoLogin({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="panel-page">
      <div className="panel">
        <h1>Private demo</h1>
        <p>This build only uses fictional data. Enter the password you were given to continue.</p>
        <form method="post" action="/api/demo-login" className="actions">
          <input type="hidden" name="next" value={safeNext(next)} />
          <input
            className="ef-input"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={error ? "true" : undefined}
          />
          {error && (
            <p role="alert" className="err">
              {error === "wait" ? "Too many attempts. Wait a few minutes and try again." : "That password isn’t right."}
            </p>
          )}
          <button className="ef-btn primary" type="submit" style={{ padding: 16 }}>Open the demo</button>
        </form>
      </div>
    </div>
  );
}
