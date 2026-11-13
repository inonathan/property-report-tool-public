import { brandStyle, type Brand } from "@/lib/brand";
import { dateNZ, money, moneyShort, monthShort, num } from "@/lib/format";
import type { MarketPoint, PropertyReport } from "@/lib/providers/types";

// One template for both the web page and the PDF (headless Chrome prints this same page).
// Sections whose data is missing are skipped rather than shown empty.

function MarketChart({
  series,
  W = 640,
  H = 210,
  fs = 11,
  labelEvery = 2,
  className = "",
}: {
  series: MarketPoint[];
  W?: number;
  H?: number;
  fs?: number;
  labelEvery?: number;
  className?: string;
}) {
  const L = 50, R = 14, T = 14, B = 28;
  const vals = series.map((p) => p.medianPrice);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || max * 0.02) * 0.25;
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, series.length - 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.medianPrice).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  const ticks = [lo + pad * 0.6, (lo + hi) / 2, hi - pad * 0.6];
  return (
    <svg className={`rp-chart ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Median price over the last 12 months">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray="3 4" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={fs} style={{ fill: "var(--muted)" }}>{moneyShort(t)}</text>
        </g>
      ))}
      <path d={area} style={{ fill: "var(--accent)" }} opacity="0.18" />
      <path d={line} fill="none" style={{ stroke: "var(--accent-dark)" }} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((p, i) => (
        <g key={p.month}>
          {(i === 0 || i === series.length - 1) && <circle cx={x(i)} cy={y(p.medianPrice)} r="4" style={{ fill: "var(--accent-dark)" }} />}
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={fs} style={{ fill: "var(--muted)" }}>{monthShort(p.month)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ReportView({ report, token, print = false, brand }: { report: PropertyReport; token: string; print?: boolean; brand: Brand }) {
  const { property: p, valuation: v, market, rental, comparables } = report;
  const details: [string, string][] = [
    ["Type", p.type ?? "–"],
    ["Bedrooms", num(p.bedrooms)],
    ["Bathrooms", num(p.bathrooms)],
    ["Car parks", num(p.carParks)],
    ["Floor area", num(p.floorAreaM2, " m²")],
    ["Land area", num(p.landAreaM2, " m²")],
    ["Year built", num(p.yearBuilt).replace(",", "")],
    ["Legal description", p.legalDescription ?? "–"],
  ];
  const shown = details.filter(([, val]) => val !== "–");
  // where the estimate sits between the low and high ends of the range bar
  const marker = v && v.high > v.low ? Math.min(92, Math.max(8, ((v.estimate - v.low) / (v.high - v.low)) * 100)) : 50;

  return (
    <div className="rp-page" style={brandStyle(brand)}>
      {!print && (
        <div className="rp-toolbar no-print">
          <span>Private link, prepared for you</span>
          <div className="btns">
            <a className="rp-btn" href={`/api/pdf/${token}`}>Download PDF</a>
            <a className="rp-btn solid" href={brand.appraisalUrl}>Request an appraisal</a>
          </div>
        </div>
      )}

      <article className="rp-sheet">
        {report.isDemo && <div className="rp-watermark" aria-hidden="true">DEMO DATA</div>}

        <header className="rp-head">
          <div className="rp-top">
            <div className="rp-logo">{brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} /> : brand.logoText}</div>
            <div className="rp-meta">Property report &middot; {dateNZ(report.generatedAt)}</div>
          </div>
          <div className="rp-eyebrow">{report.address.suburb}</div>
          <h1>{report.address.street}</h1>
          <p className="sub">{report.address.suburb} {report.address.postcode}</p>
          {report.isDemo && <span className="rp-demo-tag">Fictional demonstration data</span>}
        </header>

        {v && (
          <section className="rp-estimate" aria-label="Estimated value">
            <div className="row">
              <div>
                <div className="label">Estimated value</div>
                <div className="big">{money(v.estimate)}</div>
              </div>
              <div className="rp-conf">Confidence: <b>{v.confidence}</b></div>
            </div>
            <div className="rp-range">
              <div className="rp-track"><i style={{ left: `${marker}%` }} /></div>
              <div className="rp-range-labels">
                <div><span>Low</span><b>{money(v.low)}</b></div>
                <div><span>High</span><b>{money(v.high)}</b></div>
              </div>
            </div>
            <p className="note">As at {dateNZ(v.asAt)}. Automated estimate, not a valuation.</p>
          </section>
        )}

        <div className="rp-inner">
          {shown.length > 0 && (
            <section className="rp-sec">
              <h2>The property</h2>
              <div className="rp-grid">
                {shown.map(([k, val]) => (
                  <div className="rp-cell" key={k}>
                    <div className="k">{k}</div>
                    <div className={`v${k === "Legal description" ? " small" : ""}`}>{val}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {comparables.length > 0 && (
            <section className="rp-sec">
              <h2>Recent sales nearby</h2>
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Sold</th>
                      <th className="r">Price</th>
                      <th className="r">Bed / bath</th>
                      <th className="r hide-sm">Floor</th>
                      <th className="r hide-sm">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparables.map((c) => (
                      <tr key={c.address + c.soldDate}>
                        <td>{c.address}</td>
                        <td className="sold">{dateNZ(c.soldDate)}</td>
                        <td className="r"><b>{money(c.price)}</b></td>
                        <td className="r">{c.bedrooms ?? "–"} / {c.bathrooms ?? "–"}</td>
                        <td className="r hide-sm">{num(c.floorAreaM2, " m²")}</td>
                        <td className="r hide-sm">{c.distanceKm != null ? `${c.distanceKm} km` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {market && market.series.length > 1 && (
            <section className="rp-sec">
              <h2>{market.areaName} market</h2>
              <div className="rp-kpis">
                <div className="rp-cell">
                  <div className="k">Median price</div>
                  <div className="v">{money(market.medianPrice)}</div>
                </div>
                <div className="rp-cell">
                  <div className="k">12-month change</div>
                  <div className={`v ${market.annualChangePct != null && market.annualChangePct < 0 ? "down" : "up"}`}>
                    {market.annualChangePct != null ? `${market.annualChangePct > 0 ? "+" : ""}${market.annualChangePct}%` : "–"}
                  </div>
                </div>
                <div className="rp-cell">
                  <div className="k">Median days to sell</div>
                  <div className="v">{num(market.medianDaysToSell)}</div>
                </div>
              </div>
              {/* two chart sizes so the labels stay readable on phones; CSS picks one */}
              <div className="rp-chartbox">
                <MarketChart series={market.series} className="rp-chart-wide" />
                <MarketChart series={market.series} W={360} H={230} fs={12} labelEvery={3} className="rp-chart-narrow" />
              </div>
            </section>
          )}

          {rental && (
            <section className="rp-sec">
              <h2>Rental estimate</h2>
              <div className="rp-kpis">
                <div className="rp-cell">
                  <div className="k">Per week</div>
                  <div className="v">{money(rental.weeklyEstimate)}</div>
                </div>
                <div className="rp-cell">
                  <div className="k">Likely range</div>
                  <div className="v">{money(rental.weeklyLow)} &ndash; {money(rental.weeklyHigh)}</div>
                </div>
                <div className="rp-cell">
                  <div className="k">Gross yield</div>
                  <div className="v">{rental.grossYieldPct != null ? `${rental.grossYieldPct}%` : "–"}</div>
                </div>
              </div>
            </section>
          )}

          <section className="rp-cta">
            <div>
              <h2>Thinking of selling?</h2>
              <p>An automated estimate is a starting point. Ask us for a free appraisal based on a proper look at your home.</p>
            </div>
            <div className="contact">
              <b>{brand.phone}</b>
              <div>{brand.email}</div>
            </div>
          </section>

          <footer className="rp-foot">
            <p>{brand.reportDisclaimer}</p>
            {report.attribution.map((a) => (
              <p key={a}>{a}</p>
            ))}
            <p>Generated {dateNZ(report.generatedAt)} &middot; Prepared by {brand.name}</p>
          </footer>
        </div>
      </article>
    </div>
  );
}
