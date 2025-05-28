import type { Connection } from "@prismatic-io/spectral";

export interface ShopifyConnection extends Connection {
  apiUrl: string;
  accessToken: string;
}

export interface NauticalConnection extends Connection {
  apiUrl: string;
  apiKey: string;
  tenantId: string;
}

export interface ShopifyInventoryLevel {
  id: string;
  available: number;
  location: {
    id: string;
    name: string;
  };
}

export interface ShopifyVariant {
  id: string;
  sku: string;
  product: {
    id: string;
    title: string;
  };
}

export interface ShopifyInventoryItem {
  id: string;
  variantId?: string;
  sku?: string;
  productId?: string;
  productTitle?: string;
  levels: ShopifyInventoryLevel[];
}

export interface ShopifyInventoryResponse {
  data: {
    inventoryItems: {
      edges: Array<{
        node: {
          id: string;
          inventoryLevels: {
            edges: Array<{
              node: ShopifyInventoryLevel;
            }>;
          };
          variant: ShopifyVariant;
        };
      }>;
    };
  };
}

export interface NauticalInventoryItem {
  productId: string;
  productExternalId: string;
  productName: string;
  variantId: string;
  variantExternalId: string;
  sku: string;
  quantity: number;
}

export interface InventoryUpdate {
  sku: string;
  shopifyVariantId: string;
  nauticalVariantId: string;
  shopifyQuantity: number;
  nauticalQuantity: number;
  targetQuantity: number;
}

export interface ConfigVars {
  shopifyConnection: ShopifyConnection;
  nauticalConnection: NauticalConnection;
}
