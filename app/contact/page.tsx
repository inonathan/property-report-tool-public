import type { Metadata } from "next";
import { requestBrand } from "@/lib/brand-request";

export const metadata: Metadata = { title: "Contact", robots: { index: false, follow: false } };

// stand-in for the agency's own contact page; set APPRAISAL_URL to replace it
export default async function ContactDemo() {
  const brand = await requestBrand();
  return (
    <div className="panel-page">
      <div className="panel">
        <h1>Demo page</h1>
        <p>
          In a live setup this button opens {brand.name}&rsquo;s own contact or appraisal page, so a homeowner can ask for a formal appraisal.
        </p>
        <div className="actions">
          <a className="pill" href="/">Back to the estimate</a>
        </div>
      </div>
    </div>
  );
}
