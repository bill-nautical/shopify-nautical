import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";

export const orderSyncFlow = flow({
  name: "Order Sync",
  stableKey: "order-sync",
  description: "Synchronize orders between Shopify and Nautical Commerce",

  // Triggered by webhook or schedule
  onExecution: async (context, params) => {
    const shopifyConnection = params.connections.shopify;
    const nauticalConnection = params.connections.nautical;
    const orderData = params.onTrigger?.results?.body?.data;

    try {
      if (orderData) {
        // Handle webhook event for specific order
        await processOrderWebhook(
          shopifyConnection,
          nauticalConnection,
          orderData,
        );

        logInfo(
          context,
          `Successfully processed order webhook: ${orderData.id}`,
          {
            orderId: orderData.id,
          },
        );
      } else {
        // Schedule-based sync for all orders in a time period
        const syncResult = await syncAllOrders(
          shopifyConnection,
          nauticalConnection,
        );

        logInfo(context, `Synchronized ${syncResult.total} orders`, {
          created: syncResult.created,
          updated: syncResult.updated,
          skipped: syncResult.skipped,
        });
      }

      return {
        data: {
          success: true,
          message: "Order sync completed successfully",
        },
      };
    } catch (error) {
      logError(context, "Order sync failed", error as Error);
      throw error;
    }
  },
});

// Helper functions for order sync
async function processOrderWebhook(
  shopifyConn: any,
  nauticalConn: any,
  orderData: any,
) {
  // Check if the order exists in Nautical Commerce
  const existingOrder = await findOrderByExternalId(nauticalConn, orderData.id);

  if (existingOrder) {
    // Update existing order
    return await updateOrder(nauticalConn, existingOrder.id, orderData);
  } else {
    // Create new order
    return await createOrder(nauticalConn, orderData);
  }
}

async function syncAllOrders(shopifyConn: any, nauticalConn: any) {
  // Get recent orders from Shopify
  const recentOrders = await getRecentShopifyOrders(shopifyConn);

  // Process each order
  const results = {
    total: recentOrders.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const order of recentOrders) {
    try {
      const existingOrder = await findOrderByExternalId(nauticalConn, order.id);

      if (existingOrder) {
        // Check if the order needs to be updated (e.g., status changed)
        if (
          existingOrder.status !==
          mapShopifyStatusToNautical(order.displayFinancialStatus)
        ) {
          await updateOrder(nauticalConn, existingOrder.id, order);
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await createOrder(nauticalConn, order);
        results.created++;
      }
    } catch (error) {
      console.error(`Failed to process order ${order.id}:`, error);
      // Continue with next order even if this one fails
    }
  }

  return results;
}

async function getRecentShopifyOrders(connection: any) {
  // Get orders from the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const createdAtMin = yesterday.toISOString();

  const query = `
    query GetRecentOrders($createdAtMin: DateTime!) {
      orders(first: 50, query: "created_at:>='${createdAtMin}'") {
        edges {
          node {
            id
            name
            email
            phone
            totalPrice
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            lineItems(first: 50) {
              edges {
                node {
                  id
                  name
                  quantity
                  originalTotalPrice
                  variant {
                    id
                    sku
                    product {
                      id
                    }
                  }
                }
              }
            }
            shippingAddress {
              address1
              address2
              city
              country
              firstName
              lastName
              phone
              province
              zip
            }
            billingAddress {
              address1
              address2
              city
              country
              firstName
              lastName
              phone
              province
              zip
            }
          }
        }
        pageInfo {
          hasNextPage
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
          "X-Shopify-Access-Token": connection.accessToken,
        },
        data: {
          query,
          variables: { createdAtMin },
        },
      }),
    );

    return response.data.data.orders.edges.map((edge: any) => edge.node);
  } catch (error) {
    throw handleApiError(error, "Get Recent Shopify Orders");
  }
}

async function findOrderByExternalId(connection: any, externalId: string) {
  const query = `
    query FindOrderByExternalId($externalId: String!) {
      orders(filter: { externalId: { eq: $externalId } }, first: 1) {
        nodes {
          id
          status
          createdAt
        }
      }
    }
  `;

  try {
    const response = await axios({
      url: connection.apiUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.apiKey}`,
        "x-nautical-tenant": connection.tenantId,
      },
      data: {
        query,
        variables: { externalId },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const orders = response.data.data.orders.nodes;
    return orders.length > 0 ? orders[0] : null;
  } catch (error) {
    throw handleApiError(error, "Find Order By External ID");
  }
}

function mapShopifyStatusToNautical(shopifyStatus: string) {
  // Map Shopify order status to Nautical Commerce status
  const statusMap: Record<string, string> = {
    PAID: "PAID",
    PARTIALLY_PAID: "PARTIALLY_PAID",
    PENDING: "PENDING",
    REFUNDED: "REFUNDED",
    VOIDED: "VOIDED",
    AUTHORIZED: "AUTHORIZED",
    PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  };

  return statusMap[shopifyStatus] || "PENDING";
}

async function createOrder(connection: any, orderData: any) {
  // Transform order data to Nautical Commerce format
  const nauticalOrder = transformShopifyOrderToNautical(orderData);

  const mutation = `
    mutation CreateOrder($input: OrderCreateInput!) {
      orderCreate(input: $input) {
        order {
          id
          status
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.apiKey}`,
        "x-nautical-tenant": connection.tenantId,
      },
      data: {
        query: mutation,
        variables: {
          input: nauticalOrder,
        },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.orderCreate.userErrors.length > 0) {
      throw new Error(response.data.data.orderCreate.userErrors[0].message);
    }

    return response.data.data.orderCreate.order;
  } catch (error) {
    throw handleApiError(error, "Create Order");
  }
}

async function updateOrder(connection: any, id: string, orderData: any) {
  // Transform order data to Nautical Commerce format
  const nauticalOrder = transformShopifyOrderToNautical(orderData);

  const mutation = `
    mutation UpdateOrder($id: ID!, $input: OrderUpdateInput!) {
      orderUpdate(id: $id, input: $input) {
        order {
          id
          status
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${connection.apiKey}`,
        "x-nautical-tenant": connection.tenantId,
      },
      data: {
        query: mutation,
        variables: {
          id,
          input: nauticalOrder,
        },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.orderUpdate.userErrors.length > 0) {
      throw new Error(response.data.data.orderUpdate.userErrors[0].message);
    }

    return response.data.data.orderUpdate.order;
  } catch (error) {
    throw handleApiError(error, "Update Order");
  }
}

// Transform Shopify order to Nautical Commerce format
function transformShopifyOrderToNautical(shopifyOrder: any) {
  // Extract line items
  const lineItems =
    shopifyOrder.lineItems?.edges?.map((edge: any) => {
      const node = edge.node;
      return {
        productVariantId: node.variant?.id,
        quantity: node.quantity,
        price: parseFloat(node.originalTotalPrice) / node.quantity,
        sku: node.variant?.sku,
      };
    }) || [];

  // Extract shipping address
  const shippingAddress = shopifyOrder.shippingAddress
    ? {
        firstName: shopifyOrder.shippingAddress.firstName,
        lastName: shopifyOrder.shippingAddress.lastName,
        address1: shopifyOrder.shippingAddress.address1,
        address2: shopifyOrder.shippingAddress.address2,
        city: shopifyOrder.shippingAddress.city,
        province: shopifyOrder.shippingAddress.province,
        postalCode: shopifyOrder.shippingAddress.zip,
        country: shopifyOrder.shippingAddress.country,
        phone: shopifyOrder.shippingAddress.phone,
      }
    : null;

  // Extract billing address
  const billingAddress = shopifyOrder.billingAddress
    ? {
        firstName: shopifyOrder.billingAddress.firstName,
        lastName: shopifyOrder.billingAddress.lastName,
        address1: shopifyOrder.billingAddress.address1,
        address2: shopifyOrder.billingAddress.address2,
        city: shopifyOrder.billingAddress.city,
        province: shopifyOrder.billingAddress.province,
        postalCode: shopifyOrder.billingAddress.zip,
        country: shopifyOrder.billingAddress.country,
        phone: shopifyOrder.billingAddress.phone,
      }
    : null;

  return {
    externalId: shopifyOrder.id,
    orderNumber: shopifyOrder.name,
    customerEmail: shopifyOrder.email,
    customerPhone: shopifyOrder.phone,
    status: mapShopifyStatusToNautical(shopifyOrder.displayFinancialStatus),
    totalPrice: parseFloat(shopifyOrder.totalPrice),
    lineItems,
    shippingAddress,
    billingAddress,
  };
}
