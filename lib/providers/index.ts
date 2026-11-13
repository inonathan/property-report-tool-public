import { cotalityProvider } from "./cotality";
import { mockProvider } from "./mock";
import type { PropertyDataProvider } from "./types";
import { valocityProvider } from "./valocity";

// the brand file can name a provider; otherwise PROVIDER decides
export function getProvider(name?: string | null): PropertyDataProvider {
  switch ((name || process.env.PROVIDER || "mock").toLowerCase()) {
    case "cotality":
      return cotalityProvider;
    case "valocity":
      return valocityProvider;
    default:
      return mockProvider;
  }
}

export * from "./types";
