import type {
  AddressMatch,
  Comparable,
  MarketPoint,
  PropertyDataProvider,
  PropertyReport,
} from "./types";

// Fake but plausible data, derived from the address text so the same address always gives the same report.
// Reports built from it are flagged isDemo and watermarked.

const STREETS = [
  "Masefield Drive",
  "Goulds Road",
  "Lowes Road",
  "Broadlands Drive",
  "Hamptons Road",
  "Rolleston Drive",
  "Kakaha Street",
  "Tyndall Close",
  "Aspen Lane",
  "Brookside Crescent",
  "Selwyn Avenue",
  "Waitaha Place",
];

const CATALOGUE: AddressMatch[] = STREETS.flatMap((street, si) =>
  [3, 8, 12, 17, 24, 31, 46].map((n, i) => {
    const number = n + ((si + i) % 3);
    return {
      id: `cat:${si}:${number}`,
      full: `${number} ${street}, Rolleston 7614`,
      street: `${number} ${street}`,
      suburb: "Rolleston",
      city: "Selwyn",
      postcode: "7614",
      lat: -43.5917 + si * 0.0021 + i * 0.0004,
      lng: 172.3829 + si * 0.0017 - i * 0.0003,
    } satisfies AddressMatch;
  }),
);

function b64e(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64d(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}

function customAddress(text: string): AddressMatch {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 120);
  const [street, ...rest] = clean.split(",");
  return {
    id: `custom:${b64e(clean)}`,
    full: clean,
    street: street.trim(),
    suburb: rest[0]?.trim() || "Rolleston",
    city: "Selwyn",
    postcode: "7614",
    lat: null,
    lng: null,
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

function isoMonthsAgo(months: number, day = 15, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, day));
  return d.toISOString().slice(0, 10);
}


function isoDaysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

export const mockProvider: PropertyDataProvider = {
  id: "mock",

  async searchAddresses(query, limit = 6) {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];
    const hits = CATALOGUE.filter((a) => a.full.toLowerCase().includes(q)).slice(0, limit);
    // any typed address should work in the demo, so offer the raw text as a last option
    if (hits.length < limit && q.length >= 6 && /\d/.test(q)) {
      hits.push(customAddress(query));
    }
    return hits;
  },

  async resolveAddress(id) {
    if (id.startsWith("custom:")) {
      try {
        return customAddress(b64d(id.slice(7)));
      } catch {
        return null;
      }
    }
    return CATALOGUE.find((a) => a.id === id) ?? null;
  },

  async getReport(addressId): Promise<PropertyReport> {
    const address = await this.resolveAddress(addressId);
    if (!address) throw new Error(`Unknown address id: ${addressId}`);

    const r = rng(hash(address.full.toLowerCase()));
    const bedrooms = pick(r, [3, 3, 4, 4, 4, 5]);
    const bathrooms = bedrooms >= 4 ? pick(r, [2, 2, 3]) : pick(r, [1, 2]);
    const carParks = pick(r, [1, 2, 2, 2]);
    const floorAreaM2 = roundTo(120 + bedrooms * 22 + r() * 40, 1);
    const landAreaM2 = roundTo(420 + r() * 380, 1);
    const yearBuilt = 2005 + Math.floor(r() * 20);

    const base = 560_000 + bedrooms * 70_000 + floorAreaM2 * 1_100 + (landAreaM2 - 500) * 350;
    const estimate = roundTo(base * (0.96 + r() * 0.08), 5_000);
    const spread = 0.06 + r() * 0.03;
    const low = roundTo(estimate * (1 - spread), 5_000);
    const high = roundTo(estimate * (1 + spread), 5_000);

    const comparables: Comparable[] = Array.from({ length: 5 }, (_, i) => {
      const street = pick(r, STREETS);
      const number = 2 + Math.floor(r() * 60);
      const bed = Math.max(3, bedrooms + pick(r, [-1, 0, 0, 1]));
      const floor = roundTo(floorAreaM2 * (0.88 + r() * 0.25), 1);
      const land = roundTo(landAreaM2 * (0.8 + r() * 0.4), 1);
      const price = roundTo(estimate * (0.9 + r() * 0.2), 1_000);
      return {
        address: `${number} ${street}, Rolleston`,
        // spread over about six months
        soldDate: isoDaysAgo(12 + i * 33 + Math.floor(r() * 20)),
        price,
        bedrooms: bed,
        bathrooms: Math.max(1, bathrooms + pick(r, [-1, 0, 0])),
        floorAreaM2: floor,
        landAreaM2: land,
        distanceKm: Math.round((0.2 + r() * 1.8) * 10) / 10,
      };
    }).sort((a, b) => (a.soldDate < b.soldDate ? 1 : -1));

    const trend = (r() - 0.35) * 0.05;
    const start = estimate * (0.93 + r() * 0.04);
    const series: MarketPoint[] = Array.from({ length: 12 }, (_, i) => {
      const month = isoMonthsAgo(11 - i, 1).slice(0, 7);
      const wobble = (r() - 0.5) * 0.012;
      return { month, medianPrice: roundTo(start * (1 + (trend * i) / 11 + wobble), 1_000) };
    });
    const first = series[0].medianPrice;
    const last = series[series.length - 1].medianPrice;

    const weeklyEstimate = roundTo((estimate * (0.036 + r() * 0.008)) / 52, 5);

    return {
      provider: "mock",
      isDemo: true,
      generatedAt: new Date().toISOString(),
      address,
      property: {
        type: "House",
        bedrooms,
        bathrooms,
        carParks,
        floorAreaM2,
        landAreaM2,
        yearBuilt,
        legalDescription: `Lot ${1 + Math.floor(r() * 120)} DP ${300000 + Math.floor(r() * 99999)}`,
      },
      valuation: {
        low,
        estimate,
        high,
        confidence: spread < 0.075 ? "High" : spread < 0.088 ? "Medium" : "Low",
        asAt: new Date().toISOString().slice(0, 10),
      },
      comparables,
      market: {
        areaName: address.suburb,
        medianPrice: last,
        annualChangePct: Math.round(((last - first) / first) * 1000) / 10,
        medianDaysToSell: 28 + Math.floor(r() * 24),
        series,
      },
      rental: {
        weeklyLow: roundTo(weeklyEstimate * 0.93, 5),
        weeklyEstimate,
        weeklyHigh: roundTo(weeklyEstimate * 1.07, 5),
        grossYieldPct: Math.round(((weeklyEstimate * 52) / estimate) * 1000) / 10,
      },
      attribution: ["Demo data only. Every figure is fictional."],
    };
  },
};
