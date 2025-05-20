import { component, input } from "@prismatic-io/spectral";
import { createShopifyClient } from "../client";
import { logInfo, logError } from "../utils/logging";
import { withRetry } from "../utils/errorHandling";
import axios from "axios";

// Define types for the component
interface ShopifyConnection {
  fields: {
    shopDomain: string;
    apiKey: string;
  };
}

// Component to fetch products from Shopify
export const fetchProducts = component({
  key: "fetchProducts",
  display: {
    label: "Fetch Products",
    description: "Fetch products from Shopify",
    iconPath: "icons/fetch-products.svg",
    category: "Products",
  },
  actions: {
    fetch: {
      display: {
        label: "Fetch Products",
        description: "Fetch products from Shopify",
      },
      inputs: {
        shopifyConnection: {
          label: "Shopify Connection",
          type: "connection",
          required: true,
          comments: "The Shopify connection to use",
        },
        limit: {
          label: "Limit",
          type: "string",
          required: false,
          comments: "Maximum number of products to fetch",
          default: "50",
        },
        cursor: {
          label: "Cursor",
          type: "string",
          required: false,
          comments: "Cursor for pagination",
        },
      },
      perform: async (context, params) => {
        const { shopifyConnection, limit, cursor } = params;
        const { shopDomain, apiKey } = (shopifyConnection as ShopifyConnection)
          .fields;

        try {
          logInfo(context, "Fetching products from Shopify", {
            shopDomain,
            limit,
            cursor,
          });

          const query = `
            query ($cursor: String, $limit: Int!) {
              products(first: $limit, after: $cursor) {
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

          const response = await withRetry(
            () =>
              axios.post(
                `https://${shopDomain}.myshopify.com/admin/api/2023-04/graphql.json`,
                {
                  query,
                  variables: {
                    limit: Number.parseInt(limit || "50", 10),
                    cursor,
                  },
                },
                {
                  headers: {
                    "X-Shopify-Access-Token": apiKey,
                    "Content-Type": "application/json",
                  },
                }
              ),
            3,
            1000,
            context
          );

          if (response.data.errors) {
            throw new Error(
              `Error fetching products: ${JSON.stringify(response.data.errors)}`
            );
          }

          const products = response.data.data.products;
          logInfo(context, "Successfully fetched products from Shopify", {
            count: products.edges.length,
            hasNextPage: products.pageInfo.hasNextPage,
          });

          return { data: products };
        } catch (error) {
          const formattedError =
            error instanceof Error ? error : new Error(String(error));
          logError(
            context,
            "Failed to fetch products from Shopify",
            formattedError
          );
          throw formattedError;
        }
      },
    },
  },
});

// Component to create a product in Shopify
export const createProduct = component({
  key: "createProduct",
  display: {
    label: "Create Product",
    description: "Create a new product in Shopify",
    iconPath: "icon.png",
    category: "Products",
  },
  actions: {
    create: {
      display: {
        label: "Create Product",
        description: "Create a new product in Shopify",
      },
      inputs: {
        shopifyConnection: input({
          label: "Shopify Connection",
          type: "connection",
          required: true,
          comments: "Connection to Shopify",
        }),
        title: input({
          label: "Title",
          type: "string",
          required: true,
          comments: "Product title",
        }),
        description: input({
          label: "Description",
          type: "string",
          required: false,
          comments: "Product description",
        }),
        price: input({
          label: "Price",
          type: "string",
          required: true,
          comments: "Product price",
        }),
        sku: input({
          label: "SKU",
          type: "string",
          required: true,
          comments: "Product SKU",
        }),
      },
      perform: async (context, params) => {
        try {
          logInfo(context, "Creating new product in Shopify", {
            title: params.title,
          });
          const client = createShopifyClient(params.shopifyConnection);

          const mutation = `
            mutation CreateProduct($input: ProductInput!) {
              productCreate(input: $input) {
                product {
                  id
                  title
                  description
                  handle
                  status
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const variables = {
            input: {
              title: params.title,
              description: params.description,
              variants: [
                {
                  price: params.price,
                  sku: params.sku,
                },
              ],
            },
          };

          const response = await withRetry(
            () => client.post("", { query: mutation, variables }),
            3,
            1000,
            context
          );

          logInfo(context, "Successfully created product", {
            id: response.data.data.productCreate.product.id,
          });

          return {
            data: response.data,
          };
        } catch (error) {
          logError(
            context,
            "Error creating product in Shopify",
            error as Error
          );
          throw error;
        }
      },
    },
  },
});
