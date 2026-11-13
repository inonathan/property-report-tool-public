import { NextResponse } from "next/server";
import { renderReportPdf } from "@/lib/pdf";
import { getReportByToken } from "@/lib/store";
import { looksLikeToken } from "@/lib/tokens";

export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!looksLikeToken(token)) return new NextResponse("Not found", { status: 404 });
  const found = await getReportByToken(token);
  if (!found || new Date(found.report.expiresAt) < new Date() || !found.report.report) {
    return new NextResponse("This report link is invalid or has expired.", { status: 404 });
  }
  try {
    const pdf = await renderReportPdf(found.report.id, token);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Property-Report.pdf"`,
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("[pdf]", e instanceof Error ? e.message : e);
    return new NextResponse("We couldn't generate the PDF right now. Please try again shortly.", { status: 503 });
  }
}
