import { promises as fs } from "node:fs";
import path from "node:path";
import { dataDir } from "./store";

// The PDF is the report page itself (/report/<token>?print=1) printed by headless Chrome.
// Locally CHROME_PATH points at a browser, on serverless hosts @sparticuz/chromium is used.

export const internalBase = () =>
  (process.env.INTERNAL_URL || process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, "");

const pdfPath = (reportId: string) => path.join(dataDir(), "pdf", `${reportId}.pdf`);

export async function readCachedPdf(reportId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(pdfPath(reportId));
  } catch {
    return null;
  }
}

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true,
  });
}

export async function renderReportPdf(reportId: string, token: string): Promise<Buffer> {
  const cached = await readCachedPdf(reportId);
  if (cached) return cached;

  const browser = await launch();
  try {
    const page = await browser.newPage();
    // the demo gate would otherwise block the renderer
    if (process.env.DEMO_PASSWORD) {
      const basic = Buffer.from(`${process.env.DEMO_USER || "demo"}:${process.env.DEMO_PASSWORD}`).toString("base64");
      await page.setExtraHTTPHeaders({ authorization: `Basic ${basic}` });
    }
    await page.emulateMediaType("print");
    const res = await page.goto(`${internalBase()}/report/${token}?print=1`, { waitUntil: "networkidle0", timeout: 45_000 });
    if (!res || !res.ok()) throw new Error(`Report page returned ${res?.status() ?? "no response"}`);
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    const buf = Buffer.from(bytes);
    await fs.mkdir(path.dirname(pdfPath(reportId)), { recursive: true });
    await fs.writeFile(pdfPath(reportId), buf);
    return buf;
  } finally {
    await browser.close();
  }
}
