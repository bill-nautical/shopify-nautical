/**
 * Unit tests for the Shopify to Nautical Commerce integration flows.
 * These tests verify that our flows work correctly before publishing.
 */

import { invokeFlow } from "@prismatic-io/spectral/dist/testing";
import { fetchItemsFlow } from "./flows";

// Mock connections for testing
const shopifyConnection = {
  fields: {
    shopDomain: "test-store",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
  },
};

const nauticalConnection = {
  fields: {
    apiUrl: "https://api.nauticalcommerce.com/graphql",
    apiKey: "test-nautical-key",
    tenantId: "test-tenant-id",
  },
};

describe("Shopify to Nautical integration flows", () => {
  test("fetchItemsFlow returns product data", async () => {
    // Mock axios or use a mocking library like nock to intercept HTTP requests
    // For now, we'll just test the basic structure since the flow uses a public mock API
    const { result } = await invokeFlow(fetchItemsFlow, {
      configVars: {
        "Shopify Connection": shopifyConnection,
        "Nautical Connection": nauticalConnection,
      },
    });

    // Verify the result has the expected structure
    expect(result?.data).toHaveProperty("items");
    expect(result?.data).toHaveProperty("message");
  });
});
