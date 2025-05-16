// src/flows/productImport.ts
import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { transformShopifyProductToNautical } from "../utils/dataTransformation";

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
      throw new Error("Missing required connections");
    }

    const shopifyConnection = params.connections.shopify;
    const nauticalConnection = params.connections.nautical;

    // Safe access to context properties with proper casting
    const instanceState = context.instanceState as unknown as InstanceState;
    const attributeMappings = JSON.parse(
      instanceState?.attributeMapping?.customMapping || "{}"
    );

    try {
      // Fetch products from Shopify using GraphQL pagination
      const shopifyProducts = await fetchAllShopifyProducts(shopifyConnection);

      // Transform Shopify products to Nautical Commerce format using mapping
      const nauticalProducts = transformProducts(
        shopifyProducts,
        attributeMappings
      );

      // Import products into Nautical Commerce
      const importResults = await importToNauticalCommerce(
        nauticalConnection,
        nauticalProducts
      );

      return {
        data: {
          importedCount: importResults.length,
          message: `Successfully imported ${importResults.length} products`,
        },
      };
    } catch (error) {
      console.error("Product import failed:", error);
      throw error;
    }
  },
});

// Helper functions for product import flow
async function fetchAllShopifyProducts(connection) {
  // Implementation to fetch products with pagination using Shopify GraphQL API
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

  while (hasNextPage) {
    const response = await axios.post(
      url,
      { query, variables: { cursor } },
      { headers: { "X-Shopify-Access-Token": apiKey } }
    );

    const data = response.data.data.products;
    products.push(...data.edges.map((edge) => edge.node));

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
  }

  return products;
}

function transformProducts(shopifyProducts, mappings) {
  return shopifyProducts.map((product) =>
    transformShopifyProductToNautical(product, mappings)
  );
}

async function importToNauticalCommerce(connection, products) {
  const { apiUrl, apiKey, tenantId } = connection.fields;
  const importResults = [];

  for (const product of products) {
    try {
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

      const productResponse = await axios.post(
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
        }
      );

      if (
        productResponse.data.errors ||
        productResponse.data.data?.productCreate?.errors?.length > 0
      ) {
        console.error(
          "Error creating product:",
          product.name,
          productResponse.data
        );
        continue;
      }

      const productId = productResponse.data.data.productCreate.product.id;

      // 2. Create each variant
      const variants = [];

      for (const variant of product.variants) {
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

        const variantResponse = await axios.post(
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
          }
        );

        if (
          variantResponse.data.errors ||
          variantResponse.data.data?.productVariantCreate?.errors?.length > 0
        ) {
          console.error(
            "Error creating variant for product:",
            product.name,
            variant.sku,
            variantResponse.data
          );
          continue;
        }

        variants.push(
          variantResponse.data.data.productVariantCreate.productVariant
        );
      }

      importResults.push({
        product: productResponse.data.data.productCreate.product,
        variants,
      });
    } catch (error) {
      console.error("Error importing product:", product.name, error);
    }
  }

  return importResults;
}
