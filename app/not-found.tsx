import { requestBrand } from "@/lib/brand-request";

export default async function NotFound() {
  const brand = await requestBrand();
  return (
    <div className="panel-page">
      <div className="panel">
        <h1>Page not found</h1>
        <p>This link doesn&rsquo;t look right. If you were sent a report, use the link from your email.</p>
        <div className="actions">
          <a className="pill" href={brand.appraisalUrl}>Contact {brand.name}</a>
        </div>
      </div>
    </div>
  );
}
