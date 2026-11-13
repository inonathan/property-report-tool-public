import { reportLink, safe, syncActivity, syncNewReport, syncReportUpdate } from "./airtable";
import { getBrand } from "./brand";
import { sendReportEmail } from "./email";
import { renderReportPdf } from "./pdf";
import { getProvider } from "./providers";
import { getReportById, logActivity, markSent, updateLead, updateReport, type Lead, type ReportRecord } from "./store";

// Runs after the form response has gone out. Each step logs an event and a failure
// in one step doesn't stop the ones that can still work.

async function event(report: ReportRecord, name: string, detail?: string) {
  await logActivity(report.id, name, detail);
  await safe("activity", () => syncActivity(report, name, detail));
}

export async function processReport(reportId: string, rawToken: string): Promise<void> {
  const found = await getReportById(reportId);
  if (!found) return;
  let { report } = found;
  const { lead } = found;

  // CRM first, so the lead is saved even if the data provider fails
  await safe("sync-new", async () => {
    const a = report.address;
    const ids = await syncNewReport(lead, report, rawToken, {
      full: report.addressFull,
      suburb: a?.suburb,
      city: a?.city,
      postcode: a?.postcode,
      lat: a?.lat,
      lng: a?.lng,
    });
    if (ids.leadId) await updateLead(lead.id, { airtableId: ids.leadId });
    if (ids.reportId || ids.propertyId) {
      report = (await updateReport(report.id, { airtableReportId: ids.reportId, airtablePropertyId: ids.propertyId })) ?? report;
    }
  });
  await event(report, "report_requested", report.addressFull);

  try {
    const provider = getProvider(report.provider);
    const data = await provider.getReport(report.addressId);
    report =
      (await updateReport(report.id, {
        report: data,
        status: "generated",
        generatedAt: new Date().toISOString(),
        addressFull: data.address.full,
      })) ?? report;
    await safe("sync-generated", () => syncReportUpdate(report));
    await event(report, "provider_ok", `provider=${data.provider}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report = (await updateReport(report.id, { status: "failed", error: msg.slice(0, 500) })) ?? report;
    await safe("sync-failed", () => syncReportUpdate(report));
    await event(report, "provider_fail", msg);
    return;
  }

  // the email still goes out with the link if the PDF fails
  let pdf: Buffer | null = null;
  try {
    pdf = await renderReportPdf(report.id, rawToken);
    await event(report, "pdf_ok", `${pdf.length} bytes`);
  } catch (e) {
    await event(report, "pdf_fail", e instanceof Error ? e.message : String(e));
  }

  try {
    const res = await sendReportEmail({
      reportId: report.id,
      to: lead.email,
      name: lead.name,
      address: report.addressFull,
      reportUrl: reportLink(rawToken),
      pdf,
      isDemo: report.report?.isDemo ?? false,
      brand: getBrand(report.brandId),
    });
    report = (await markSent(report.id)) ?? report;
    await safe("sync-sent", () => syncReportUpdate(report));
    await event(report, "email_sent", res.dryRun ? "dry-run (written to data/outbox)" : "postmark");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // the report is fine and viewable, only the email failed
    report = (await updateReport(report.id, { error: `email: ${msg}`.slice(0, 500) })) ?? report;
    await safe("sync-email-fail", () => syncReportUpdate(report));
    await event(report, "email_fail", msg);
  }
}

export type { Lead };
