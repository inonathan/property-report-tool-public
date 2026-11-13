# Property Report Tool

A white-label property estimate and report tool for real estate agencies, built around New Zealand data sources.

Visitor enters an address + contact details → report is generated from an **approved, licensed data provider** →
viewed securely on the website, emailed (secure link + PDF) → the sales team is notified in Airtable.

> **Status.** The included provider returns fictional data and watermarks every report "DEMO DATA".
> No licensed or scraped property data is used. The Cotality and Valocity adapters are stubs that need
> the agency's own licence and credentials.

## Quick start

```bash
npm install
cp .env.example .env.local        # defaults work: mock data, Airtable and email in dry-run
npm run dev                       # http://localhost:3000
```

Dry-run means you can demo the entire flow with **no credentials**:

| Output | Where it lands |
|---|---|
| Emails | `data/outbox/<id>.html` (+ `.json`) |
| Airtable calls | `data/airtable-outbox.jsonl` |
| PDFs | `data/pdf/<id>.pdf` |
| Leads, reports, activity | `data/db.json` |

PDF generation needs Chrome locally: set `CHROME_PATH` (see `.env.example`).

Browser end-to-end test (drives the real UI, the iframe embed and the mobile layout):

```bash
npm run build && npm start &
BASE=http://127.0.0.1:3000 CHROME_PATH=/usr/bin/google-chrome SHOTS=./shots node scripts/e2e.mjs
```

## How it fits together

```
Website (any CMS)           This app                              Outputs
─────────────────           ────────                              ───────
<script embed.js>  ──►  /embed (form, in an iframe)
                              │ POST /api/estimate
                              ▼
                        validate · rate-limit · honeypot · (Turnstile)
                        re-resolve address with the provider (never trust the browser)
                        create lead + report, return secret token ──►  visitor sees "preparing…"
                              │ after(): runs after the response
                              ▼
                        1 Airtable: Lead / Property / Report rows  ──►  team notification
                        2 provider.getReport()  (mock | cotality | valocity)
                        3 PDF: headless Chrome renders /report/<token>?print=1
                        4 Email (Postmark) with secure link + PDF
                        5 Airtable updated at every step + Activity Log
                              ▼
                        /report/<token>  ◄── same template for web and PDF
```

Key files:

| File | Purpose |
|---|---|
| `brands/*.json` + `lib/brand.ts` | Branding per agency: name, logo, colours, contacts, disclaimer, provider |
| `app/globals.css` | All styling, driven by the brand colours |
| `lib/providers/types.ts` | The one data contract (`PropertyReport`). Providers map into it |
| `lib/providers/mock.ts` | Demo data (fictional, deterministic, watermarked) |
| `lib/providers/cotality.ts`, `valocity.ts` | Stubs, not implemented yet |
| `components/ReportView.tsx` | The report template (web + PDF). Hides sections with no data |
| `lib/pipeline.ts` | Background job: CRM → provider → PDF → email → CRM |
| `lib/store.ts` | Storage (a JSON file; replace with Postgres for real use) |
| `lib/airtable.ts`, `scripts/airtable-setup.mjs` | CRM sync and table creation |
| `public/embed.js` | One-line embed for the agency's site |

## Embedding on the agency's site

Paste where the form should appear (WordPress "Custom HTML" block, Webflow embed, Squarespace code block, ...):

```html
<script src="https://YOUR-APP-DOMAIN/embed.js" async></script>
```

It runs in an iframe, so it can't clash with the host site, and it resizes itself. Restrict where it can be embedded with
`ALLOWED_EMBED_ORIGINS=https://www.agency.example`.

## White-label: onboarding another agency

Branding lives in one JSON file per agency (`brands/*.json`: name, logo, colours, font, contacts, disclaimer).
1. Copy `brands/default.json` to `brands/<agency-id>.json` and fill it in (logo file goes in `/public`, set `logoUrl`).
2. Register it in `lib/brand.ts` (`BRANDS`). Set `"provider"` in the file to choose that agency's data source (`mock`, `cotality`, `valocity`); empty uses the `PROVIDER` env var. Provider credentials stay in env vars.
3. Deploy with `BRAND_ID=<agency-id>` (and `APPRAISAL_URL=<agency contact page>`).

A report keeps the brand it was created with, so the web page, PDF and email always match. `BRAND_SWITCH=1` (demo hosting only)
shows a "Preview as" bar on the landing page so a prospect can see the same tool in several agencies' colours;
leave it unset otherwise. The two example brands (Harbour & Co, Kauri Lane) are made up.

## Airtable (all names in English)

```bash
AIRTABLE_TOKEN=pat... AIRTABLE_BASE_ID=app... npm run airtable:setup   # creates the 4 tables in an empty base
```

Tables: **Leads** · **Properties** · **Reports** · **Activity Log**. Then add an Airtable Automation:
*When a record is created in Reports → send email/Slack to the sales team* (Lead, Property, Status, Report Link).
The key sales signal is **Reports → View Count / First Viewed At**: a homeowner opening their report several times is a warm seller.

## Security and privacy (NZ Privacy Act 2020)

- Report URLs carry a 256-bit random token; only its SHA-256 hash is stored. Links expire (`REPORT_TTL_DAYS`, default 90).
- Report pages send `Referrer-Policy: no-referrer`, `noindex`, `no-store`; unknown tokens return a real 404.
- The form is the only framable page; everything else sends `X-Frame-Options: DENY`.
- Address is re-resolved server-side; honeypot, per-IP and per-email rate limits, optional Cloudflare Turnstile.
- Explicit privacy consent is required; marketing consent is separate and never pre-ticked.
- No property **owner** names are used anywhere (LINZ owner datasets need a separate personal-data licence).
- `deleteLeadByEmail()` in `lib/store.ts` implements deletion on request.

## Known limitations

1. **Storage**: the JSON file store needs a persistent disk. Serverless hosts have an ephemeral filesystem, so move
   `lib/store.ts` to Postgres and the PDFs to object storage before deploying there.
2. **Rate limiting** is in-memory and per instance. Use Redis or KV when running several instances.
3. **Airtable, Postmark and Turnstile** have only been run in dry-run mode. Test them with real accounts.
4. **Email scanners** sometimes open links automatically. Obvious bots are ignored for view counts, but treat "View Count" as a signal, not a fact.
5. **Fonts**: the report uses system fonts. Add the agency's font with `@font-face` in `app/globals.css`.
6. **Compliance**: have the agency's adviser approve the disclaimer in the brand file, including the wording around
   "appraisal" and the data provider's licence terms.

## Turning on real data

1. Get sandbox credentials (Cotality or Valocity) in the agency's name and confirm which fields the licence covers and whether showing them to homeowners is allowed.
2. Implement the adapter in `lib/providers/<provider>.ts` against the licensed API docs, returning `null` for excluded fields.
3. Put required credit lines in `PropertyReport.attribution`.
4. Cache results per property id, since AVM calls are billed per request.
5. Set `PROVIDER=cotality` (or the `provider` field in the brand file), try it against the provider's test environment, then production.

See `DEPLOY.md` for hosting with Docker.
