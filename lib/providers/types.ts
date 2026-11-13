// Every provider maps its own response into these types, so nothing else in the app
// needs to know which one is in use. Fields are nullable where a data licence may leave them out.

export type AddressMatch = {
  // opaque id that the provider can resolve again later
  id: string;
  full: string;
  street: string;
  suburb: string;
  city: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
};

export type Comparable = {
  address: string;
  soldDate: string; // ISO date
  price: number; // NZD
  bedrooms: number | null;
  bathrooms: number | null;
  floorAreaM2: number | null;
  landAreaM2: number | null;
  distanceKm: number | null;
};

export type MarketPoint = { month: string; medianPrice: number }; // month: "2026-03"

export type PropertyReport = {
  provider: string;
  // demo reports get a watermark
  isDemo: boolean;
  generatedAt: string; // ISO
  address: AddressMatch;
  property: {
    type: string | null; // "House", "Townhouse", "Apartment"...
    bedrooms: number | null;
    bathrooms: number | null;
    carParks: number | null;
    floorAreaM2: number | null;
    landAreaM2: number | null;
    yearBuilt: number | null;
    legalDescription: string | null;
  };
  valuation: {
    low: number;
    estimate: number;
    high: number;
    confidence: "High" | "Medium" | "Low";
    asAt: string; // ISO date
  } | null;
  comparables: Comparable[];
  market: {
    areaName: string;
    medianPrice: number | null;
    annualChangePct: number | null;
    medianDaysToSell: number | null;
    series: MarketPoint[];
  } | null;
  rental: {
    weeklyLow: number;
    weeklyEstimate: number;
    weeklyHigh: number;
    grossYieldPct: number | null;
  } | null;
  // credit lines some data licences require, printed in the footer
  attribution: string[];
};

export interface PropertyDataProvider {
  id: string;
  searchAddresses(query: string, limit?: number): Promise<AddressMatch[]>;
  resolveAddress(id: string): Promise<AddressMatch | null>;
  getReport(addressId: string): Promise<PropertyReport>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, detail: string) {
    super(`Provider "${provider}" is not configured: ${detail}`);
    this.name = "ProviderNotConfiguredError";
  }
}
