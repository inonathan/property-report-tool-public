import { promises as fs } from "node:fs";
import path from "node:path";
import type { Brand } from "./brand";
import { dataDir } from "./store";
import { esc } from "./format";

// Sent through Postmark. Without POSTMARK_SERVER_TOKEN the message is written to data/outbox instead.

export type ReportEmail = {
  reportId: string;
  to: string;
  name: string;
  address: string;
  reportUrl: string;
  pdf?: Buffer | null;
  isDemo: boolean;
  brand: Brand;
};

export function renderEmailHtml(m: ReportEmail): string {
  const { brand } = m;
  const c = brand.colors;
  const first = esc(m.name.split(" ")[0] || "there");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:${c.ink}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff">
  <tr><td style="border-top:5px solid ${c.accent};padding:28px 32px 8px;font-size:26px;font-weight:700;letter-spacing:-0.5px">${esc(brand.logoText)}</td></tr>
  ${m.isDemo ? `<tr><td style="padding:0 32px"><div style="background:#fff4d6;border:1px solid #f0d78a;padding:8px 12px;font-size:12px;color:#7a5b00">DEMO &mdash; FICTIONAL DATA</div></td></tr>` : ""}
  <tr><td style="padding:20px 32px 0;font-size:15px;line-height:1.6">
    <p style="margin:0 0 14px">Hi ${first},</p>
    <p style="margin:0 0 14px">Your property report for <strong>${esc(m.address)}</strong> is ready. You can view it securely online using the button below${m.pdf ? ", and a PDF copy is attached" : ""}.</p>
  </td></tr>
  <tr><td style="padding:8px 32px 24px"><a href="${esc(m.reportUrl)}" style="display:inline-block;background:${c.ink};color:#fff;text-decoration:none;padding:14px 26px;font-size:15px">View my property report</a></td></tr>
  <tr><td style="padding:0 32px 24px;font-size:13px;line-height:1.6;color:${c.muted}">
    This is an automated estimate, not a valuation. If you'd like a formal, no-obligation appraisal from one of our agents, just reply to this email or call us on ${esc(brand.phone)}.
  </td></tr>
  <tr><td style="padding:16px 32px 28px;border-top:1px solid ${c.line};font-size:12px;color:${c.muted};line-height:1.6">
    ${esc(brand.name)} &middot; ${esc(brand.email)}<br>
    You received this because you requested a property report on our website. The link above is private to you; please don't forward it.
  </td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendReportEmail(m: ReportEmail): Promise<{ delivered: boolean; dryRun: boolean }> {
  const { brand } = m;
  const html = renderEmailHtml(m);
  const subject = `Your property report: ${m.address}`;
  const text =
    `Hi ${m.name.split(" ")[0] || "there"},\n\nYour property report for ${m.address} is ready:\n${m.reportUrl}\n\n` +
    `This is an automated estimate, not a valuation. For a formal appraisal call ${brand.phone}.\n\n${brand.name}`;
  const from = process.env.EMAIL_FROM || `${brand.name} <${brand.email}>`;
  const tokenValue = process.env.POSTMARK_SERVER_TOKEN;

  if (!tokenValue) {
    const dir = path.join(dataDir(), "outbox");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${m.reportId}.html`), html);
    await fs.writeFile(
      path.join(dir, `${m.reportId}.json`),
      JSON.stringify({ from, to: m.to, subject, text, attachedPdfBytes: m.pdf?.length ?? 0 }, null, 2),
    );
    return { delivered: true, dryRun: true };
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": tokenValue,
    },
    body: JSON.stringify({
      From: from,
      To: m.to,
      Bcc: process.env.EMAIL_BCC || undefined,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: "outbound",
      TrackOpens: false,
      TrackLinks: "None",
      Attachments: m.pdf
        ? [{ Name: "Property-Report.pdf", Content: m.pdf.toString("base64"), ContentType: "application/pdf" }]
        : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Postmark ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { delivered: true, dryRun: false };
}
