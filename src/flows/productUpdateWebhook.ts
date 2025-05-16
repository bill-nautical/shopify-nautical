import { flow } from "@prismatic-io/spectral";
import { transformShopifyProductToNautical } from "../utils/dataTransformation";
import { withRetry, handleApiError } from "../utils/errorHandling";
import { logInfo, logError } from "../utils/logging";
import axios from "axios";

export const productUpdateWebhookFlow = flow({
  name: "Product Update Webhook",
  stableKey: "product-update-webhook",
  description: "Handle product updates from Shopify",

  // Triggered by Shopify webhook
  onExecution: async (context, params) => {
    const webhookData = params.onTrigger?.results?.body?.data;
    const eventType = params.onTrigger?.results?.headers?.["x-shopify-topic"];
    const nauticalConnection = params.connections.nautical;
    const attributeMappings =
      JSON.parse(context.instanceState.attributeMapping?.customMapping || "{}")
        .mappings || [];

    try {
      // Handle different event types
      switch (eventType) {
        case "products/create":
        case "products/update":
          await handleProductCreateOrUpdate(
            nauticalConnection,
            webhookData,
            attributeMappings,
          );
          break;
        case "products/delete":
          await handleProductDelete(nauticalConnection, webhookData);
          break;
        default:
          logInfo(context, `Ignoring unsupported event type: ${eventType}`);
          break;
      }

      logInfo(context, `Successfully processed ${eventType} event`, {
        eventType,
        product: webhookData?.id || "unknown",
      });

      return {
        data: {
          success: true,
          message: `Successfully processed ${eventType} event`,
        },
      };
    } catch (error) {
      logError(context, `Failed to process ${eventType} event`, error as Error);
      throw error;
    }
  },
});

// Helper functions for webhook handlers
async function handleProductCreateOrUpdate(
  connection: any,
  data: any,
  mappings: any[],
) {
  // Transform the product data
  const transformedProduct = transformShopifyProductToNautical(data, mappings);

  // Check if product exists in Nautical Commerce
  const existingProduct = await findProductByExternalId(connection, data.id);

  if (existingProduct) {
    // Update existing product
    return await updateProduct(
      connection,
      existingProduct.id,
      transformedProduct,
    );
  } else {
    // Create new product
    return await createProduct(connection, transformedProduct, data.id);
  }
}

async function handleProductDelete(connection: any, data: any) {
  // Find the product in Nautical Commerce
  const existingProduct = await findProductByExternalId(connection, data.id);

  if (existingProduct) {
    // Delete the product
    return await deleteProduct(connection, existingProduct.id);
  } else {
    // Product not found, nothing to delete
    return { success: true, message: "Product not found in Nautical Commerce" };
  }
}

async function findProductByExternalId(connection: any, externalId: string) {
  const query = `
    query FindProductByExternalId($externalId: String!) {
      products(filter: { externalId: { eq: $externalId } }, first: 1) {
        nodes {
          id
          name
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

    const products = response.data.data.products.nodes;
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    throw handleApiError(error, "Find Product By External ID");
  }
}

async function createProduct(
  connection: any,
  product: any,
  externalId: string,
) {
  // Add external ID to product data
  const productWithExternalId = {
    ...product,
    externalId,
  };

  const mutation = `
    mutation CreateProduct($input: ProductCreateInput!) {
      productCreate(input: $input) {
        product {
          id
          name
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
          input: productWithExternalId,
        },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.productCreate.userErrors.length > 0) {
      throw new Error(response.data.data.productCreate.userErrors[0].message);
    }

    return response.data.data.productCreate.product;
  } catch (error) {
    throw handleApiError(error, "Create Product");
  }
}

async function updateProduct(connection: any, id: string, product: any) {
  const mutation = `
    mutation UpdateProduct($id: ID!, $input: ProductUpdateInput!) {
      productUpdate(id: $id, input: $input) {
        product {
          id
          name
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
          input: product,
        },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.productUpdate.userErrors.length > 0) {
      throw new Error(response.data.data.productUpdate.userErrors[0].message);
    }

    return response.data.data.productUpdate.product;
  } catch (error) {
    throw handleApiError(error, "Update Product");
  }
}

async function deleteProduct(connection: any, id: string) {
  const mutation = `
    mutation DeleteProduct($id: ID!) {
      productDelete(id: $id) {
        deletedProductId
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
        variables: { id },
      },
    });

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    if (response.data.data.productDelete.userErrors.length > 0) {
      throw new Error(response.data.data.productDelete.userErrors[0].message);
    }

    return {
      success: true,
      id: response.data.data.productDelete.deletedProductId,
    };
  } catch (error) {
    throw handleApiError(error, "Delete Product");
  }
}
