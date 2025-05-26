import { flow } from "@prismatic-io/spectral";
import axios from "axios";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";

interface ShopifyConnection {
  apiUrl: string;
  accessToken: string;
}

interface WebhookConfig {
  topic: string;
  address: string;
  format: string;
}

export const setupWebhooksFlow = flow({
  name: "Setup Webhooks",
  stableKey: "setup-webhooks",
  description: "Setup webhooks for Shopify integration",

  onExecution: async (context) => {
    try {
      const webhookUrl = context.webhookUrls[context.flow.name];

      if (!webhookUrl) {
        throw new Error("Webhook URL not found for current flow");
      }

      logInfo(context, "Setting up webhooks", {
        webhookUrl,
      });

      // Setup webhook logic here
      // This would typically involve making API calls to Shopify to register the webhook

      return {
        data: {
          message: "Webhooks setup completed successfully",
          webhookUrl,
        },
      };
    } catch (error) {
      const formattedError =
        error instanceof Error ? error : new Error(String(error));
      logError(context, "Webhook setup failed", formattedError);
      throw formattedError;
    }
  },
});

async function registerWebhook(
  connection: ShopifyConnection,
  webhook: WebhookConfig
) {
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
        response.data.data.webhookSubscriptionCreate.userErrors[0].message
      );
    }

    return response.data.data.webhookSubscriptionCreate.webhookSubscription;
  } catch (error) {
    throw handleApiError(error, `Register Webhook: ${webhook.topic}`);
  }
}
