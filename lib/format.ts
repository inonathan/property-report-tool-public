const nzd0 = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});

export const money = (n: number | null | undefined) => (n == null ? "–" : nzd0.format(n));

// $1.2M / $850k, for chart axes
export function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  return `$${Math.round(n / 1000)}k`;
}

export function dateNZ(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(d);
}

export function monthShort(ym: string): string {
  const d = new Date(`${ym}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en-NZ", { month: "short", timeZone: "UTC" }).format(d);
}

export const num = (n: number | null | undefined, suffix = "") => (n == null ? "–" : `${n.toLocaleString("en-NZ")}${suffix}`);

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
