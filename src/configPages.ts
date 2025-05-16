/**
 * Configuration wizard for the Shopify to Nautical Commerce integration.
 * This defines the connection fields and settings that users will configure
 * when setting up an instance of the integration.
 */

import {
  configPage,
  connectionConfigVar,
  configVar,
} from "@prismatic-io/spectral";

export const configPages = {
  Connections: configPage({
    tagline: "Set up connections to Shopify and Nautical Commerce",
    elements: {
      // Helper text
      helperText1: "<h2>Integration Connections</h2>",
      helperText2: "Configure the connections required for this integration to work.",
      
      // Shopify Connection
      "Shopify Connection": connectionConfigVar({
        stableKey: "shopify-connection-41a8b723",
        dataType: "connection",
        inputs: {
          shopDomain: {
            label: "Shopify Store Domain",
            type: "string",
            required: true,
            default: "your-store",
            example: "your-store.myshopify.com",
          },
          apiKey: {
            label: "Shopify API Key",
            type: "password",
            required: true,
            comments: "Your Shopify Admin API key",
          },
          apiSecret: {
            label: "Shopify API Secret",
            type: "password",
            required: true,
            comments: "Your Shopify Admin API secret",
          }
        },
      }),
      
      // Nautical Connection
      "Nautical Connection": connectionConfigVar({
        stableKey: "nautical-connection-5fd27b9c",
        dataType: "connection",
        inputs: {
          apiUrl: {
            label: "Nautical API URL",
            type: "string",
            required: true,
            default: "https://api.nauticalcommerce.com/graphql",
            example: "https://api.nauticalcommerce.com/graphql",
          },
          apiKey: {
            label: "Nautical API Key",
            type: "password",
            required: true,
            comments: "Your Nautical Commerce API key",
          },
          tenantId: {
            label: "Tenant ID",
            type: "string",
            required: true,
            comments: "Your Nautical Commerce tenant ID",
          }
        },
      }),
    },
  }),
  
  // General Configuration
  "General Configuration": configPage({
    tagline: "Configure general settings for the integration",
    elements: {
      "Import All Products": configVar({
        stableKey: "import-all-products-3e6c81d5",
        dataType: "boolean",
        description: "Import all products from Shopify during initial setup",
        defaultValue: true,
      }),
    },
  }),
}; 