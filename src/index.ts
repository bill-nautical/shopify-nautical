// src/index.ts
import { integration } from "@prismatic-io/spectral";
import { shopifyConnection } from "./connections/shopify";
import { nauticalConnection } from "./connections/nautical";
import { productImportFlow } from "./flows/productImport";
import { inventorySyncFlow } from "./flows/inventorySync";
import { orderSyncFlow } from "./flows/orderSync";
import { setupWebhooksFlow } from "./flows/setupWebhooks";
import { productUpdateWebhookFlow } from "./flows/productUpdateWebhook";
import components from "./components";

export default integration({
  name: "Shopify to Nautical Commerce",
  description: "Integration between Shopify and Nautical Commerce",
  iconPath: "icon.png",
  connections: {
    shopify: shopifyConnection,
    nautical: nauticalConnection,
  },
  flows: [
    productImportFlow,
    inventorySyncFlow,
    orderSyncFlow,
    setupWebhooksFlow,
    productUpdateWebhookFlow,
  ],
  components,
  // Using instance specific endpoint configuration for webhooks
  endpointType: "instance_specific",
  triggerPreprocessFlowConfig: {
    flowNameField: "headers.x-webhook-type",
  },
});
