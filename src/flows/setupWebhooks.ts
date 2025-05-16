import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";

export const setupWebhooksFlow = flow({
  name: "Setup Shopify Webhooks",
  stableKey: "setup-webhooks",
  description:
    "Set up webhooks for Shopify to notify of product, inventory, and order changes",

  // Triggered when an instance is deployed
  onExecution: async (context, params) => {
    const shopifyConnection = params.connections.shopify;
    const instanceUrl = context.instance.endpoint;

    try {
      // Set up webhooks for product events
      const webhooks = [
        {
          topic: "products/create",
          address: `${instanceUrl}?flowName=product-update-webhook`,
          format: "json",
        },
        {
          topic: "products/update",
          address: `${instanceUrl}?flowName=product-update-webhook`,
          format: "json",
        },
        {
          topic: "products/delete",
          address: `${instanceUrl}?flowName=product-update-webhook`,
          format: "json",
        },
        {
          topic: "inventory_levels/update",
          address: `${instanceUrl}?flowName=inventory-sync`,
          format: "json",
        },
        {
          topic: "orders/create",
          address: `${instanceUrl}?flowName=order-sync`,
          format: "json",
        },
        {
          topic: "orders/updated",
          address: `${instanceUrl}?flowName=order-sync`,
          format: "json",
        },
      ];

      // Register each webhook
      const results = await Promise.all(
        webhooks.map((webhook) => registerWebhook(shopifyConnection, webhook)),
      );

      logInfo(context, `Successfully set up ${results.length} webhooks`, {
        webhookCount: results.length,
      });

      return {
        data: {
          success: true,
          webhooksCreated: results.length,
          message: `Successfully set up ${results.length} webhooks`,
        },
      };
    } catch (error) {
      logError(context, "Failed to set up webhooks", error as Error);
      throw error;
    }
  },
});

async function registerWebhook(connection: any, webhook: any) {
  const mutation = `
    mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
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
        "X-Shopify-Access-Token": connection.accessToken,
      },
      data: {
        query: mutation,
        variables: {
          topic: webhook.topic,
          webhookSubscription: {
            callbackUrl: webhook.address,
            format: webhook.format,
          },
        },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.webhookSubscriptionCreate.userErrors.length > 0) {
      throw new Error(
        response.data.data.webhookSubscriptionCreate.userErrors[0].message,
      );
    }

    return response.data.data.webhookSubscriptionCreate.webhookSubscription;
  } catch (error) {
    throw handleApiError(error, `Register Webhook: ${webhook.topic}`);
  }
}
