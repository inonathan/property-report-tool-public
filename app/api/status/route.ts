import { NextResponse } from "next/server";
import { getReportByToken } from "@/lib/store";
import { looksLikeToken } from "@/lib/tokens";

// polled by the form while the report is being built
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!looksLikeToken(token)) return NextResponse.json({ status: "unknown" }, { status: 404 });
  const found = await getReportByToken(token);
  if (!found) return NextResponse.json({ status: "unknown" }, { status: 404 });
  const s = found.report.status;
  const status = s === "failed" ? "failed" : s === "queued" ? "queued" : "ready";
  return NextResponse.json({ status });
}
