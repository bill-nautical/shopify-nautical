// src/connections.ts
import { connection } from "@prismatic-io/spectral";

export const shopifyConnection = connection({
  key: "shopify",
  oauth2: {
    // OAuth 2.0 configuration for Shopify
    authorizeUrl: "https://{{#domain}}.myshopify.com/admin/oauth/authorize/",
    tokenUrl: "https://{{#domain}}.myshopify.com/admin/oauth/access_token",
    scopes: [
      "read_products", "write_products",
      "read_inventory", "write_inventory",
      "read_orders", "write_orders"
    ],
    // Additional OAuth configuration
  }
});

export const nauticalConnection = connection({
  key: "nautical",
  fields: {
    apiUrl: {
      label: "API URL",
      type: "string",
      required: true,
      comments: "The Nautical Commerce API endpoint (e.g., https://api-{your_domain}.com/graphql/)",
    },
    apiKey: {
      label: "API Key",
      type: "password",
      required: true,
      comments: "Nautical Commerce API Key",
    },
  }
});
