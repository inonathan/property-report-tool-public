import { ProviderNotConfiguredError, type PropertyDataProvider } from "./types";

// Alternative to Cotality, same contract and same status: a stub until there is a licence.
const notReady = () =>
  new ProviderNotConfiguredError("valocity", "integration pending licence and credentials (see lib/providers/valocity.ts).");

export const valocityProvider: PropertyDataProvider = {
  id: "valocity",
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
