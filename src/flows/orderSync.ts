import {
  flow,
  type ActionContext,
  type ConfigVarResultCollection,
  type TriggerPayload,
} from "@prismatic-io/spectral";
import axios from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";

interface ConfigVars {
  shopify: {
    apiUrl: string;
    accessToken: string;
  };
  nautical: {
    apiUrl: string;
    apiKey: string;
    tenantId: string;
  };
}

interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalPrice: string;
  displayFinancialStatus: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        quantity: number;
        originalTotalPrice: string;
        variant?: {
          id: string;
          sku: string;
          product: {
            id: string;
          };
        };
      };
    }>;
  };
  shippingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
    phone: string;
  };
}

interface ShopifyConnection {
  apiUrl: string;
  accessToken: string;
}

interface NauticalConnection {
  apiUrl: string;
  apiKey: string;
  tenantId: string;
}

interface OrderTriggerPayload extends TriggerPayload {
  results?: {
    body?: {
      data?: ShopifyOrder;
    };
  };
}

export const orderSyncFlow = flow({
  name: "Order Sync",
  stableKey: "order-sync",
  description: "Synchronize orders between Shopify and Nautical Commerce",

  onExecution: async (context: ActionContext, payload: OrderTriggerPayload) => {
    try {
      const orderData = payload.results?.body?.data;
      const shopifyConfig = context.configVars[
        "Shopify Connection"
      ] as unknown as ShopifyConnection;
      const nauticalConfig = context.configVars[
        "Nautical Connection"
      ] as unknown as NauticalConnection;

      if (orderData) {
        // Handle webhook event for specific order
        await processOrderWebhook(shopifyConfig, nauticalConfig, orderData);

        logInfo(
          context,
          `Successfully processed order webhook: ${orderData.id}`,
          {
            orderId: orderData.id,
            orderNumber: orderData.name,
          }
        );
      } else {
        // Schedule-based sync for all orders in a time period
        const syncResult = await syncAllOrders(shopifyConfig, nauticalConfig);

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
      const formattedError =
        error instanceof Error ? error : new Error(String(error));
      logError(context, "Order sync failed", formattedError);
      throw formattedError;
    }
  },
});

async function processOrderWebhook(
  shopifyConn: ShopifyConnection,
  nauticalConn: NauticalConnection,
  orderData: ShopifyOrder
) {
  const existingOrder = await findOrderByExternalId(nauticalConn, orderData.id);

  if (existingOrder) {
    return await updateOrder(nauticalConn, existingOrder.id, orderData);
  }

  return await createOrder(nauticalConn, orderData);
}

async function syncAllOrders(
  shopifyConn: ShopifyConnection,
  nauticalConn: NauticalConnection
) {
  const recentOrders = await getRecentShopifyOrders(shopifyConn);
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
    }
  }

  return results;
}

async function getRecentShopifyOrders(connection: ShopifyConnection) {
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
      })
    );

    return response.data.data.orders.edges.map(
      (edge: { node: ShopifyOrder }) => edge.node
    );
  } catch (error) {
    throw handleApiError(error, "Get Recent Shopify Orders");
  }
}

async function findOrderByExternalId(
  connection: NauticalConnection,
  externalId: string
) {
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

async function createOrder(
  connection: NauticalConnection,
  orderData: ShopifyOrder
) {
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

async function updateOrder(
  connection: NauticalConnection,
  id: string,
  orderData: ShopifyOrder
) {
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

function transformShopifyOrderToNautical(shopifyOrder: ShopifyOrder) {
  const lineItems = shopifyOrder.lineItems.edges.map((edge) => {
    const node = edge.node;
    return {
      productVariantId: node.variant?.id,
      quantity: node.quantity,
      price: Number.parseFloat(node.originalTotalPrice) / node.quantity,
      sku: node.variant?.sku,
    };
  });

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
    totalPrice: Number.parseFloat(shopifyOrder.totalPrice),
    lineItems,
    shippingAddress,
    billingAddress,
  };
}
