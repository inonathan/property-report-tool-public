import { promises as fs } from "node:fs";
import path from "node:path";
import { dataDir, type Lead, type ReportRecord } from "./store";

// CRM sync for the sales team (Leads, Properties, Reports, Activity Log). The database stays the source of truth.
// Without AIRTABLE_TOKEN and AIRTABLE_BASE_ID, calls are appended to data/airtable-outbox.jsonl instead.

const API = "https://api.airtable.com/v0";
const token = () => process.env.AIRTABLE_TOKEN;
const baseId = () => process.env.AIRTABLE_BASE_ID;
export const airtableLive = () => Boolean(token() && baseId());

type AtRecord = { id: string; fields: Record<string, unknown> };

async function outbox(op: string, table: string, payload: unknown) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.appendFile(
    path.join(dataDir(), "airtable-outbox.jsonl"),
    JSON.stringify({ ts: new Date().toISOString(), op, table, payload }) + "\n",
  );
}

async function call<T>(method: string, pathname: string, body?: unknown, attempt = 0): Promise<T> {
  const res = await fetch(`${API}/${baseId()}/${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    return call<T>(method, pathname, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`Airtable ${method} ${pathname} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const enc = encodeURIComponent;

async function findOne(table: string, field: string, value: string): Promise<AtRecord | null> {
  const formula = `{${field}}="${q(value)}"`;
  const res = await call<{ records: AtRecord[] }>("GET", `${enc(table)}?maxRecords=1&filterByFormula=${enc(formula)}`);
  return res.records[0] ?? null;
}

async function upsertBy(table: string, field: string, value: string, fields: Record<string, unknown>): Promise<string> {
  const existing = await findOne(table, field, value);
  if (existing) {
    await call("PATCH", `${enc(table)}/${existing.id}`, { fields, typecast: true });
    return existing.id;
  }
  const created = await call<AtRecord>("POST", enc(table), { fields: { [field]: value, ...fields }, typecast: true });
  return created.id;
}

export function reportLink(token: string): string {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/report/${token}`;
}
export function pdfLink(token: string): string {
  return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/pdf/${token}`;
}

const STATUS_LABEL: Record<ReportRecord["status"], string> = {
  queued: "Queued",
  generated: "Generated",
  sent: "Sent",
  viewed: "Viewed",
  failed: "Failed",
};


export async function syncNewReport(
  lead: Lead,
  report: ReportRecord,
  rawToken: string,
  property: { full: string; suburb?: string; city?: string; postcode?: string; lat?: number | null; lng?: number | null },
): Promise<{ leadId?: string; propertyId?: string; reportId?: string }> {
  const leadFields = {
    Name: lead.name,
    Phone: lead.phone,
    Source: lead.source ?? "",
    "Marketing Consent": lead.marketingConsent,
    Created: lead.createdAt,
  };
  const propFields = {
    Suburb: property.suburb ?? "",
    City: property.city ?? "",
    Postcode: property.postcode ?? "",
    "Provider Property ID": report.addressId,
    Latitude: property.lat ?? null,
    Longitude: property.lng ?? null,
  };

  if (!airtableLive()) {
    await outbox("upsert", "Leads", { Email: lead.email, ...leadFields, Status: "New" });
    await outbox("upsert", "Properties", { "Full Address": property.full, ...propFields });
    await outbox("create", "Reports", {
      "Report ID": report.id,
      Status: STATUS_LABEL[report.status],
      "Report Link": reportLink(rawToken),
      "PDF Link": pdfLink(rawToken),
    });
    return {};
  }

  const leadId = await upsertBy("Leads", "Email", lead.email, leadFields);
  // only set on first creation so a status staff changed later isn't overwritten
  if (!lead.airtableId) await call("PATCH", `Leads/${leadId}`, { fields: { Status: "New" }, typecast: true });
  const propertyId = await upsertBy("Properties", "Full Address", property.full, propFields);
  const created = await call<AtRecord>("POST", "Reports", {
    typecast: true,
    fields: {
      "Report ID": report.id,
      Lead: [leadId],
      Property: [propertyId],
      Status: STATUS_LABEL[report.status],
      "Report Link": reportLink(rawToken),
      "PDF Link": pdfLink(rawToken),
      Provider: report.provider,
    },
  });
  return { leadId, propertyId, reportId: created.id };
}

export async function syncReportUpdate(report: ReportRecord, extra: Record<string, unknown> = {}): Promise<void> {
  const fields: Record<string, unknown> = {
    Status: STATUS_LABEL[report.status],
    "Generated At": report.generatedAt,
    "Sent At": report.sentAt,
    "First Viewed At": report.firstViewedAt,
    "Last Viewed At": report.lastViewedAt,
    "View Count": report.views,
    Error: report.error ?? "",
    ...(report.report?.valuation
      ? {
          "Estimate Low": report.report.valuation.low,
          Estimate: report.report.valuation.estimate,
          "Estimate High": report.report.valuation.high,
        }
      : {}),
    ...extra,
  };
  for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];

  if (!airtableLive()) return void (await outbox("update", "Reports", { "Report ID": report.id, ...fields }));
  if (!report.airtableReportId) return;
  await call("PATCH", `Reports/${report.airtableReportId}`, { fields, typecast: true });
}

export async function syncActivity(report: ReportRecord, event: string, detail?: string): Promise<void> {
  const fields = {
    Summary: `${event} · ${report.addressFull}`.slice(0, 200),
    Event: event,
    Detail: detail ?? "",
    Timestamp: new Date().toISOString(),
  };
  if (!airtableLive()) return void (await outbox("create", "Activity Log", { "Report ID": report.id, ...fields }));
  if (!report.airtableReportId) return;
  await call("POST", enc("Activity Log"), { fields: { ...fields, Report: [report.airtableReportId] }, typecast: true });
}

// a CRM error should never break what the visitor sees
export async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[airtable:${label}]`, e instanceof Error ? e.message : e);
  }
}
