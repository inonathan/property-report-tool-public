import { promises as fs } from "node:fs";
import path from "node:path";
import type { AddressMatch, PropertyReport } from "./providers/types";
import { hashToken, newId } from "./tokens";

// Everything is stored in one JSON file. These functions are the whole storage API,
// so moving to Postgres means rewriting this file and nothing else.

export type ReportStatus = "queued" | "generated" | "sent" | "viewed" | "failed";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  source: string | null;
  createdAt: string;
  airtableId?: string;
};

export type ReportRecord = {
  id: string;
  tokenHash: string;
  leadId: string;
  addressId: string;
  addressFull: string;
  // address as confirmed by the provider when the form was submitted
  address?: AddressMatch;
  status: ReportStatus;
  provider: string;
  // brand the report was created under; web, PDF and email all follow it
  brandId?: string;
  report: PropertyReport | null;
  createdAt: string;
  expiresAt: string;
  generatedAt?: string;
  sentAt?: string;
  firstViewedAt?: string;
  lastViewedAt?: string;
  views: number;
  error?: string;
  airtableReportId?: string;
  airtablePropertyId?: string;
};

export type ActivityEvent = { ts: string; reportId: string; event: string; detail?: string };

type Db = { leads: Lead[]; reports: ReportRecord[]; activity: ActivityEvent[] };

export const dataDir = () => path.resolve(process.env.DATA_DIR || "./data");
const dbFile = () => path.join(dataDir(), "db.json");

let chain: Promise<unknown> = Promise.resolve();
// one read-modify-write at a time, so parallel requests can't overwrite each other
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(dbFile(), "utf8")) as Db;
  } catch {
    return { leads: [], reports: [], activity: [] };
  }
}

async function save(db: Db): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${dbFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, dbFile());
}

export async function createLeadAndReport(input: {
  name: string;
  email: string;
  phone: string;
  marketingConsent: boolean;
  source?: string | null;
  addressId: string;
  addressFull: string;
  address?: AddressMatch;
  provider: string;
  brandId?: string;
  token: string;
  ttlDays: number;
}): Promise<{ lead: Lead; report: ReportRecord }> {
  return withLock(async () => {
    const db = await load();
    const now = new Date();
    let lead = db.leads.find((l) => l.email === input.email);
    if (lead) {
      lead.name = input.name;
      lead.phone = input.phone;
      // keep an earlier opt-in, but never create one without an explicit yes
      lead.marketingConsent = input.marketingConsent || lead.marketingConsent;
    } else {
      lead = {
        id: newId(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        marketingConsent: input.marketingConsent,
        source: input.source ?? null,
        createdAt: now.toISOString(),
      };
      db.leads.push(lead);
    }
    const report: ReportRecord = {
      id: newId(),
      tokenHash: hashToken(input.token),
      leadId: lead.id,
      addressId: input.addressId,
      addressFull: input.addressFull,
      address: input.address,
      status: "queued",
      provider: input.provider,
      brandId: input.brandId,
      report: null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.ttlDays * 86_400_000).toISOString(),
      views: 0,
    };
    db.reports.push(report);
    await save(db);
    return { lead, report };
  });
}

export async function getReportByToken(token: string): Promise<{ report: ReportRecord; lead: Lead } | null> {
  const db = await load();
  const h = hashToken(token);
  const report = db.reports.find((r) => r.tokenHash === h);
  if (!report) return null;
  const lead = db.leads.find((l) => l.id === report.leadId);
  return lead ? { report, lead } : null;
}

export async function getReportById(id: string): Promise<{ report: ReportRecord; lead: Lead } | null> {
  const db = await load();
  const report = db.reports.find((r) => r.id === id);
  if (!report) return null;
  const lead = db.leads.find((l) => l.id === report.leadId);
  return lead ? { report, lead } : null;
}

export async function updateReport(id: string, patch: Partial<ReportRecord>): Promise<ReportRecord | null> {
  return withLock(async () => {
    const db = await load();
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    await save(db);
    return r;
  });
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<void> {
  return withLock(async () => {
    const db = await load();
    const l = db.leads.find((x) => x.id === id);
    if (!l) return;
    Object.assign(l, patch);
    await save(db);
  });
}

// keeps "viewed" if the link was opened before the send finished
export async function markSent(id: string): Promise<ReportRecord | null> {
  return withLock(async () => {
    const db = await load();
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    r.sentAt = new Date().toISOString();
    if (r.status !== "viewed") r.status = "sent";
    await save(db);
    return r;
  });
}


export async function recordView(id: string): Promise<ReportRecord | null> {
  return withLock(async () => {
    const db = await load();
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    const now = new Date().toISOString();
    r.views += 1;
    r.firstViewedAt ??= now;
    r.lastViewedAt = now;
    if (r.status === "generated" || r.status === "sent") r.status = "viewed";
    await save(db);
    return r;
  });
}

export async function logActivity(reportId: string, event: string, detail?: string): Promise<void> {
  return withLock(async () => {
    const db = await load();
    db.activity.push({ ts: new Date().toISOString(), reportId, event, detail });
    if (db.activity.length > 5000) db.activity.splice(0, db.activity.length - 5000);
    await save(db);
  });
}

// erasure on request: removes the lead along with their reports and activity
export async function deleteLeadByEmail(email: string): Promise<number> {
  return withLock(async () => {
    const db = await load();
    const lead = db.leads.find((l) => l.email === email.toLowerCase());
    if (!lead) return 0;
    const ids = new Set(db.reports.filter((r) => r.leadId === lead.id).map((r) => r.id));
    db.reports = db.reports.filter((r) => r.leadId !== lead.id);
    db.activity = db.activity.filter((a) => !ids.has(a.reportId));
    db.leads = db.leads.filter((l) => l.id !== lead.id);
    await save(db);
    return ids.size;
  });
}
