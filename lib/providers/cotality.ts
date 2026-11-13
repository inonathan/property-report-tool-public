import { ProviderNotConfiguredError, type PropertyDataProvider } from "./types";

// Not implemented: needs a signed licence and sandbox credentials, and the endpoints and field
// names have to come from the licensed API docs. Rough plan:
//  - OAuth 2.0 client-credentials token
//  - address match -> property id, attributes, AVM (with range and confidence), comparables, rental, area stats
//  - map each response into PropertyReport and return null for anything the licence excludes
//  - cache AVM results per property, they are billed per call
const notReady = () =>
  new ProviderNotConfiguredError("cotality", "integration pending licence and credentials (see lib/providers/cotality.ts).");

export const cotalityProvider: PropertyDataProvider = {
  id: "cotality",
  async searchAddresses() {
    throw notReady();
  },
  async resolveAddress() {
    throw notReady();
  },
  async getReport() {
    throw notReady();
  },
};
