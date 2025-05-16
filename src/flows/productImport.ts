// src/flows/productImport.ts
import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { transformShopifyProductToNautical } from "../utils/dataTransformation";
import { logInfo, logError, logDebug } from "../utils/logging";
import { withRetry, handleApiError } from "../utils/errorHandling";

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
      instanceState?.attributeMapping?.customMapping || "{}",
    );

    try {
      logInfo(context, "Starting product import from Shopify to Nautical", {
        shopifyDomain: shopifyConnection.fields.shopDomain,
      });

      // Fetch products from Shopify using GraphQL pagination
      const shopifyProducts = await fetchAllShopifyProducts(
        context,
        shopifyConnection,
      );
      logInfo(context, "Fetched products from Shopify", {
        count: shopifyProducts.length,
      });

      // Transform Shopify products to Nautical Commerce format using mapping
      const nauticalProducts = transformProducts(
        shopifyProducts,
        attributeMappings,
      );
      logInfo(context, "Transformed products to Nautical format", {
        count: nauticalProducts.length,
      });

      // Import products into Nautical Commerce
      const importResults = await importToNauticalCommerce(
        context,
        nauticalConnection,
        nauticalProducts,
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
 * Fetch all products from Shopify with pagination
 * @param context The action context for logging
 * @param connection The Shopify connection details
 * @returns Array of products from Shopify
 */
async function fetchAllShopifyProducts(context, connection) {
  const { shopDomain, apiKey } = connection.fields;
  const url = `https://${shopDomain}.myshopify.com/admin/api/2023-04/graphql.json`;

  const query = `
    query ($cursor: String) {
      products(first: 50, after: $cursor) {
        edges {
          node {
            id
            title
            description
            descriptionHtml
            productType
            vendor
            status
            options {
              id
              name
              values
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  price
                  compareAtPrice
                  inventoryQuantity
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let hasNextPage = true;
  let cursor = null;
  const products = [];

  try {
    logDebug(context, "Starting product fetch from Shopify", { shopDomain });

    while (hasNextPage) {
      logDebug(context, "Fetching products batch from Shopify", { cursor });

      // Use withRetry to handle potential rate limiting
      const response = await withRetry(
        () =>
          axios.post(
            url,
            { query, variables: { cursor } },
            { headers: { "X-Shopify-Access-Token": apiKey } },
          ),
        3,
        1000,
        context,
      );

      const data = response.data.data.products;
      const batchSize = data.edges.length;
      products.push(...data.edges.map((edge) => edge.node));

      logDebug(context, "Fetched products batch", {
        batchSize,
        totalCount: products.length,
      });

      hasNextPage = data.pageInfo.hasNextPage;
      cursor = data.pageInfo.endCursor;
    }

    return products;
  } catch (error) {
    throw handleApiError(error, "fetching products from Shopify", context);
  }
}

/**
 * Transform Shopify products to Nautical format
 * @param shopifyProducts Array of products from Shopify
 * @param mappings Attribute mappings between Shopify and Nautical
 * @returns Array of products in Nautical format
 */
function transformProducts(shopifyProducts, mappings) {
  return shopifyProducts.map((product) =>
    transformShopifyProductToNautical(product, mappings),
  );
}

/**
 * Import products to Nautical Commerce
 * @param context The action context for logging
 * @param connection The Nautical connection details
 * @param products Array of products in Nautical format
 * @returns Array of import results
 */
async function importToNauticalCommerce(context, connection, products) {
  const { apiUrl, apiKey, tenantId } = connection.fields;
  const importResults = [];

  logInfo(context, "Starting to import products to Nautical Commerce", {
    productCount: products.length,
  });

  for (const product of products) {
    try {
      logDebug(context, "Creating product in Nautical", {
        productName: product.name,
        variantCount: product.variants?.length || 0,
      });

      // 1. Create the product first
      const productCreateMutation = `
        mutation ProductCreate($input: ProductCreateInput!) {
          productCreate(input: $input) {
            product {
              id
              name
            }
            errors {
              field
              message
            }
          }
        }
      `;

      const productInput = {
        name: product.name,
        description: product.description,
        productType: product.productType,
        attributes: product.attributes,
        externalId: product.externalId,
        externalSource: product.externalSource,
      };

      // Use withRetry for API calls to handle temporary failures
      const productResponse = await withRetry(
        () =>
          axios.post(
            apiUrl,
            {
              query: productCreateMutation,
              variables: { input: productInput },
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "x-nautical-tenant": tenantId,
                "Content-Type": "application/json",
              },
            },
          ),
        3,
        1000,
        context,
      );

      if (
        productResponse.data.errors ||
        productResponse.data.data?.productCreate?.errors?.length > 0
      ) {
        const errorDetails =
          productResponse.data.errors ||
          productResponse.data.data?.productCreate?.errors;
        const error = new Error(
          `Error creating product: ${JSON.stringify(errorDetails)}`,
        );
        logError(context, `Failed to create product: ${product.name}`, error);
        continue;
      }

      const productId = productResponse.data.data.productCreate.product.id;
      logDebug(context, "Created product in Nautical", {
        productId,
        productName: product.name,
      });

      // 2. Create each variant
      const variants = [];

      for (const variant of product.variants) {
        try {
          logDebug(context, "Creating variant in Nautical", {
            sku: variant.sku,
            productId,
          });

          const variantCreateMutation = `
            mutation ProductVariantCreate($input: ProductVariantCreateInput!) {
              productVariantCreate(input: $input) {
                productVariant {
                  id
                  sku
                }
                errors {
                  field
                  message
                }
              }
            }
          `;

          const variantInput = {
            productId,
            sku: variant.sku,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            quantity: variant.inventoryQuantity || 0,
            attributes: variant.attributes,
            externalId: variant.externalId,
            externalSource: variant.externalSource,
          };

          // Use withRetry for API calls
          const variantResponse = await withRetry(
            () =>
              axios.post(
                apiUrl,
                {
                  query: variantCreateMutation,
                  variables: { input: variantInput },
                },
                {
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "x-nautical-tenant": tenantId,
                    "Content-Type": "application/json",
                  },
                },
              ),
            3,
            1000,
            context,
          );

          if (
            variantResponse.data.errors ||
            variantResponse.data.data?.productVariantCreate?.errors?.length > 0
          ) {
            const errorDetails =
              variantResponse.data.errors ||
              variantResponse.data.data?.productVariantCreate?.errors;
            const error = new Error(
              `Error creating variant: ${JSON.stringify(errorDetails)}`,
            );
            logError(
              context,
              `Failed to create variant for product: ${product.name}, SKU: ${variant.sku}`,
              error,
            );
            continue;
          }

          const createdVariant =
            variantResponse.data.data.productVariantCreate.productVariant;
          variants.push(createdVariant);

          logDebug(context, "Created variant in Nautical", {
            variantId: createdVariant.id,
            sku: createdVariant.sku,
          });
        } catch (error) {
          const formattedError = handleApiError(
            error,
            `creating variant for product: ${product.name}, SKU: ${variant.sku}`,
            context,
          );
          logError(context, `Failed to create variant`, formattedError);
        }
      }

      importResults.push({
        product: productResponse.data.data.productCreate.product,
        variants,
      });

      logInfo(context, "Imported product with variants", {
        productName: product.name,
        productId,
        variantCount: variants.length,
      });
    } catch (error) {
      const formattedError = handleApiError(
        error,
        `importing product: ${product.name}`,
        context,
      );
      logError(context, "Error importing product", formattedError);
    }
  }

  return importResults;
}
