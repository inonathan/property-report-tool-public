// Creates the four CRM tables in an empty Airtable base. Tables that already exist are skipped.
//   AIRTABLE_TOKEN=pat... AIRTABLE_BASE_ID=app... npm run airtable:setup
// The token needs the schema.bases and data.records scopes. Field names must match lib/airtable.ts.
const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!token || !baseId) {
  console.error("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID first.");
  process.exit(1);
}

const META = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const dt = { type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "Pacific/Auckland" } };
const text = (name) => ({ name, type: "singleLineText" });
const long = (name) => ({ name, type: "multilineText" });
const date = (name) => ({ name, ...dt });
const int = (name) => ({ name, type: "number", options: { precision: 0 } });
const coord = (name) => ({ name, type: "number", options: { precision: 6 } });
const select = (name, choices) => ({ name, type: "singleSelect", options: { choices: choices.map((c) => ({ name: c })) } });

async function existingTables() {
  const res = await fetch(META, { headers });
  if (!res.ok) throw new Error(`List tables failed: ${res.status} ${await res.text()}`);
  return (await res.json()).tables;
}

async function createTable(def) {
  const res = await fetch(META, { method: "POST", headers, body: JSON.stringify(def) });
  const body = await res.json();
  if (!res.ok) throw new Error(`Create "${def.name}" failed: ${res.status} ${JSON.stringify(body)}`);
  console.log(`✔ created ${def.name}`);
  return body;
}

const tables = await existingTables();
const byName = (n) => tables.find((t) => t.name === n);

let leads = byName("Leads");
if (!leads) {
  leads = await createTable({
    name: "Leads",
    description: "People who requested a property report",
    fields: [
      text("Email"), // primary field; the app looks leads up by this
      text("Name"),
      { name: "Phone", type: "phoneNumber" },
      text("Source"),
      { name: "Marketing Consent", type: "checkbox", options: { icon: "check", color: "greenBright" } },
      select("Status", ["New", "Contacted", "Appraisal Booked", "Listed", "Lost"]),
      text("Assigned Agent"),
      date("Created"),
    ],
  });
}

let properties = byName("Properties");
if (!properties) {
  properties = await createTable({
    name: "Properties",
    fields: [text("Full Address"), text("Suburb"), text("City"), text("Postcode"), text("Provider Property ID"), coord("Latitude"), coord("Longitude")],
  });
}

let reports = byName("Reports");
if (!reports) {
  reports = await createTable({
    name: "Reports",
    description: "One row per generated report. Build your 'new lead' notification automation on THIS table.",
    fields: [
      text("Report ID"),
      { name: "Lead", type: "multipleRecordLinks", options: { linkedTableId: leads.id } },
      { name: "Property", type: "multipleRecordLinks", options: { linkedTableId: properties.id } },
      select("Status", ["Queued", "Generated", "Sent", "Viewed", "Failed"]),
      { name: "Report Link", type: "url" },
      { name: "PDF Link", type: "url" },
      int("Estimate Low"),
      int("Estimate"),
      int("Estimate High"),
      text("Provider"),
      date("Generated At"),
      date("Sent At"),
      date("First Viewed At"),
      date("Last Viewed At"),
      int("View Count"),
      long("Error"),
    ],
  });
}

if (!byName("Activity Log")) {
  await createTable({
    name: "Activity Log",
    fields: [
      text("Summary"),
      { name: "Report", type: "multipleRecordLinks", options: { linkedTableId: reports.id } },
      text("Event"),
      long("Detail"),
      date("Timestamp"),
    ],
  });
}

console.log("\nDone. Next, in Airtable: add an Automation → trigger 'When a record is created' on Reports →");
console.log("action 'Send email' / 'Send Slack message' to the sales team with Lead, Property, Status and Report Link.");
console.log("Optional manual extras: a 'Report Count' rollup on Leads, a 'Hot leads' view on Reports filtered by View Count >= 2.");
