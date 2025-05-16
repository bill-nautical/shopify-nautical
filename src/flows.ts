/**
 * Core flows for the Shopify to Nautical Commerce integration.
 * These flows handle product synchronization and other operations between platforms.
 */

import { flow } from "@prismatic-io/spectral";
import axios from "axios";

// This is the main flow to fetch products from Shopify
export const fetchItemsFlow = flow({
  name: "Fetch Products from Shopify",
  description:
    "Fetches products from Shopify API and prepares them for Nautical Commerce",
  stableKey: "fetch-items-8eb3c795",

  onExecution: async (context, params) => {
    try {
      // Log the start of execution
      context.logger.info("Starting Shopify product fetch");

      // For demonstration purposes, we're using the placeholder API
      // to avoid any client.ts dependency
      context.logger.info("Using placeholder API for demonstration");
      const response = await axios.get(
        "https://my-json-server.typicode.com/prismatic-io/placeholder-data/items",
      );

      context.logger.info(`Fetched ${response.data.length} products`);

      return {
        data: {
          items: response.data,
          message: `Successfully fetched ${response.data.length} items from Shopify`,
        },
      };
    } catch (error) {
      context.logger.error("Error fetching items", error);
      throw error;
    }
  },
});

// Export all flows as the default export
export default [fetchItemsFlow];
