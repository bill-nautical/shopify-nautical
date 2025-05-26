// src/index.ts
import { integration } from "@prismatic-io/spectral";
import { productImportFlow } from "./flows/productImport";
import { inventorySyncFlow } from "./flows/inventorySync";
import { orderSyncFlow } from "./flows/orderSync";
import { setupWebhooksFlow } from "./flows/setupWebhooks";
import { productUpdateWebhookFlow } from "./flows/productUpdateWebhook";
import { configPages } from "./configPages";

export { configPages } from "./configPages";

export default integration({
  name: "Shopify to Nautical Commerce",
  description: "Integration between Shopify and Nautical Commerce",
  iconPath: "icon.png",
  flows: [
    productImportFlow,
    inventorySyncFlow,
    orderSyncFlow,
    setupWebhooksFlow,
    productUpdateWebhookFlow,
  ],
  endpointType: "instance_specific",
  triggerPreprocessFlowConfig: {
    flowNameField: "headers.x-webhook-type",
  },
});
