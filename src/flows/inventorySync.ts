import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";

export const inventorySyncFlow = flow({
  name: "Inventory Sync",
  stableKey: "inventory-sync",
  description: "Synchronize inventory levels between Shopify and Nautical Commerce",
  
  // Triggered on schedule or manually
  onExecution: async (context, params) => {
    const shopifyConnection = params.connections.shopify;
    const nauticalConnection = params.connections.nautical;
    
    try {
      // Fetch inventory levels from both platforms
      const shopifyInventory = await fetchShopifyInventory(shopifyConnection);
      const nauticalInventory = await fetchNauticalInventory(nauticalConnection);
      
      // Determine inventory updates needed
      const updates = calculateInventoryUpdates(shopifyInventory, nauticalInventory);
      
      // Apply updates to both platforms
      await applyInventoryUpdates(shopifyConnection, nauticalConnection, updates);
      
      logInfo(context, `Successfully synchronized inventory for ${updates.length} products`, {
        updatesApplied: updates.length
      });
      
      return {
        data: {
          updatesApplied: updates.length,
          message: `Successfully synchronized inventory for ${updates.length} products`
        }
      };
    } catch (error) {
      logError(context, "Inventory sync failed", error as Error);
      throw error;
    }
  }
});

// Helper functions for inventory sync
async function fetchShopifyInventory(connection: any) {
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
    const response = await withRetry(() => axios({
      url: connection.apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': connection.accessToken
      },
      data: {
        query
      }
    }));
    
    // Process and return the inventory items
    const inventoryItems = response.data.data.inventoryItems.edges.map((edge: any) => {
      const node = edge.node;
      return {
        id: node.id,
        variantId: node.variant?.id,
        sku: node.variant?.sku,
        productId: node.variant?.product?.id,
        productTitle: node.variant?.product?.title,
        levels: node.inventoryLevels.edges.map((levelEdge: any) => ({
          id: levelEdge.node.id,
          available: levelEdge.node.available,
          locationId: levelEdge.node.location.id,
          locationName: levelEdge.node.location.name
        }))
      };
    });
    
    return inventoryItems;
  } catch (error) {
    throw handleApiError(error, 'Fetch Shopify Inventory');
  }
}

async function fetchNauticalInventory(connection: any) {
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
    const response = await withRetry(() => axios({
      url: connection.apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${connection.apiKey}`,
        'x-nautical-tenant': connection.tenantId
      },
      data: {
        query
      }
    }));
    
    // Process and return the inventory items
    const products = response.data.data.products.nodes;
    const inventory = [];
    
    for (const product of products) {
      for (const variant of product.variants.nodes) {
        inventory.push({
          productId: product.id,
          productExternalId: product.externalId,
          productName: product.name,
          variantId: variant.id,
          variantExternalId: variant.externalId,
          sku: variant.sku,
          quantity: variant.inventoryQuantity
        });
      }
    }
    
    return inventory;
  } catch (error) {
    throw handleApiError(error, 'Fetch Nautical Inventory');
  }
}

function calculateInventoryUpdates(shopifyInventory: any[], nauticalInventory: any[]) {
  const updates = [];
  
  // Map for quick lookup
  const shopifyInventoryMap = new Map();
  const nauticalInventoryMap = new Map();
  
  // Index Shopify inventory by SKU
  for (const item of shopifyInventory) {
    if (item.sku) {
      // Sum up quantities across locations
      const totalQuantity = item.levels.reduce((sum: number, level: any) => sum + level.available, 0);
      shopifyInventoryMap.set(item.sku, {
        ...item,
        totalQuantity
      });
    }
  }
  
  // Index Nautical inventory by SKU
  for (const item of nauticalInventory) {
    if (item.sku) {
      nauticalInventoryMap.set(item.sku, item);
    }
  }
  
  // Compare inventories and find differences
  for (const [sku, shopifyItem] of shopifyInventoryMap.entries()) {
    const nauticalItem = nauticalInventoryMap.get(sku);
    
    if (nauticalItem) {
      // Check if quantities don't match
      if (shopifyItem.totalQuantity !== nauticalItem.quantity) {
        updates.push({
          sku,
          shopifyVariantId: shopifyItem.variantId,
          nauticalVariantId: nauticalItem.variantId,
          shopifyQuantity: shopifyItem.totalQuantity,
          nauticalQuantity: nauticalItem.quantity,
          // Set the source of truth (which platform's quantity to use)
          // For this example, we'll use Shopify as the source of truth
          targetQuantity: shopifyItem.totalQuantity
        });
      }
    }
  }
  
  return updates;
}

async function applyInventoryUpdates(shopifyConn: any, nauticalConn: any, updates: any[]) {
  const results = [];
  
  for (const update of updates) {
    try {
      // Update inventory in Nautical Commerce
      const result = await updateNauticalInventory(nauticalConn, update.nauticalVariantId, update.targetQuantity);
      results.push(result);
    } catch (error) {
      console.error(`Failed to update inventory for SKU ${update.sku}:`, error);
      // Continue with next update even if this one fails
    }
  }
  
  return results;
}

async function updateNauticalInventory(connection: any, variantId: string, quantity: number) {
  const mutation = `
    mutation UpdateInventory($variantId: ID!, $quantity: Int!) {
      variantUpdate(id: $variantId, input: { inventoryQuantity: $quantity }) {
        variant {
          id
          sku
          inventoryQuantity
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  try {
    const response = await axios({
      url: connection.apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${connection.apiKey}`,
        'x-nautical-tenant': connection.tenantId
      },
      data: {
        query: mutation,
        variables: {
          variantId,
          quantity
        }
      }
    });
    
    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }
    
    if (response.data.data.variantUpdate.userErrors.length > 0) {
      throw new Error(response.data.data.variantUpdate.userErrors[0].message);
    }
    
    return response.data.data.variantUpdate.variant;
  } catch (error) {
    throw handleApiError(error, 'Update Nautical Inventory');
  }
} 