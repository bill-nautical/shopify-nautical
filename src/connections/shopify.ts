import { connection, oauth2Connection } from "@prismatic-io/spectral";

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
      comments: "The Shopify store subdomain, without '.myshopify.com'"
    }
  },
  oauth2Config: {
    authorizationUrl: {
      // OAuth flow redirects here to start the authorization process
      default: "https://{{ subdomain }}.myshopify.com/admin/oauth/authorize",
      template: "https://{{ subdomain }}.myshopify.com/admin/oauth/authorize"
    },
    accessTokenUrl: {
      // After authorization, client will exchange code for an access token using this URL
      default: "https://{{ subdomain }}.myshopify.com/admin/oauth/access_token",
      template: "https://{{ subdomain }}.myshopify.com/admin/oauth/access_token"
    },
    // Scopes required for integration functionality
    scopes: [
      "read_products",
      "write_products",
      "read_orders",
      "write_orders", 
      "read_inventory",
      "write_inventory"
    ],
    // API endpoint for integration to use once authorized
    apiUrl: {
      default: "https://{{ subdomain }}.myshopify.com/admin/api/2025-04/graphql.json",
      template: "https://{{ subdomain }}.myshopify.com/admin/api/2025-04/graphql.json"
    },
    tokenParams: {
      includeCredentials: true,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    },
    requestParams: {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    }
  }
}); 