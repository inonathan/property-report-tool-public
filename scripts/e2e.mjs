// Drives the real UI in headless Chrome: autocomplete, the form, the report, the iframe embed and the mobile layout.
//   BASE=http://127.0.0.1:3000 CHROME_PATH=/usr/bin/google-chrome SHOTS=./shots node scripts/e2e.mjs
// Exits non-zero if any check fails.
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const SHOTS = process.env.SHOTS || "./shots";
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    // lets the fake host page load embed.js from another local origin
    "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests",
  ],
});

let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failed++;
};
const unique = Date.now().toString(36);

try {
  // ---------- 1. Landing page + form ----------
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle0" });
  ok((await page.title()).includes("property estimate"), "landing page loads");
  await page.screenshot({ path: `${SHOTS}/01-landing.png` });

  await page.click("#ef-address");
  await page.keyboard.type("goulds", { delay: 30 });
  await page.waitForSelector('[role="listbox"] [role="option"]');
  const optionCount = await page.$$eval('[role="option"]', (els) => els.length);
  ok(optionCount >= 2, `autocomplete shows suggestions (${optionCount})`);
  await page.screenshot({ path: `${SHOTS}/02-autocomplete.png` });

  // keyboard selection: ArrowDown x2 + Enter
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const picked = await page.$eval("#ef-address", (el) => el.value);
  ok(/Goulds Road/.test(picked), `keyboard selection fills address: "${picked}"`);

  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Instant Property Estimate/.test(b.textContent)).click());
  await page.waitForSelector("#ef-name");
  ok(true, "step 2 (contact details) appears");

  // Submitting without consent must be refused with a visible message.
  await page.type("#ef-name", "E2E Visitor");
  await page.type("#ef-email", `e2e+${unique}@example.com`);
  await page.type("#ef-phone", "021 555 0199");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Get my free report/.test(b.textContent)).click());
  await page.waitForSelector(".ef-error");
  ok(/privacy/i.test(await page.$eval(".ef-error", (e) => e.textContent)), "blocked without privacy consent, with a clear message");
  await page.screenshot({ path: `${SHOTS}/03-details-error.png` });

  await page.click('.ef-check input[type="checkbox"]'); // first checkbox = privacy
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }),
    page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Get my free report/.test(b.textContent)).click()),
  ]);
  ok(/\/report\/[\w-]{43}$/.test(page.url()), "redirected to private report URL");
  const text = await page.$eval("body", (b) => b.innerText);
  ok(/Estimated value/i.test(text) && /Recent sales nearby/i.test(text), "report shows estimate + comparable sales");
  ok(/DEMO DATA/.test(text), "demo watermark present");
  await page.screenshot({ path: `${SHOTS}/04-report-desktop.png`, fullPage: true });
  const reportUrl = page.url();
  ok(consoleErrors.length === 0, `no uncaught page errors ${consoleErrors.join("|")}`);

  // ---------- 2. Mobile layout ----------
  const m = await browser.newPage();
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await m.goto(reportUrl, { waitUntil: "networkidle0" });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 1, `no horizontal overflow on mobile (${overflow}px)`);
  await m.screenshot({ path: `${SHOTS}/05-report-mobile.png`, fullPage: true });

  // ---------- 3. Embed on a foreign host page ----------
  // The host page is served from a DIFFERENT ORIGIN than the app, like a real agency website.
  // Notes on the test setup (artefacts of testing locally, not product issues):
  //  - an about:blank host would not match "frame-ancestors *";
  //  - a public http host loading a script from 127.0.0.1 is blocked by Chrome's Private Network Access rules.
  // So the fake host lives on localhost:3999 (different origin from 127.0.0.1:3000, same address class).
  // In production both the agency site and the app are https, where none of this applies.
  const HOST = "http://localhost:3999";
  const host = await browser.newPage();
  await host.setViewport({ width: 1100, height: 800 });
  await host.setRequestInterception(true);
  host.on("request", (req) => {
    if (req.url().startsWith(`${HOST}/`)) {
      req.respond({
        status: 200,
        contentType: "text/html",
        body: `<!doctype html><html><body style="font-family:Georgia,serif;margin:0;padding:40px;background:#fffdf7">
     <h1>Sell my home (agency's existing site)</h1><p>Some existing page content above the tool.</p>
     <script src="${BASE}/embed.js"></script><p>More page content below the tool.</p></body></html>`,
      });
    } else req.continue();
  });
  await host.goto(`${HOST}/sell-my-home`, { waitUntil: "networkidle0" });
  await host.waitForSelector("iframe");
  // The iframe element exists immediately; wait until it has actually navigated to the app's /embed page.
  const frame = await host.waitForFrame((f) => f.url().startsWith(`${BASE}/embed`), { timeout: 15000 });
  ok(Boolean(frame), "embed iframe loads from the app domain");
  await frame.waitForSelector("#ef-address");
  await frame.click("#ef-address");
  await frame.type("#ef-address", "masefield", { delay: 25 });
  await frame.waitForSelector('[role="option"]');
  await new Promise((r) => setTimeout(r, 400));
  const h1 = await host.$eval("iframe", (f) => f.getBoundingClientRect().height);
  await frame.click('[role="option"]');
  await frame.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Instant Property Estimate/.test(b.textContent)).click());
  await frame.waitForSelector("#ef-name");
  await new Promise((r) => setTimeout(r, 500));
  const h2 = await host.$eval("iframe", (f) => f.getBoundingClientRect().height);
  ok(h2 > h1 + 100, `iframe auto-resizes when the form grows (${Math.round(h1)} -> ${Math.round(h2)}px)`);
  await host.screenshot({ path: `${SHOTS}/06-embed-on-host-page.png` });
} catch (e) {
  console.error("E2E ERROR:", e);
  failed++;
} finally {
  await browser.close();
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
