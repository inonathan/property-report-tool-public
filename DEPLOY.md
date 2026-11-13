# Deploying with Docker

The repo ships a `Dockerfile` (Node 20 plus Chromium for the PDFs), so any container host works: Railway, Render, Fly.io, a VPS.

## Steps
1. Create a service from this repository; the host should pick up the `Dockerfile`.
2. Mount a persistent volume at `/data`. Leads, reports and PDFs live there.
3. Set the health check path to `/api/health`.
4. Set the variables below.

| Variable | Value |
|---|---|
| `APP_URL` | public URL of the service, no trailing slash |
| `PROVIDER` | `mock` until you have a licensed provider |
| `DEMO_PASSWORD` | a long random password (turns the sign-in gate on) |
| `DEMO_SESSION_SECRET` | another long random string |
| `DEMO_EXPIRES_AT` | date after which the site answers 410, e.g. `2026-12-01` |
| `REPORT_TTL_DAYS` | days a report link stays valid |
| `BRAND_SWITCH` | `1` to show the "Preview as" bar, empty otherwise |

`CHROME_PATH`, `DATA_DIR` and `INTERNAL_URL` are set by the Dockerfile. Leave `AIRTABLE_*` and `POSTMARK_*` empty to run in dry-run mode, where nothing leaves the server.

## Check it
- the sign-in page shows up when you open the URL
- an address, a form and a report page work end to end, and the PDF downloads
- `/api/health` answers `{"ok":true}` without a password
