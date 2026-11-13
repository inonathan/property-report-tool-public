import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { safe, syncActivity, syncReportUpdate } from "@/lib/airtable";
import { ReportView } from "@/components/ReportView";
import { logActivity, recordView, getReportByToken } from "@/lib/store";
import { looksLikeToken } from "@/lib/tokens";
import { getBrand } from "@/lib/brand";
import { requestBrand } from "@/lib/brand-request";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your property report",
  robots: { index: false, follow: false, nocache: true },
};

async function Message({ title, body }: { title: string; body: string }) {
  const brand = await requestBrand();
  return (
    <div className="panel-page">
      <div className="panel">
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="actions">
          <a className="pill" href={brand.appraisalUrl}>Contact {brand.name}</a>
        </div>
      </div>
    </div>
  );
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { token } = await params;
  const { print } = await searchParams;
  const isPrint = print === "1";

  // a bad token gets a real 404, not a friendly 200 page
  if (!looksLikeToken(token)) notFound();
  const found = await getReportByToken(token);
  if (!found) notFound();

  const { report: rec } = found;
  if (new Date(rec.expiresAt) < new Date())
    return <Message title="This report link has expired" body="For security, report links expire after a while. We'd be happy to prepare a fresh one for you." />;
  if (rec.status === "queued" || !rec.report)
    return <Message title="Your report is still being prepared" body="Please refresh in a moment, or check your email for the link." />;

  // skip the PDF renderer and link-preview bots so they don't count as views
  const ua = (await headers()).get("user-agent") ?? "";
  const isBot = /bot|crawler|spider|preview|HeadlessChrome|facebookexternalhit|Slackbot|WhatsApp/i.test(ua);
  if (!isPrint && !isBot) {
    after(async () => {
      const updated = await recordView(rec.id);
      if (!updated) return;
      await logActivity(updated.id, "link_viewed", `view #${updated.views}`);
      await safe("sync-view", async () => {
        await syncReportUpdate(updated);
        await syncActivity(updated, "link_viewed", `view #${updated.views}`);
      });
    });
  }

  return <ReportView report={rec.report} token={token} print={isPrint} brand={getBrand(rec.brandId)} />;
}
