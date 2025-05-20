import { oauth2Connection } from "@prismatic-io/spectral";

export const shopifyConnection = oauth2Connection({
  key: "shopify",
  label: "Shopify",
  comments: "Connection to Shopify Admin API",
  inputs: {
    subdomain: {
      label: "Shop Domain",
      type: "string",
      required: true,
      placeholder: "my-store",
      comments: "The Shopify store subdomain, without '.myshopify.com'",
    },
    clientId: {
      label: "Client ID",
      type: "string",
      required: true,
      comments: "Your Shopify app's client ID",
    },
    clientSecret: {
      label: "Client Secret",
      type: "string",
      required: true,
      comments: "Your Shopify app's client secret",
    },
  },
  authorizationUrl:
    "https://{{ subdomain }}.myshopify.com/admin/oauth/authorize",
  accessTokenUrl:
    "https://{{ subdomain }}.myshopify.com/admin/oauth/access_token",
  tokenUrl: "https://{{ subdomain }}.myshopify.com/admin/oauth/access_token",
  scopes: [
    "read_products",
    "write_products",
    "read_orders",
    "write_orders",
    "read_inventory",
    "write_inventory",
  ],
  tokenParams: {
    includeCredentials: true,
  },
  requestParams: {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  },
});
