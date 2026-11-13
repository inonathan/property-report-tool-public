import EstimateForm from "@/components/EstimateForm";
import { BRANDS, switchEnabled } from "@/lib/brand";
import { requestBrand } from "@/lib/brand-request";

export const dynamic = "force-dynamic";

export default async function Home() {
  const brand = await requestBrand();
  const demo = (brand.provider || process.env.PROVIDER || "mock") === "mock";

  return (
    <>
      {demo && <div className="proto-banner">Demo build: every figure shown is fictional.</div>}

      <div className="landing">
        <nav className="nav" aria-label="Main">
          <a className="wordmark" href="/">{brand.logoText}</a>
          <div className="nav-right">
            <span>{brand.phone}</span>
            <a className="pill" href={brand.appraisalUrl}>Talk to an agent</a>
          </div>
        </nav>

        <main>
          <section className="hero">
            <div>
              <span className="kicker">{brand.defaultSuburb} property</span>
              <h1>
                What is your {brand.defaultSuburb} home <em>really</em> worth?
              </h1>
              <p className="lede">
                Type your address and get an instant report: estimated value, recent sales nearby and how the local market is moving.
              </p>
              <EstimateForm brandId={brand.id} privacyUrl={brand.privacyUrl} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || undefined} />
            </div>

            <aside className="sample" aria-label="Example of a report">
              <span className="sample-tag">Example</span>
              <small>Estimated value</small>
              <div className="addr">12 Example Street</div>
              <div className="value">$845,000</div>
              <svg className="spark" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0,52 C30,48 50,56 80,44 S130,40 160,30 S220,34 250,18 L300,10 L300,70 L0,70 Z" fill="var(--accent)" opacity=".22" />
                <path d="M0,52 C30,48 50,56 80,44 S130,40 160,30 S220,34 250,18 L300,10" fill="none" stroke="var(--accent-dark)" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <div className="sample-stats">
                <div><b>$790k–$900k</b><span>Likely range</span></div>
                <div><b>+4.2%</b><span>12-month change</span></div>
                <div><b>5</b><span>Nearby sales</span></div>
              </div>
            </aside>
          </section>

          <section className="steps" aria-label="How it works">
            <div className="step"><div className="n">1</div><h3>Find your address</h3><p>Start typing and pick your property from the list.</p></div>
            <div className="step"><div className="n">2</div><h3>Tell us where to send it</h3><p>Your report is private. It arrives by secure link and by email.</p></div>
            <div className="step"><div className="n">3</div><h3>Read your report</h3><p>Value, comparable sales, market trends and a rental estimate in one place.</p></div>
          </section>
        </main>
      </div>

      {switchEnabled() && (
        <nav className="brand-switch" aria-label="Preview as another agency">
          <span>Preview as</span>
          {Object.values(BRANDS).map((b) => (
            <a key={b.id} href={`/api/brand?id=${b.id}&next=/`} aria-current={b.id === brand.id ? "true" : undefined}>
              {b.label}
            </a>
          ))}
        </nav>
      )}

      <footer className="site-footer">
        &copy; {new Date().getFullYear()} {brand.name}. Estimates are automated and are not a valuation.
      </footer>
    </>
  );
}
