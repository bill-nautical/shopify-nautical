import { connection } from "@prismatic-io/spectral";

export const shopifyConnection = connection({
  key: "shopify",
  label: "Shopify",
  comments: "Connection to Shopify store",
  inputs: {
    shopDomain: {
      label: "Shop Domain",
      type: "string",
      required: true,
      comments: "Your Shopify store domain (e.g., your-store.myshopify.com)",
    },
    apiKey: {
      label: "API Key",
      type: "string",
      required: true,
      comments: "Your Shopify Admin API access token",
      sensitive: true,
    },
  },
});
