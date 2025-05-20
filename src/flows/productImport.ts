// src/flows/productImport.ts
import { flow } from "@prismatic-io/spectral";
import { transformShopifyProductToNautical } from "../utils/dataTransformation";
import { logInfo, logError, logDebug } from "../utils/logging";
import { withRetry } from "../utils/errorHandling";
import { fetchProducts } from "../components/shopify";
import { createProduct } from "../components/nautical";

// Define more specific types
interface ConnectionParams {
  connections: {
    shopify: {
      fields: {
        shopDomain: string;
        apiKey: string;
      };
    };
    nautical: {
      fields: {
        apiUrl: string;
        apiKey: string;
        tenantId: string;
      };
    };
  };
}

// Type guard helper
function hasConnections(obj: unknown): obj is ConnectionParams {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "connections" in (obj as Record<string, unknown>)
  );
}

// Type for context.instanceState
interface InstanceState {
  attributeMapping?: {
    customMapping?: string;
  };
}

// Define types for Shopify product data
interface ShopifyProduct {
  title: string;
  description: string;
  variants: {
    edges: Array<{
      node: {
        sku: string;
        price: string;
        inventoryQuantity: number;
        selectedOptions: Array<{
          name: string;
          value: string;
        }>;
      };
    }>;
  };
  [key: string]: unknown;
}

// Define types for attribute mappings
interface AttributeMapping {
  shopifyField: string;
  nauticalField: string;
}

export const productImportFlow = flow({
  name: "Product Import from Shopify",
  stableKey: "product-import",
  description: "Import products and variants from Shopify to Nautical Commerce",

  // Triggered when an instance is deployed or manually triggered
  onExecution: async (context, params) => {
    // Type guard to ensure params has connections
    if (!hasConnections(params)) {
      const error = new Error("Missing required connections");
      logError(context, "Failed to initialize product import flow", error);
      throw error;
    }

    const shopifyConnection = params.connections.shopify;
    const nauticalConnection = params.connections.nautical;

    // Safe access to context properties with proper casting
    const instanceState = context.instanceState as unknown as InstanceState;
    const attributeMappings = JSON.parse(
      instanceState?.attributeMapping?.customMapping || "{}"
    ) as AttributeMapping[];

    try {
      logInfo(context, "Starting product import from Shopify to Nautical", {
        shopifyDomain: shopifyConnection.fields.shopDomain,
      });

      // Fetch products from Shopify using the Prismatic component
      const { data: shopifyResponse } =
        await fetchProducts.actions.fetch.perform(context, {
          shopifyConnection,
          limit: "50",
          cursor: null,
        });

      const shopifyProducts = (
        shopifyResponse as {
          data: { products: { edges: Array<{ node: ShopifyProduct }> } };
        }
      ).data.products.edges.map((edge) => edge.node);

      logInfo(context, "Fetched products from Shopify", {
        count: shopifyProducts.length,
      });

      // Transform Shopify products to Nautical Commerce format using mapping
      const nauticalProducts = transformProducts(
        shopifyProducts,
        attributeMappings
      );
      logInfo(context, "Transformed products to Nautical format", {
        count: nauticalProducts.length,
      });

      // Import products into Nautical Commerce using the Prismatic component
      const importResults = await Promise.all(
        nauticalProducts.map(async (product) => {
          const { data } = await createProduct.actions.create.perform(context, {
            nauticalConnection,
            ...product,
          });
          return data;
        })
      );

      logInfo(context, "Successfully imported products to Nautical Commerce", {
        importedCount: importResults.length,
      });

      return {
        data: {
          importedCount: importResults.length,
          message: `Successfully imported ${importResults.length} products`,
        },
      };
    } catch (error) {
      const formattedError =
        error instanceof Error ? error : new Error(String(error));
      logError(context, "Product import failed", formattedError);
      throw formattedError;
    }
  },
});

/**
 * Transform Shopify products to Nautical Commerce format
 * @param shopifyProducts Array of products from Shopify
 * @param mappings Attribute mappings between platforms
 * @returns Array of products in Nautical Commerce format
 */
function transformProducts(
  shopifyProducts: ShopifyProduct[],
  mappings: AttributeMapping[]
) {
  return shopifyProducts.map((product) => {
    // Apply attribute mappings
    const mappedAttributes: Record<string, unknown> = {};
    for (const mapping of mappings) {
      const shopifyValue = product[mapping.shopifyField];
      if (shopifyValue !== undefined) {
        mappedAttributes[mapping.nauticalField] = shopifyValue;
      }
    }

    return {
      title: product.title,
      description: product.description,
      variants: product.variants.edges.map((edge) => ({
        sku: edge.node.sku,
        price: edge.node.price,
        inventoryQuantity: edge.node.inventoryQuantity,
        options: edge.node.selectedOptions,
      })),
      ...mappedAttributes,
    };
  });
}
