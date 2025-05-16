/**
 * HTTP clients for connecting to Shopify and Nautical Commerce APIs.
 * These reusable clients will be used in our flows for API integration.
 */

import { type Connection, util } from "@prismatic-io/spectral";
import { createClient } from "@prismatic-io/spectral/dist/clients/http";

export function createShopifyClient(shopifyConnection: Connection) {
  const { shopDomain, apiKey, apiSecret } = shopifyConnection.fields;

  return createClient({
    baseUrl: util.types.toString(
      `https://${shopDomain}.myshopify.com/admin/api/2023-04/`,
    ),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": util.types.toString(apiKey),
    },
  });
}

export function createNauticalClient(nauticalConnection: Connection) {
  const { apiUrl, apiKey, tenantId } = nauticalConnection.fields;

  return createClient({
    baseUrl: util.types.toString(apiUrl),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-nautical-tenant": util.types.toString(tenantId),
    },
  });
}
