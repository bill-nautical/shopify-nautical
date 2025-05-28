import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import type { AxiosResponse } from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";
import type {
  ShopifyConnection,
  NauticalConnection,
  ShopifyInventoryItem,
  NauticalInventoryItem,
  InventoryUpdate,
  ShopifyInventoryResponse,
  ConfigVars,
} from "../types";

export const inventorySyncFlow = flow({
  name: "Inventory Sync",
  stableKey: "inventory-sync",
  description:
    "Synchronize inventory levels between Shopify and Nautical Commerce",
  inputs: {
    shopifyConnection: {
      label: "Shopify Connection",
      type: "connection",
      required: true,
      comments: "Connection to Shopify API",
    },
    nauticalConnection: {
      label: "Nautical Connection",
      type: "connection",
      required: true,
      comments: "Connection to Nautical Commerce API",
    },
  },

  onExecution: async (context, params) => {
    const configVars = context.configVars as ConfigVars;
    const shopifyConnection = configVars.shopifyConnection;
    const nauticalConnection = configVars.nauticalConnection;

    try {
      // Fetch inventory levels from both platforms
      const shopifyInventory = await fetchShopifyInventory(shopifyConnection);
      const nauticalInventory =
        await fetchNauticalInventory(nauticalConnection);

      // Determine inventory updates needed
      const updates = calculateInventoryUpdates(
        shopifyInventory,
        nauticalInventory
      );

      // Apply updates to both platforms
      await applyInventoryUpdates(
        shopifyConnection,
        nauticalConnection,
        updates
      );

      logInfo(
        context,
        `Successfully synchronized inventory for ${updates.length} products`,
        {
          updatesApplied: updates.length,
        }
      );

      return {
        data: {
          updatesApplied: updates.length,
          message: `Successfully synchronized inventory for ${updates.length} products`,
        },
      };
    } catch (error) {
      logError(context, "Inventory sync failed", error as Error);
      throw error;
    }
  },
});

// Helper functions for inventory sync
async function fetchShopifyInventory(
  connection: ShopifyConnection
): Promise<ShopifyInventoryItem[]> {
  const query = `
    query GetInventoryLevels {
      inventoryItems(first: 250) {
        edges {
          node {
            id
            inventoryLevels(first: 50) {
              edges {
                node {
                  id
                  available
                  location {
                    id
                    name
                  }
                }
              }
            }
            variant {
              id
              sku
              product {
                id
                title
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

  try {
    const response = (await withRetry(() =>
      axios({
        url: connection.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": connection.accessToken,
        },
        data: {
          query,
        },
      })
    )) as AxiosResponse<ShopifyInventoryResponse>;

    // Process and return the inventory items
    return response.data.data.inventoryItems.edges.map(
      (edge: {
        node: ShopifyInventoryResponse["data"]["inventoryItems"]["edges"][0]["node"];
      }) => {
        const node = edge.node;
        return {
          id: node.id,
          variantId: node.variant?.id,
          sku: node.variant?.sku,
          productId: node.variant?.product?.id,
          productTitle: node.variant?.product?.title,
          levels: node.inventoryLevels.edges.map(
            (levelEdge: {
              node: ShopifyInventoryResponse["data"]["inventoryItems"]["edges"][0]["node"]["inventoryLevels"]["edges"][0]["node"];
            }) => ({
              id: levelEdge.node.id,
              available: levelEdge.node.available,
              location: levelEdge.node.location,
            })
          ),
        };
      }
    );
  } catch (error) {
    throw handleApiError(error, "Fetch Shopify Inventory");
  }
}

async function fetchNauticalInventory(
  connection: NauticalConnection
): Promise<NauticalInventoryItem[]> {
  const query = `
    query GetInventory {
      products(first: 250) {
        nodes {
          id
          externalId
          name
          variants {
            nodes {
              id
              sku
              inventoryQuantity
              externalId
            }
          }
        }
      }
    }
  `;

  try {
    const response = await withRetry(() =>
      axios({
        url: connection.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${connection.apiKey}`,
          "x-nautical-tenant": connection.tenantId,
        },
        data: {
          query,
        },
      })
    );

    // Process and return the inventory items
    const products = response.data.data.products.nodes;
    const inventory: NauticalInventoryItem[] = [];

    for (const product of products) {
      for (const variant of product.variants.nodes) {
        inventory.push({
          productId: product.id,
          productExternalId: product.externalId,
          productName: product.name,
          variantId: variant.id,
          variantExternalId: variant.externalId,
          sku: variant.sku,
          quantity: variant.inventoryQuantity,
        });
      }
    }

    return inventory;
  } catch (error) {
    throw handleApiError(error, "Fetch Nautical Inventory");
  }
}

function calculateInventoryUpdates(
  shopifyInventory: ShopifyInventoryItem[],
  nauticalInventory: NauticalInventoryItem[]
): InventoryUpdate[] {
  const updates: InventoryUpdate[] = [];
  const nauticalBySku = new Map(
    nauticalInventory.map((item) => [item.sku, item])
  );

  for (const shopifyItem of shopifyInventory) {
    if (!shopifyItem.sku || !shopifyItem.variantId) continue;

    const nauticalItem = nauticalBySku.get(shopifyItem.sku);
    if (!nauticalItem) continue;

    const shopifyQuantity = shopifyItem.levels.reduce(
      (sum, level) => sum + level.available,
      0
    );
    const targetQuantity = Math.min(shopifyQuantity, nauticalItem.quantity);

    if (shopifyQuantity !== targetQuantity) {
      updates.push({
        sku: shopifyItem.sku,
        shopifyVariantId: shopifyItem.variantId,
        nauticalVariantId: nauticalItem.variantId,
        shopifyQuantity,
        nauticalQuantity: nauticalItem.quantity,
        targetQuantity,
      });
    }
  }

  return updates;
}

async function applyInventoryUpdates(
  shopifyConn: ShopifyConnection,
  nauticalConn: NauticalConnection,
  updates: InventoryUpdate[]
): Promise<void> {
  const updatePromises = updates.map(async (update) => {
    await updateNauticalInventory(
      nauticalConn,
      update.nauticalVariantId,
      update.targetQuantity
    );
  });

  await Promise.all(updatePromises);
}

async function updateNauticalInventory(
  connection: NauticalConnection,
  variantId: string,
  quantity: number
): Promise<void> {
  const mutation = `
    mutation UpdateInventory($variantId: ID!, $quantity: Int!) {
      updateVariantInventory(input: {
        variantId: $variantId,
        quantity: $quantity
      }) {
        variant {
          id
          inventoryQuantity
        }
      }
    }
  `;

  try {
    await withRetry(() =>
      axios({
        url: connection.apiUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${connection.apiKey}`,
          "x-nautical-tenant": connection.tenantId,
        },
        data: {
          query: mutation,
          variables: {
            variantId,
            quantity,
          },
        },
      })
    );
  } catch (error) {
    throw handleApiError(error, "Update Nautical Inventory");
  }
}
